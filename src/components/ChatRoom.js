// src/components/ChatRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listenForMessages, listenForRoomInfo, sendMessage } from '../services/chat';
import { uploadMedia, initializeVoiceCall, initializeVideoCall } from '../services/media';
import { X, Send, Paperclip, Video, Phone, Mic, MicOff, VideoOff, PhoneOff } from 'lucide-react';
import Message from './Message';
import MediaPreview from './MediaPreview';
import CallInterface from './CallInterface';

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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const callServiceRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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
    
    return () => {
      messagesUnsubscribe();
      roomUnsubscribe();
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
    // You might attach the remote stream to a video/audio element here.
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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
      await callServiceRef.current.end();
      setIsVoiceCallActive(false);
      setIsVideoCallActive(false);
    } else {
      try {
        const { localStream, offer } = await callServiceRef.current.start();
        // Display local stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        setIsVoiceCallActive(true);
      } catch (error) {
        console.error("Error starting voice call:", error);
        alert("Could not start voice call. Please check your microphone permissions.");
      }
    }
  };

  const handleToggleVideoCall = async () => {
    if (!callServiceRef.current) return;
    if (isVideoCallActive) {
      await callServiceRef.current.end();
      setIsVoiceCallActive(false);
      setIsVideoCallActive(false);
    } else {
      try {
        if (isVoiceCallActive) {
          // Upgrade existing audio call to video
          const videoStream = await callServiceRef.current.enableVideo();
          if (localVideoRef.current) {
            // Update local video with the new stream that includes video
            localVideoRef.current.srcObject = videoStream;
          }
          setIsVideoCallActive(true);
        } else {
          // Start new video call
          callServiceRef.current = initializeVideoCall(
            roomId, 
            user.uid, 
            setRemoteStream, 
            (status) => setCallStatus(status)
          );
          const { localStream } = await callServiceRef.current.start();
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          setIsVoiceCallActive(true);
          setIsVideoCallActive(true);
        }
      } catch (error) {
        console.error("Error starting video call:", error);
        alert("Could not start video call. Please check your camera permissions.");
      }
    }
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

  return (
    <div className="flex flex-col h-screen bg-gray-100">
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
      
      {/* WhatsApp-style Call UI */}
      {(isVoiceCallActive || isVideoCallActive) && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Call header with room info */}
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
            {/* Remote video (fills the screen) */}
            {isVideoCallActive && (
              <video 
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
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
            
            {/* Local video (small overlay) */}
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
          
          {/* Call controls (WhatsApp style) */}
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
      
      {/* Rest of the chat UI (only visible when not in a call) */}
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