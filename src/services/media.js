// src/services/media.js
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import WebRTCService from './webrtc';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, query, where, orderBy } from 'firebase/firestore';

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

export const initializeVoiceCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing voice call with WebRTC...");
  // false = audio only
  const service = new WebRTCService(roomId, userId, false, onRemoteStream, onCallStatusChange);
  
  // Setup signaling
  setupSignaling(roomId, userId, service);
  
  return {
    start: async () => {
      const result = await service.startCall();
      // Send offer to signaling channel
      await sendCallSignal(roomId, userId, {
        type: 'offer',
        offer: result.offer
      });
      return result;
    },
    answer: async (remoteOffer) => {
      const result = await service.answerCall(remoteOffer);
      // Send answer to signaling channel
      await sendCallSignal(roomId, userId, {
        type: 'answer',
        answer: result.answer
      });
      return result;
    },
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => {
      service.endCall();
      // Send end call signal
      sendCallSignal(roomId, userId, { type: 'end' });
    },
    enableVideo: async () => {
      const result = await service.enableVideo();
      // Send updated offer after video is enabled
      await sendCallSignal(roomId, userId, {
        type: 'offer',
        offer: await service.peerConnection.localDescription
      });
      return result;
    }
  };
};

export const initializeVideoCall = (roomId, userId, onRemoteStream, onCallStatusChange) => {
  console.log("Initializing video call with WebRTC...");
  // true = video enabled
  const service = new WebRTCService(roomId, userId, true, onRemoteStream, onCallStatusChange);
  
  // Setup signaling
  setupSignaling(roomId, userId, service);
  
  return {
    start: async () => {
      const result = await service.startCall();
      // Send offer to signaling channel
      await sendCallSignal(roomId, userId, {
        type: 'offer',
        offer: result.offer
      });
      return result;
    },
    answer: async (remoteOffer) => {
      const result = await service.answerCall(remoteOffer);
      // Send answer to signaling channel
      await sendCallSignal(roomId, userId, {
        type: 'answer',
        answer: result.answer
      });
      return result;
    },
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => {
      service.endCall();
      // Send end call signal
      sendCallSignal(roomId, userId, { type: 'end' });
    }
  };
};

// Signaling functions
async function sendCallSignal(roomId, userId, signalData) {
  try {
    await addDoc(collection(db, 'rooms', roomId, 'signals'), {
      from: userId,
      timestamp: new Date(),
      ...signalData
    });
  } catch (error) {
    console.error("Error sending call signal:", error);
  }
}

function setupSignaling(roomId, userId, webrtcService) {
  // Listen for signals in the room
  const q = query(
    collection(db, 'rooms', roomId, 'signals'),
    where('from', '!=', userId),
    orderBy('from'),
    orderBy('timestamp')
  );
  
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const signal = change.doc.data();
        
        // Process different signal types
        if (signal.type === 'offer') {
          console.log('Received offer signal');
          await webrtcService.answerCall(signal.offer);
          
          // Send ICE candidates that were collected
          webrtcService.candidates.forEach(async (candidate) => {
            await sendCallSignal(roomId, userId, {
              type: 'candidate',
              candidate
            });
          });
          webrtcService.candidates = [];
        } else if (signal.type === 'answer') {
          console.log('Received answer signal');
          await webrtcService.peerConnection.setRemoteDescription(signal.answer);
          
          // Send ICE candidates that were collected
          webrtcService.candidates.forEach(async (candidate) => {
            await sendCallSignal(roomId, userId, {
              type: 'candidate',
              candidate
            });
          });
          webrtcService.candidates = [];
        } else if (signal.type === 'candidate') {
          console.log('Received ICE candidate');
          await webrtcService.addRemoteCandidate(signal.candidate);
        } else if (signal.type === 'end') {
          console.log('Received end call signal');
          webrtcService.endCall();
        }
      }
    });
  });
}