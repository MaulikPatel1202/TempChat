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
  setupSignaling(roomId, userId, service);
  
  return {
    start: async () => {
      const result = await service.startCall();
      // Send offer to signaling channel
      await sendCallSignal(roomId, userId, {
        type: 'offer',
        offer: result.offer
      });
      // Update call metadata for notifications
      await sendCallMetadata(roomId, userId, {
        isVideo: false,
        status: 'calling'
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
      // Update call metadata for notifications
      await sendCallMetadata(roomId, userId, {
        isVideo: true,
        status: 'calling'
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
      // Update call metadata
      updateCallMetadata(roomId, 'inactive');
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

// Update the signaling query to avoid index issues

function setupSignaling(roomId, userId, webrtcService) {
  // Simpler query that doesn't require a composite index
  const q = query(
    collection(db, 'rooms', roomId, 'signals'),
    where('from', '!=', userId),
    orderBy('timestamp') // Only order by timestamp, not multiple fields
  );
  
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const signal = change.doc.data();
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
            }, 1000);
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
            // Make sure we have a peer connection before adding candidates
            if (webrtcService.peerConnection && 
                webrtcService.peerConnection.remoteDescription && 
                webrtcService.peerConnection.remoteDescription.type) {
              await webrtcService.addRemoteCandidate(signal.candidate);
            } else {
              // Store the candidate for later if we're not ready yet
              console.log("Storing ICE candidate for later");
              webrtcService.pendingCandidates = webrtcService.pendingCandidates || [];
              webrtcService.pendingCandidates.push(signal.candidate);
            }
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        } else if (signal.type === 'end') {
          console.log('Processing end call signal');
          webrtcService.endCall();
        }
      }
    });
  });
}