import React from 'react';
import { Phone, Video, X } from 'lucide-react';

const CallNotification = ({ isVideo, caller, onAccept, onDecline }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 w-80 z-50 animate-slide-in">
      <div className="flex items-center mb-3">
        <div className="p-2 mr-3 rounded-full bg-indigo-100">
          {isVideo ? <Video className="text-indigo-600" /> : <Phone className="text-indigo-600" />}
        </div>
        <div className="flex-1">
          <h3 className="font-medium">Incoming {isVideo ? 'Video' : 'Voice'} Call</h3>
          <p className="text-sm text-gray-500">{caller || 'Someone'} is calling you</p>
        </div>
      </div>
      
      <div className="flex justify-between">
        <button 
          onClick={onDecline}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center text-red-500"
        >
          <X size={16} className="mr-1" /> Decline
        </button>
        <button 
          onClick={onAccept}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center"
        >
          {isVideo ? <Video size={16} className="mr-1" /> : <Phone size={16} className="mr-1" />} Accept
        </button>
      </div>
    </div>
  );
};

export default CallNotification;
