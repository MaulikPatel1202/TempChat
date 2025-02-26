// src/components/ChatRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listenForMessages, listenForRoomInfo, sendMessage } from '../services/chat';
import { uploadMedia, initializeVoiceCall, initializeVideoCall, listenForCallMetadata, updateCallMetadata } from '../services/media';
import { X, Send, Paperclip, Video, Phone, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import Message from './Message';
import MediaPreview from './MediaPreview';
import CallInterface from './CallInterface';
import CallNotification from './CallNotification';
import AccessPrompt from './AccessPrompt';

const ChatRoom = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem('username') || 'Anonymous');
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [mediaUpload, setMediaUpload] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // e.g. idle, offer_sent, answered, ended
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showAccessPrompt, setShowAccessPrompt] = useState(false);
  const [permissionState, setPermissionState] = useState('unknown'); // 'unknown', 'granted', 'denied'
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const callServiceRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoContainerRef = useRef(null);
  const callSoundRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    // Initialize call service as audio-only initially.
    callServiceRef.current = initializeVoiceCall(
      roomId, 
      user.uid, 
      setRemoteStream, 
      (status) => setCallStatus(status)
    );
    
    // Listen for messages and room info
    const messagesUnsubscribe = listenForMessages(roomId, (newMessages) => {
      setMessages(newMessages);
    });
    
    const roomUnsubscribe = listenForRoomInfo(roomId, (roomData) => {
      if (roomData) {
        setRoomInfo(roomData);
      } else {
        alert('Room not found or has expired');
        navigate('/');
      }
    });

    // Listen for incoming calls
    const callMetadataUnsubscribe = listenForCallMetadata(
      roomId, 
      user.uid, 
      (callData) => {
        if (callData.status === 'calling' && !isVoiceCallActive && !isVideoCallActive) {
          // Show incoming call notification
          setIncomingCall(callData);
          // Play call sound
          playCallSound();
        } else if (callData.isActive === false) {
          // Call was ended
          setIncomingCall(null);
          stopCallSound();
        }
      }
    );
    
    // Get username for caller display
    const callerDisplayName = localStorage.getItem('username') || 'User';
    
    return () => {
      messagesUnsubscribe();
      roomUnsubscribe();
      callMetadataUnsubscribe();
      stopCallSound();
      // End the active call on component unmount.
      if (callServiceRef.current) {
        callServiceRef.current.end();
      }
    };
  }, [roomId, user, navigate]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Handle remote stream changes and attach to video elements
    if (remoteStream && remoteVideoRef.current) {
      console.log("Setting remote stream to video element:", remoteStream);
      
      // Make sure any audio tracks are enabled and unmuted
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log("Remote stream has audio tracks:", audioTracks.length);
        audioTracks.forEach(track => {
          track.enabled = true;
          console.log(`Audio track enabled: ${track.enabled}, readyState: ${track.readyState}`);
        });
      } else {
        console.warn("Remote stream has no audio tracks - this could be a problem for calls");
      }
      
      // Set the remote stream to the video element
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Handle autoplay issues
      remoteVideoRef.current.muted = false; // Make sure it's not muted
      
      const playPromise = remoteVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Remote media playback started successfully");
            
            // Double-check that audio is working
            if (remoteStream.getAudioTracks().length > 0) {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const source = audioContext.createMediaStreamSource(remoteStream);
              const analyser = audioContext.createAnalyser();
              source.connect(analyser);
              
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              
              let silenceCounter = 0;
              const silenceCheckInterval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                
                // Check if there's any audio signal
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                
                console.log("Audio level:", average);
                if (average < 1) {
                  silenceCounter++;
                } else {
                  silenceCounter = 0;
                }
                
                // If we detect silence for too long, show a warning
                if (silenceCounter > 10) {
                  console.warn("Audio seems to be silent - might be a connection issue");
                  clearInterval(silenceCheckInterval);
                  
                  // Show audio troubleshooting hint
                  const troubleshootDiv = document.createElement('div');
                  troubleshootDiv.className = 'absolute top-24 left-0 right-0 text-center';
                  troubleshootDiv.innerHTML = `
                    <div class="bg-yellow-600 text-white px-4 py-2 mx-auto inline-block rounded">
                      Can't hear anything? Try reconnecting or check your speaker volume.
                    </div>
                  `;
                  remoteVideoContainerRef.current?.appendChild(troubleshootDiv);
                  
                  // Remove after 10 seconds
                  setTimeout(() => troubleshootDiv.remove(), 10000);
                }
                
                // Don't check forever
                if (silenceCounter > 20) {
                  clearInterval(silenceCheckInterval);
                }
              }, 1000);
              
              // Clean up after 30 seconds
              setTimeout(() => clearInterval(silenceCheckInterval), 30000);
            }
          })
          .catch(error => {
            console.warn("Autoplay prevented:", error);
            
            // Create a user gesture-driven play button
            const playButton = document.createElement('button');
            playButton.textContent = 'Click to enable audio';
            playButton.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 bg-white text-black py-2 px-4 rounded-full shadow-lg z-50';
            
            playButton.onclick = () => {
              remoteVideoRef.current.play()
                .then(() => {
                  console.log("Media playback started after user interaction");
                  playButton.remove();
                })
                .catch(err => {
                  console.error("Still couldn't play media:", err);
                  playButton.textContent = 'Audio playback failed, try again';
                });
            };
            
            if (remoteVideoContainerRef.current) {
              remoteVideoContainerRef.current.appendChild(playButton);
            }
          });
      }
      
      // Actually set the stream to the video element
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Fix for video display - check for actual video tracks
      const hasVideoTracks = remoteStream.getVideoTracks().length > 0;
      console.log(`Remote stream has video tracks: ${hasVideoTracks}`);
      
      // Get audio track information again for display and debugging
      const hasAudioTracks = audioTracks.length > 0;
      console.log(`Remote stream has audio tracks: ${hasAudioTracks}`);
      
      // We already enabled audio tracks above, no need to do it again
      
      // Show/hide video container based on tracks
      if (remoteVideoContainerRef.current) {
        remoteVideoContainerRef.current.style.display = hasVideoTracks ? 'block' : 'none';
      }
      
      // Update fallback visibility
      const fallbackElement = document.getElementById('remote-video-fallback');
      if (fallbackElement) {
        fallbackElement.style.display = (isVideoCallActive && !hasVideoTracks) ? 'flex' : 'none';
      }
      
      // Special check for audio-only calls
      if (!isVideoCallActive && hasAudioTracks) {
        console.log("Audio-only call has active audio tracks");
      }
    }
    
    // Add debug info in development mode
    if (process.env.NODE_ENV !== 'production') {
      // Create or update debug info display
      let debugEl = document.getElementById('webrtc-debug-info');
      if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'webrtc-debug-info';
        debugEl.style.position = 'fixed';
        debugEl.style.bottom = '10px';
        debugEl.style.left = '10px';
        debugEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
        debugEl.style.color = 'white';
        debugEl.style.padding = '8px';
        debugEl.style.borderRadius = '4px';
        debugEl.style.fontSize = '12px';
        debugEl.style.zIndex = '9999';
        document.body.appendChild(debugEl);
      }
      
      debugEl.innerHTML = `
        <div>Call Status: ${callStatus}</div>
        <div>Audio: ${remoteStream?.getAudioTracks().length > 0 ? 'Yes' : 'No'}</div>
        <div>Video: ${remoteStream?.getVideoTracks().length > 0 ? 'Yes' : 'No'}</div>
        <div>Local Muted: ${isAudioMuted ? 'Yes' : 'No'}</div>
      `;
    }
  }, [remoteStream, callStatus, isAudioMuted, isVideoCallActive]);

  // Add this new effect to monitor media permission issues
  useEffect(() => {
    // Helper function to check permissions
    const checkMediaPermissions = async () => {
      try {
        console.log("Testing media permissions...");
        // Start with just audio since that's most important for calls
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Audio permission granted");
        
        // Stop audio tracks right away
        audioStream.getTracks().forEach(track => track.stop());
        
        // Now try video if needed
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log("Video permission granted");
          videoStream.getTracks().forEach(track => track.stop());
        } catch (videoErr) {
          console.log("Video permission not granted, but that's optional:", videoErr.name);
          // Just a warning for video, not critical
          if (videoErr.name === 'NotAllowedError') {
            console.warn("Video permission denied, but calls can still work with audio only");
          }
        }
      } catch (err) {
        console.error("Media permission issue:", err.name, err.message);
        
        if (err.name === 'NotAllowedError') {
          // Show a modal or more prominent UI element for permission request
          const permissionModal = document.createElement('div');
          permissionModal.style.position = 'fixed';
          permissionModal.style.top = '0';
          permissionModal.style.left = '0';
          permissionModal.style.right = '0';
          permissionModal.style.backgroundColor = 'rgba(255,255,255,0.9)';
          permissionModal.style.padding = '20px';
          permissionModal.style.zIndex = '9999';
          permissionModal.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
          permissionModal.innerHTML = `
            <div style="text-align:center">
              <h3 style="color:red">Microphone Access Required</h3>
              <p>Please allow microphone access in your browser to enable calls.</p>
              <p>Look for the microphone icon in your browser's address bar.</p>
              <button id="retry-permissions" style="background:#4F46E5;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer">
                Try Again
              </button>
              <p style="font-size:12px;margin-top:10px">
                You can also manually allow microphone access by clicking on the <span style="background:#eee;padding:2px 5px;border-radius:2px">🎤</span>
                icon in your browser's address bar.
              </p>
            </div>
          `;
          
          document.body.appendChild(permissionModal);
          
          document.getElementById('retry-permissions').addEventListener('click', () => {
            permissionModal.remove();
            checkMediaPermissions();
          });
        }
      }
    };

    checkMediaPermissions();
  }, []);

  useEffect(() => {
    // Check initial permission status if possible
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' })
        .then(permissionStatus => {
          console.log("Initial microphone permission state:", permissionStatus.state);
          setPermissionState(permissionStatus.state);
          
          // Listen for changes
          permissionStatus.onchange = () => {
            console.log("Permission state changed to:", permissionStatus.state);
            setPermissionState(permissionStatus.state);
          };
        })
        .catch(err => console.log("Could not query permission status:", err));
    }
  }, []);

  const requestMicrophoneAccess = async () => {
    setShowAccessPrompt(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
      return true;
    } catch (err) {
      console.error("Error requesting microphone access:", err);
      setPermissionState('denied');
      return false;
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !mediaUpload) || !user || isLoading) return;
    
    setIsLoading(true);
    
    try {
      let mediaUrl = null;
      let mediaType = null;
      
      // Handle media upload if present
      if (mediaUpload) {
        const mediaData = await uploadMedia(roomId, mediaUpload);
        mediaUrl = mediaData.url;
        mediaType = mediaData.type;
      }
      
      await sendMessage(roomId, user.uid, username, newMessage.trim(), mediaUrl, mediaType);
      
      setNewMessage('');
      setMediaUpload(null);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setMediaUpload(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleToggleVoiceCall = async () => {
    if (!callServiceRef.current) return;
    
    if (isVoiceCallActive) {
      // End existing call
      await callServiceRef.current.end();
      setIsVoiceCallActive(false);
      setIsVideoCallActive(false);
    } else {
      // Check permissions before starting
      if (permissionState === 'denied') {
        setShowAccessPrompt(true);
        return;
      }
      
      try {
        setCallStatus('connecting');
        
        const { localStream, offer } = await callServiceRef.current.start();
        
        // Display local stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        
        setIsVoiceCallActive(true);
      } catch (error) {
        console.error("Error starting voice call:", error);
        
        if (error.name === 'NotAllowedError' || 
            error.message.includes('Permission') || 
            error.message.includes('denied')) {
          setShowAccessPrompt(true);
        } else {
          alert(`Could not start voice call: ${error.message}`);
        }
        
        setCallStatus('failed');
      }
    }
  };

  const handleToggleVideoCall = async () => {
    if (!callServiceRef.current) return;
    
    if (isVideoCallActive) {
      // End existing call
      await callServiceRef.current.end();
      setIsVoiceCallActive(false);
      setIsVideoCallActive(false);
    } else {
      // Check permissions before starting
      if (permissionState === 'denied') {
        setShowAccessPrompt(true);
        return;
      }
      
      try {
        setCallStatus('connecting');
        
        const { localStream, offer } = await callServiceRef.current.start();
        
        // Display local stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        
        setIsVideoCallActive(true);
      } catch (error) {
        console.error("Error starting video call:", error);
        
        if (error.name === 'NotAllowedError' || 
            error.message.includes('Permission') || 
            error.message.includes('denied')) {
          setShowAccessPrompt(true);
        } else {
          alert(`Could not start video call: ${error.message}`);
        }
        
        setCallStatus('failed');
      }
    }
  };

  const handleAcceptCall = async () => {
    stopCallSound();
    
    if (!callServiceRef.current) return;
    
    try {
      // Get local media and mark as answered
      console.log("Starting media for accepted call");
      const { localStream } = await callServiceRef.current.start();
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        console.log("Local stream set to video element");
      }
      
      setIsVoiceCallActive(true);
      setIncomingCall(null);
      
      // Update call metadata as active
      await updateCallMetadata(roomId, 'active');
      console.log("Call accepted and active");
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Could not accept call. Please check your device permissions.");
    }
  };

  const handleDeclineCall = async () => {
    stopCallSound();
    setIncomingCall(null);
    
    // Update call metadata as inactive
    await updateCallMetadata(roomId, 'inactive');
  };

  const toggleAudio = () => {
    if (callServiceRef.current?.localStream) {
      const audioTrack = callServiceRef.current.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (callServiceRef.current?.localStream) {
      const videoTrack = callServiceRef.current.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const playCallSound = () => {
    if (!callSoundRef.current) {
      // Use a default tone from an available public URL
      callSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2304/2304-preview.mp3');
      callSoundRef.current.loop = true;
    }
    callSoundRef.current.play().catch(e => {
      console.log("Audio play error:", e);
      // Fallback - create a simple beep using AudioContext if available
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 500);
      } catch (err) {
        console.log("Fallback audio also failed:", err);
      }
    });
  };

  const stopCallSound = () => {
    if (callSoundRef.current) {
      callSoundRef.current.pause();
      callSoundRef.current.currentTime = 0;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Permission prompt */}
      {showAccessPrompt && (
        <AccessPrompt 
          onRequestAccess={requestMicrophoneAccess}
          onDismiss={() => setShowAccessPrompt(false)}
        />
      )}
      
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Room: {roomId}</h1>
            {roomInfo && (
              <p className="text-sm opacity-80">Created by {roomInfo.creatorName}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <CallInterface 
              isVoiceCallActive={isVoiceCallActive}
              isVideoCallActive={isVideoCallActive}
              onToggleVoiceCall={handleToggleVoiceCall}
              onToggleVideoCall={handleToggleVideoCall}
            />
            <button 
              onClick={() => navigate('/')}
              className="p-2 rounded-full bg-white text-indigo-700"
              title="Leave room"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Call Notification */}
      {incomingCall && (
        <CallNotification
          isVideo={incomingCall.isVideo}
          caller={roomInfo?.creatorName || 'Someone'}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
      
      {/* WhatsApp-style Call UI */}
      {(isVoiceCallActive || isVideoCallActive) && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Call header */}
          <div className="bg-gray-900 p-4 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-75">
                  {isVideoCallActive ? "Video call" : "Voice call"}
                </p>
                <h3 className="text-lg font-bold">{roomInfo?.creatorName || 'Chat room'}</h3>
              </div>
              <button 
                onClick={() => {
                  callServiceRef.current.end();
                  setIsVoiceCallActive(false);
                  setIsVideoCallActive(false);
                }}
                className="rounded-full p-2 bg-red-500 text-white"
                title="End call"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Call content */}
          <div className="flex-1 relative flex items-center justify-center">
            <div ref={remoteVideoContainerRef} className="absolute inset-0">
              <video 
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Audio debug info */}
              <div className="absolute top-16 left-4 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
                Audio status: {remoteStream?.getAudioTracks().length > 0 ? 'Available' : 'No audio'}
              </div>
            </div>
            
            {/* Fallback when remote video is missing */}
            {isVideoCallActive && (
              <div id="remote-video-fallback" className="absolute inset-0 w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="h-24 w-24 mx-auto rounded-full bg-indigo-500 flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold">{roomInfo?.creatorName?.slice(0, 1) || '?'}</span>
                  </div>
                  <p>Waiting for video...</p>
                  <p className="text-sm opacity-75">The other person may have video disabled</p>
                </div>
              </div>
            )}
            
            {/* Audio call background */}
            {isVoiceCallActive && !isVideoCallActive && (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="h-32 w-32 rounded-full bg-indigo-500 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{roomInfo?.creatorName?.slice(0, 1) || '?'}</span>
                </div>
              </div>
            )}
            
            {/* Connection status */}
            <div className="absolute top-4 left-0 right-0 text-center text-white">
              <p className="px-4 py-1 bg-black bg-opacity-50 rounded-full inline-block">
                {callStatus === 'offer_sent' && "Calling..."}
                {callStatus === 'answered' && "Connected"}
                {callStatus === 'video_enabled' && "Video enabled"}
              </p>
            </div>
            
            {/* Local video overlay */}
            <div className="absolute right-4 top-4 w-1/4 max-w-xs rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <video 
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full ${!isVideoEnabled || !isVideoCallActive ? 'hidden' : ''}`}
              />
              {(!isVideoEnabled && isVideoCallActive) && (
                <div className="bg-gray-800 aspect-video flex items-center justify-center">
                  <VideoOff size={30} className="text-white opacity-75" />
                </div>
              )}
            </div>
          </div>
          
          {/* Call controls */}
          <div className="bg-gray-900 p-6 flex justify-center space-x-8">
            <button 
              onClick={toggleAudio}
              className={`p-4 rounded-full ${isAudioMuted ? 'bg-red-500' : 'bg-gray-700'}`}
              title={isAudioMuted ? "Unmute" : "Mute"}
            >
              {isAudioMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
            </button>
            {isVideoCallActive && (
              <button 
                onClick={toggleVideo}
                className={`p-4 rounded-full ${!isVideoEnabled ? 'bg-red-500' : 'bg-gray-700'}`}
                title={isVideoEnabled ? "Turn off video" : "Turn on video"}
              >
                {!isVideoEnabled ? <VideoOff size={24} className="text-white" /> : <Video size={24} className="text-white" />}
              </button>
            )}
            <button 
              onClick={() => {
                callServiceRef.current.end();
                setIsVoiceCallActive(false);
                setIsVideoCallActive(false);
              }}
              className="p-4 rounded-full bg-red-500"
              title="End call"
            >
              <PhoneOff size={24} className="text-white" />
            </button>
          </div>
        </div>
      )}
      
      {/* Chat area when not in call */}
      {!isVoiceCallActive && !isVideoCallActive && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                <p>No messages yet. Be the first to send a message!</p>
              </div>
            ) : (
              messages.map((message) => (
                <Message 
                  key={message.id} 
                  message={message} 
                  currentUserId={user.uid} 
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Media Preview */}
          {mediaUpload && (
            <MediaPreview 
              file={mediaUpload} 
              onRemove={() => setMediaUpload(null)} 
            />
          )}
          
          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="bg-white p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <button 
                type="button"
                onClick={triggerFileInput}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
              
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Type a message..."
                disabled={isLoading}
              />
              
              <button 
                type="submit"
                disabled={(!newMessage.trim() && !mediaUpload) || isLoading}
                className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                title="Send message"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatRoom;