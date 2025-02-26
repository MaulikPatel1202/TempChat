import React from 'react';

const AccessPrompt = ({ onRequestAccess, onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Microphone Access Required</h2>
        <p className="mb-4">
          To make or receive calls, please allow access to your microphone.
          Without microphone permission, you won't be able to communicate in calls.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onRequestAccess}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Allow Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessPrompt;