// src/components/CallInterface.js
import React from 'react';
import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react';

const CallInterface = ({ 
  isVoiceCallActive, 
  isVideoCallActive, 
  onToggleVoiceCall, 
  onToggleVideoCall 
}) => {
  return (
    <div className="flex space-x-3">
      <button 
        onClick={onToggleVoiceCall}
        className={`p-2 rounded-full transition-colors ${
          isVoiceCallActive 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-white text-green-600 hover:bg-green-50'
        }`}
        title={isVoiceCallActive ? "End voice call" : "Start voice call"}
      >
        {isVoiceCallActive ? <PhoneOff size={20} /> : <Phone size={20} />}
      </button>
      
      <button 
        onClick={onToggleVideoCall}
        className={`p-2 rounded-full transition-colors ${
          isVideoCallActive 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-white text-blue-600 hover:bg-blue-50'
        }`}
        title={isVideoCallActive ? "End video call" : "Start video call"}
      >
        {isVideoCallActive ? <VideoOff size={20} /> : <Video size={20} />}
      </button>
    </div>
  );
};

export default CallInterface;