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
        className={`p-2 rounded-full ${isVoiceCallActive ? 'bg-red-500 text-white' : 'bg-white text-indigo-700'}`}
        title={isVoiceCallActive ? "End voice call" : "Start voice call"}
      >
        {isVoiceCallActive ? <PhoneOff size={20} /> : <Phone size={20} />}
      </button>
      
      <button 
        onClick={onToggleVideoCall}
        className={`p-2 rounded-full ${isVideoCallActive ? 'bg-red-500 text-white' : 'bg-white text-indigo-700'}`}
        title={isVideoCallActive ? "End video call" : "Start video call"}
      >
        {isVideoCallActive ? <VideoOff size={20} /> : <Video size={20} />}
      </button>
    </div>
  );
};

export default CallInterface;