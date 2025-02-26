
// Firebase fallback for signaling when WebSockets are not available
import { db } from '../firebase';
import { ref, onValue, set, push, get, child, remove, onChildAdded, onChildChanged } from 'firebase/database';

class FirebaseSignalingService {
  constructor() {
    this.roomId = null;
    this.userId = null;
    this.unsubscribers = [];
    this.handlers = new Map();
    this.isConnected = false;
  }

  async connect() {
    this.isConnected = true;
    return Promise.resolve();
  }

  async joinRoom(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;

    // Create a presence entry for this user
    await set(ref(db, `signaling/${roomId}/presence/${userId}`), {
      online: true,
      lastSeen: Date.now()
    });

    // Set a cleanup handler for when the user leaves
    const presenceRef = ref(db, `signaling/${roomId}/presence/${userId}`);
    set(presenceRef, { online: true, lastSeen: Date.now() });

    // Listen to messages sent to this user
    const messagesRef = ref(db, `signaling/${roomId}/messages/${userId}`);
    const unsubscribe = onChildAdded(messagesRef, (snapshot) => {
      const message = snapshot.val();
      
      // Process the message
      if (this.handlers.has(message.type)) {
        this.handlers.get(message.type).forEach(handler => handler(message));
      }
      
      // Remove the message after processing
      remove(snapshot.ref);
    });

    this.unsubscribers.push(unsubscribe);
    
    return true;
  }

  sendMessage(message) {
    if (!this.isConnected || !this.roomId || !message.userId) {
      console.error('Cannot send message, not properly connected');
      return false;
    }

    try {
      // Push a new message to the recipient's messages queue
      const recipientsRef = ref(db, `signaling/${this.roomId}/messages`);
      
      // For messages that should go to everyone except sender
      get(ref(db, `signaling/${this.roomId}/presence`)).then((snapshot) => {
        if (snapshot.exists()) {
          const presences = snapshot.val();
          Object.keys(presences).forEach((userId) => {
            if (userId !== this.userId) {
              push(child(recipientsRef, userId), {
                ...message,
                from: this.userId, 
                timestamp: Date.now()
              });
            }
          });
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

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

  disconnect() {
    if (this.roomId && this.userId) {
      // Set user as offline
      set(ref(db, `signaling/${this.roomId}/presence/${this.userId}`), {
        online: false,
        lastSeen: Date.now()
      });
    }
    
    // Unsubscribe from all listeners
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.isConnected = false;
    this.roomId = null;
    this.userId = null;
    this.handlers.clear();
  }
}

// Create a singleton instance
const firebaseSignaling = new FirebaseSignalingService();
export default firebaseSignaling;