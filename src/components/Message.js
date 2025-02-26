// src/components/Message.js
import React from 'react';
import { Paperclip } from 'lucide-react';

const Message = ({ message, currentUserId }) => {
  const isCurrentUser = message.uid === currentUserId;
  
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 ${
          isCurrentUser 
            ? 'bg-indigo-100 text-gray-800' 
            : 'bg-white text-gray-800 border border-gray-200'
        }`}
      >
        <div className="text-xs text-gray-500 mb-1">
          {message.username} • {message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString() : 'Sending...'}
        </div>
        
        {message.mediaUrl && message.mediaType === 'image' && (
          <img 
            src={message.mediaUrl} 
            alt="Shared image" 
            className="max-w-full rounded mb-2"
          />
        )}
        
        {message.mediaUrl && message.mediaType === 'video' && (
          <video 
            src={message.mediaUrl} 
            controls 
            className="max-w-full rounded mb-2"
          />
        )}
        
        {message.mediaUrl && message.mediaType === 'audio' && (
          <audio 
            src={message.mediaUrl} 
            controls 
            className="max-w-full mb-2"
          />
        )}
        
        {message.mediaUrl && message.mediaType === 'file' && (
          <div className="bg-gray-100 p-2 rounded mb-2">
            <a 
              href={message.mediaUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center"
            >
              <Paperclip size={16} className="mr-1" />
              Download Attachment
            </a>
          </div>
        )}
        
        {message.text && <p>{message.text}</p>}
      </div>
    </div>
  );
};

export default Message;