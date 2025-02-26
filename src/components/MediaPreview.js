// src/components/MediaPreview.js
import React from 'react';
import { X } from 'lucide-react';

const MediaPreview = ({ file, onRemove }) => {
  if (!file) return null;
  
  return (
    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center">
        <div className="flex-1 truncate">
          <span className="text-sm font-medium">Attaching: {file.name}</span>
          <span className="text-xs text-gray-500 ml-2">
            ({(file.size / 1024).toFixed(1)} KB)
          </span>
        </div>
        <button 
          onClick={onRemove}
          className="ml-2 text-red-500"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default MediaPreview;