
// Manages multiple signaling options with fallbacks
import wsSignaling from './signaling';
import firebaseSignaling from './firebase-signaling';

class SignalingManager {
  constructor() {
    this.primarySignaling = wsSignaling;
    this.fallbackSignaling = firebaseSignaling;
    this.activeSignaling = null;
    this.handlers = new Map();
  }

  async connect() {
    try {
      // Try WebSocket first
      await this.primarySignaling.connect();
      this.activeSignaling = this.primarySignaling;
      console.log("Using WebSocket signaling");
      return true;
    } catch (error) {
      console.warn("WebSocket signaling failed, falling back to Firebase:", error);
      
      try {
        // Fall back to Firebase
        await this.fallbackSignaling.connect();
        this.activeSignaling = this.fallbackSignaling;
        console.log("Using Firebase signaling fallback");
        return true;
      } catch (fallbackError) {
        console.error("All signaling methods failed:", fallbackError);
        throw new Error("Failed to establish signaling connection");
      }
    }
  }

  async joinRoom(roomId, userId) {
    if (!this.activeSignaling) {
      await this.connect();
    }
    
    return this.activeSignaling.joinRoom(roomId, userId);
  }

  sendMessage(message) {
    if (!this.activeSignaling) {
      console.error("No active signaling connection");
      return false;
    }
    
    return this.activeSignaling.sendMessage(message);
  }

  on(messageType, handler) {
    // Store handlers locally
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType).add(handler);
    
    // Register with both signaling systems
    const wsUnsubscriber = this.primarySignaling.on(messageType, handler);
    const fbUnsubscriber = this.fallbackSignaling.on(messageType, handler);
    
    // Return combined unsubscribe function
    return () => {
      wsUnsubscriber();
      fbUnsubscriber();
      
      const handlers = this.handlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(messageType);
        }
      }
    };
  }

  disconnect() {
    if (this.activeSignaling) {
      this.activeSignaling.disconnect();
      this.activeSignaling = null;
    }
  }
}

// Create singleton instance
const signalingManager = new SignalingManager();
export default signalingManager;