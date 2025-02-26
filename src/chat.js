
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ...existing code...

export const createRoom = async (userId) => {
  try {
    const roomRef = doc(collection(db, "rooms"));
    
    await setDoc(roomRef, {
      createdAt: serverTimestamp(),
      createdBy: userId,
      participants: [userId],
      active: true
    });
    
    return roomRef.id;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
};

// ...existing code...
import { db } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
// ...existing code...