// WebSocket-based signaling service

class SignalingService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.handlers = new Map();
    this.connectPromise = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
  }

  // Connect to the signaling server
  connect() {
    if (this.connectPromise) return this.connectPromise;
    
    this.connectPromise = new Promise((resolve, reject) => {
      // Use secure WebSocket in production, regular in development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host;
      
      if (process.env.NODE_ENV === 'production') {
        // For Vercel deployment
        host = window.location.host;
        this.socket = new WebSocket(`${protocol}//${host}/socket`);
      } else {
        // For local development
        host = `${window.location.hostname}:3001`;
        this.socket = new WebSocket(`${protocol}//${host}`);
      }
      
      console.log(`Connecting to WebSocket at ${protocol}//${host}`);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code);
        this.isConnected = false;
        this.connectPromise = null;
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectDelay);
          this.reconnectAttempts++;
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message from signaling server:', message.type);
          
          // Dispatch message to appropriate handler
          if (this.handlers.has(message.type)) {
            this.handlers.get(message.type).forEach(handler => handler(message));
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
    });
    
    return this.connectPromise;
  }

  // Join a specific room
  async joinRoom(roomId, userId) {
    await this.connect();
    this.sendMessage({
      type: 'join',
      roomId,
      userId
    });
  }

  // Send signaling message
  sendMessage(message) {
    if (!this.isConnected) {
      console.error('Cannot send message, WebSocket not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  // Register handler for specific message type
  on(messageType, handler) {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType).add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(messageType);
        }
      }
    };
  }

  // Close connection
  disconnect() {
    if (this.socket && this.isConnected) {
      this.socket.close(1000, 'Normal closure');
      this.isConnected = false;
      this.connectPromise = null;
      this.handlers.clear();
    }
  }
}

// Create singleton instance
const signaling = new SignalingService();
export default signaling;
