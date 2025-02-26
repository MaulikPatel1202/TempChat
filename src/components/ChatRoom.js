// src/components/ChatRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listenForMessages, listenForRoomInfo, sendMessage } from '../services/chat';
import { uploadMedia, initializeVoiceCall, initializeVideoCall } from '../services/media';
import { X, Send, Paperclip, Video } from 'lucide-react'; // Fixed: Added Video import
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const voiceCallRef = useRef(null);
  const videoCallRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    // Initialize call handlers (in a real app, this would set up WebRTC)
    voiceCallRef.current = initializeVoiceCall();
    videoCallRef.current = initializeVideoCall();
    
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
      
      // Clean up calls on component unmount
      if (isVoiceCallActive && voiceCallRef.current) {
        voiceCallRef.current.end();
      }
      
      if (isVideoCallActive && videoCallRef.current) {
        videoCallRef.current.end();
      }
    };
  }, [roomId, user, navigate, isVoiceCallActive, isVideoCallActive]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleToggleVoiceCall = () => {
    if (isVoiceCallActive) {
      voiceCallRef.current.end();
    } else {
      if (isVideoCallActive) {
        videoCallRef.current.end();
        setIsVideoCallActive(false);
      }
      voiceCallRef.current.start();
    }
    
    setIsVoiceCallActive(!isVoiceCallActive);
  };

  const handleToggleVideoCall = () => {
    if (isVideoCallActive) {
      videoCallRef.current.end();
    } else {
      if (isVoiceCallActive) {
        voiceCallRef.current.end();
        setIsVoiceCallActive(false);
      }
      videoCallRef.current.start();
    }
    
    setIsVideoCallActive(!isVideoCallActive);
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
      
      {/* Video Call Area (would be implemented with WebRTC) */}
      {isVideoCallActive && (
        <div className="bg-gray-800 h-48 flex items-center justify-center">
          <div className="text-white text-center">
            <Video size={40} className="mx-auto mb-2" />
            <p>Video call would appear here (WebRTC)</p>
          </div>
        </div>
      )}
      
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
    </div>
  );
};

export default ChatRoom;