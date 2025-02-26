// src/services/media.js
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import WebRTCService from './webrtc';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import signalingManager from './signaling-manager';

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

// Add these functions for call metadata
export const sendCallMetadata = async (roomId, userId, callData) => {
  try {
    // Make sure the offer is included in the call metadata if it exists
    const metadata = {
      from: userId,
      timestamp: new Date(),
      isActive: true,
      status: 'calling',
      ...callData
    };
    
    console.log("Sending call metadata:", metadata);
    await setDoc(doc(db, 'rooms', roomId, 'callMetadata', 'current'), metadata);
  } catch (error) {
    console.error("Error sending call metadata:", error);
  }
};

export const listenForCallMetadata = (roomId, userId, onIncomingCall) => {
  const callRef = doc(db, 'rooms', roomId, 'callMetadata', 'current');
  
  return onSnapshot(callRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.from !== userId && data.isActive) {
        // Someone else is calling
        onIncomingCall(data);
      }
    }
  });
};

export const updateCallMetadata = async (roomId, status) => {
  try {
    await setDoc(doc(db, 'rooms', roomId, 'callMetadata', 'current'), 
      { isActive: status === 'active' }, 
      { merge: true }
    );
  } catch (error) {
    console.error("Error updating call metadata:", error);
  }
};

export const initializeVoiceCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing voice call with WebRTC...");
  // false = audio only
  // Update to use signalingManager instead of signaling
  const service = new WebRTCService(roomId, userId, false, onRemoteStream, onCallStatusChange);
  
  return {
    start: async () => {
      try {
        // Ensure signaling connection is established
        await signalingManager.connect();
        await signalingManager.joinRoom(roomId, userId);
        
        const result = await service.startCall();
        
        // Send the offer via call metadata so the recipient can see there's an incoming call
        await sendCallMetadata(roomId, userId, {
          isVideo: false,
          offer: result.offer
        });
        
        return result;
      } catch (error) {
        console.error("Failed to start voice call:", error);
        // Make sure we clean up properly on failure
        if (service.localStream) {
          service.localStream.getTracks().forEach(track => track.stop());
        }
        throw error;
      }
    },
    answer: async (remoteOffer) => {
      try {
        // Ensure signaling connection is established
        await signalingManager.connect();
        await signalingManager.joinRoom(roomId, userId);
        
        const result = await service.answerCall(remoteOffer);
        
        return result;
      } catch (error) {
        console.error("Failed to answer call:", error);
        // Make sure we clean up properly on failure
        if (service.localStream) {
          service.localStream.getTracks().forEach(track => track.stop());
        }
        throw error;
      }
    },
    end: () => {
      service.endCall();
      // Update call metadata
      updateCallMetadata(roomId, 'inactive');
    },
    enableVideo: async () => {
      const result = await service.enableVideo();
      return result;
    },
    get localStream() {
      return service.localStream;
    }
  };
};

export const initializeVideoCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing video call with WebRTC...");
  // true = video enabled
  const service = new WebRTCService(roomId, userId, true, onRemoteStream, onCallStatusChange);
  
  return {
    start: async () => {
      try {
        // Ensure signaling connection is established
        await signalingManager.connect();
        await signalingManager.joinRoom(roomId, userId);
        
        const result = await service.startCall();
        
        // Send the offer via call metadata so the recipient can see there's an incoming call
        await sendCallMetadata(roomId, userId, {
          isVideo: true,
          offer: result.offer
        });
        
        return result;
      } catch (error) {
        console.error("Failed to start video call:", error);
        // Make sure we clean up properly on failure
        if (service.localStream) {
          service.localStream.getTracks().forEach(track => track.stop());
        }
        throw error;
      }
    },
    answer: async (remoteOffer) => {
      try {
        // Ensure signaling connection is established
        await signalingManager.connect();
        await signalingManager.joinRoom(roomId, userId);
        
        const result = await service.answerCall(remoteOffer);
        return result;
      } catch (error) {
        console.error("Failed to answer video call:", error);
        // Make sure we clean up properly on failure
        if (service.localStream) {
          service.localStream.getTracks().forEach(track => track.stop());
        }
        throw error;
      }
    },
    end: () => {
      service.endCall();
      // Update call metadata
      updateCallMetadata(roomId, 'inactive');
    },
    get localStream() {
      return service.localStream;
    }
  };
};