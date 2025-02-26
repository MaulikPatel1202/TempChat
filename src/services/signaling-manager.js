import { db } from '../firebase';
import { collection, doc, addDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';

class SignalingManager {
  constructor() {
    this.roomId = null;
    this.userId = null;
    this.onMessageCallback = null;
    this.unsubscribe = null;
  }
  
  async connect() {
    // Firebase is already initialized, so we're ready
    console.log("Signaling manager connected");
    return true;
  }
  
  async joinRoom(roomId, userId) {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    this.roomId = roomId;
    this.userId = userId;
    
    // Listen for signaling messages
    const signalingQuery = query(
      collection(db, 'rooms', this.roomId, 'signaling'),
      orderBy('timestamp', 'asc')
    );
    
    this.unsubscribe = onSnapshot(signalingQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const message = change.doc.data();
          
          // Don't process own messages
          if (message.from !== this.userId && this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        }
      });
    });
    
    console.log(`Joined signaling room: ${roomId}`);
    return true;
  }
  
  async sendMessage(message) {
    if (!this.roomId) {
      console.error("Not connected to a room");
      return;
    }
    
    try {
      await addDoc(collection(db, 'rooms', this.roomId, 'signaling'), {
        ...message,
        timestamp: serverTimestamp()
      });
      
      console.log(`Sent signaling message: ${message.type}`);
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  }
  
  onMessage(callback) {
    this.onMessageCallback = callback;
  }
  
  leaveRoom() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.roomId = null;
    this.userId = null;
    console.log("Left signaling room");
  }
}

const signalingManager = new SignalingManager();
export default signalingManager;