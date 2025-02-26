import React from 'react';

const AccessPrompt = ({ onRequestAccess, onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold text-red-600 mb-2">Microphone Access Required</h3>
        
        <p className="mb-4">
          Voice and video calls require microphone access. Please allow access when prompted by your browser.
        </p>
        
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h4 className="font-medium mb-2">How to allow access:</h4>
          <ol className="list-decimal pl-4 space-y-1 text-sm">
            <li>Look for the microphone icon in your browser's address bar</li>
            <li>Click the icon and select "Allow"</li>
            <li>Refresh the page if needed</li>
          </ol>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Note: You can change these permissions at any time in your browser settings.
        </p>
        
        <div className="flex justify-between">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onRequestAccess}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Request Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessPrompt;