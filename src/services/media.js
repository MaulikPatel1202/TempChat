// src/services/media.js
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import WebRTCService from './webrtc';

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

// Replace placeholder functions with actual WebRTC service integration.
export const initializeVoiceCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing voice call with WebRTC...");
  // false = audio only
  const service = new WebRTCService(roomId, userId, false, onRemoteStream, onCallStatusChange);
  return {
    start: async () => await service.startCall(),
    answer: async (remoteOffer) => await service.answerCall(remoteOffer),
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => service.endCall()
  };
};

export const initializeVideoCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing video call with WebRTC...");
  // true = video enabled
  const service = new WebRTCService(roomId, userId, true, onRemoteStream, onCallStatusChange);
  return {
    start: async () => await service.startCall(),
    answer: async (remoteOffer) => await service.answerCall(remoteOffer),
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => service.endCall()
  };
};