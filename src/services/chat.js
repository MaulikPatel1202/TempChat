// src/services/chat.js
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp, 
  onSnapshot,
  limit 
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Create a new chat room
export const createRoom = async (userId, username) => {
  try {
    const roomId = uuidv4().slice(0, 8);
    
    await addDoc(collection(db, 'rooms'), {
      roomId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      creatorName: username,
      isTemporary: true
    });
    
    return roomId;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
};

// Get room information
export const getRoomInfo = async (roomId) => {
  try {
    const roomQuery = query(
      collection(db, 'rooms'),
      where('roomId', '==', roomId)
    );
    
    const snapshot = await getDocs(roomQuery);
    
    if (snapshot.empty) {
      return null;
    }
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error("Error getting room info:", error);
    throw error;
  }
};

// Get recent rooms
export const getRecentRooms = async (limit = 5) => {
  try {
    const roomsQuery = query(
      collection(db, 'rooms'),
      orderBy('createdAt', 'desc'),
      limit(limit)
    );
    
    const snapshot = await getDocs(roomsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching recent rooms:", error);
    throw error;
  }
};

// Send a new message
export const sendMessage = async (roomId, userId, username, text, mediaUrl = null, mediaType = null) => {
  try {
    await addDoc(collection(db, 'messages'), {
      roomId,
      uid: userId,
      username,
      text,
      timestamp: serverTimestamp(),
      mediaUrl,
      mediaType
    });
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Listen for messages in a room
export const listenForMessages = (roomId, callback) => {
  const messagesQuery = query(
    collection(db, 'messages'),
    where('roomId', '==', roomId),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

// Listen for room information
export const listenForRoomInfo = (roomId, callback) => {
  const roomQuery = query(
    collection(db, 'rooms'),
    where('roomId', '==', roomId)
  );
  
  return onSnapshot(roomQuery, (snapshot) => {
    if (!snapshot.empty) {
      callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    } else {
      callback(null);
    }
  });
};