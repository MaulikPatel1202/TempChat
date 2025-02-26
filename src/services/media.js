// src/services/media.js
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Upload media file and get download URL
export const uploadMedia = async (roomId, file) => {
  try {
    const storageRef = ref(storage, `rooms/${roomId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    
    // Determine media type
    let mediaType = 'file';
    if (file.type.startsWith('image')) {
      mediaType = 'image';
    } else if (file.type.startsWith('video')) {
      mediaType = 'video';
    } else if (file.type.startsWith('audio')) {
      mediaType = 'audio';
    }
    
    return { url: downloadUrl, type: mediaType };
  } catch (error) {
    console.error("Error uploading media:", error);
    throw error;
  }
};

// In a real app, you would have WebRTC initialization here
export const initializeVoiceCall = () => {
  console.log("Initializing voice call with WebRTC...");
  // WebRTC setup would go here
  return {
    start: () => console.log("Starting voice call"),
    end: () => console.log("Ending voice call")
  };
};

export const initializeVideoCall = () => {
  console.log("Initializing video call with WebRTC...");
  // WebRTC setup would go here
  return {
    start: () => console.log("Starting video call"),
    end: () => console.log("Ending video call")
  };
};