// src/services/media.js
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import WebRTCService from './webrtc';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, query, where, orderBy, limit } from 'firebase/firestore';

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
    await setDoc(doc(db, 'rooms', roomId, 'callMetadata', 'current'), {
      from: userId,
      timestamp: new Date(),
      isActive: true,
      ...callData
    });
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
  const service = new WebRTCService(roomId, userId, false, onRemoteStream, onCallStatusChange);
  
  // Setup signaling
  const signalUnsub = setupSignaling(roomId, userId, service);
  
  return {
    start: async () => {
      try {
        const result = await service.startCall();
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
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => {
      service.endCall();
      // Clean up signaling listener
      if (signalUnsub) signalUnsub();
      // Send end call signal
      sendCallSignal(roomId, userId, { type: 'end' });
      // Update call metadata
      updateCallMetadata(roomId, 'inactive');
    },
    enableVideo: async () => {
      const result = await service.enableVideo();
      // Send updated offer after video is enabled
      await sendCallSignal(roomId, userId, {
        type: 'offer',
        offer: await service.peerConnection.localDescription
      });
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
  
  // Setup signaling
  const signalUnsub = setupSignaling(roomId, userId, service);
  
  return {
    start: async () => {
      try {
        const result = await service.startCall();
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
    addCandidate: async (candidate) => await service.addRemoteCandidate(candidate),
    end: () => {
      service.endCall();
      // Clean up signaling listener
      if (signalUnsub) signalUnsub();
      // Send end call signal
      sendCallSignal(roomId, userId, { type: 'end' });
      // Update call metadata
      updateCallMetadata(roomId, 'inactive');
    },
    get localStream() {
      return service.localStream;
    }
  };
};

// Signaling functions
async function sendCallSignal(roomId, userId, signalData) {
  try {
    // Add a unique ID to prevent duplicate processing
    const signalId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await addDoc(collection(db, 'rooms', roomId, 'signals'), {
      id: signalId,
      from: userId,
      timestamp: new Date(),
      ...signalData
    });
    
    console.log(`Sent signal: ${signalData.type}`);
    return true;
  } catch (error) {
    console.error("Error sending call signal:", error);
    return false;
  }
}

// Improve signaling function
function setupSignaling(roomId, userId, webrtcService) {
  // Create a timestamp 10 minutes in the past to limit query results but ensure we get recent signals
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  // Use a simpler query that just looks at recent signals
  const q = query(
    collection(db, 'rooms', roomId, 'signals'),
    where('timestamp', '>', tenMinutesAgo),
    orderBy('timestamp', 'asc')
  );
  
  console.log(`Setting up signaling for room ${roomId}, user ${userId}`);
  
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const signal = change.doc.data();
        
        // Skip our own messages
        if (signal.from === userId) {
          return;
        }
        
        console.log('Received signal:', signal.type, 'from:', signal.from);
        
        // Process different signal types
        if (signal.type === 'offer') {
          try {
            console.log('Processing offer signal');
            await webrtcService.answerCall(signal.offer);
            console.log('Created answer to offer');
            
            // Get the answer from the peer connection
            const answer = webrtcService.peerConnection.localDescription;
            
            // Send answer back
            await sendCallSignal(roomId, userId, {
              type: 'answer',
              answer
            });
            console.log('Sent answer to offer');
            
            // Process any pending ICE candidates
            await webrtcService.processPendingCandidates();
            
            // Add slight delay before sending ICE candidates to ensure answer is processed
            setTimeout(async () => {
              // Send any ICE candidates we've collected
              if (webrtcService.candidates.length > 0) {
                console.log(`Sending ${webrtcService.candidates.length} ICE candidates after answering`);
                for (const candidate of webrtcService.candidates) {
                  await sendCallSignal(roomId, userId, {
                    type: 'candidate',
                    candidate
                  });
                }
                webrtcService.candidates = [];
              }
            }, 500);
          } catch (err) {
            console.error("Error processing offer:", err);
          }
        } else if (signal.type === 'answer') {
          console.log('Processing answer signal');
          try {
            // Make sure peerConnection exists before setting remote description
            if (webrtcService.peerConnection) {
              await webrtcService.peerConnection.setRemoteDescription(
                new RTCSessionDescription(signal.answer)
              );
              console.log("Remote description set successfully from answer");
              
              // Process any pending ICE candidates after setting remote description
              await webrtcService.processPendingCandidates();
              
              // After setting remote description, send any pending ICE candidates
              if (webrtcService.candidates.length > 0) {
                console.log(`Sending ${webrtcService.candidates.length} ICE candidates after answer`);
                for (const candidate of webrtcService.candidates) {
                  await sendCallSignal(roomId, userId, {
                    type: 'candidate',
                    candidate
                  });
                }
                webrtcService.candidates = [];
              }
            } else {
              console.error("PeerConnection not established when answer received");
            }
          } catch (err) {
            console.error("Error processing answer:", err);
          }
        } else if (signal.type === 'candidate') {
          console.log('Processing ICE candidate');
          try {
            // Make sure we have a peer connection and add candidate
            await webrtcService.addRemoteCandidate(signal.candidate);
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        } else if (signal.type === 'end') {
          console.log('Processing end call signal');
          webrtcService.endCall();
        }
      }
    });
  }, (error) => {
    console.error("Signaling error:", error);
  });
}