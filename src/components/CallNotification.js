import React from 'react';
import { Video, Phone } from 'lucide-react';

const CallNotification = ({ isVideo, caller, onAccept, onDecline }) => {
  return (
    <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {isVideo ? (
            <Video className="mr-2" size={24} />
          ) : (
            <Phone className="mr-2" size={24} />
          )}
          <div>
            <p className="font-medium">{isVideo ? 'Incoming video call' : 'Incoming voice call'}</p>
            <p className="text-sm opacity-90">from {caller}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onDecline}
            className="px-4 py-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-1 bg-green-500 hover:bg-green-600 rounded-full text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallNotification;
