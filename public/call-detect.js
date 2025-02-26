
// src/components/CallNotification.js

// This will be loaded in the HTML to help detect video status

function setupVideoDetection() {
  setInterval(() => {
    const remoteVideo = document.querySelector('#remote-video');
    const fallbackUI = document.querySelector('#remote-video-fallback');
    
    if (!remoteVideo || !fallbackUI) return;
    
    // Check if video is actually playing
    const isVideoPlaying = 
      remoteVideo.currentTime > 0 && 
      !remoteVideo.paused && 
      !remoteVideo.ended && 
      remoteVideo.readyState > 2;
      
    if (isVideoPlaying) {
      fallbackUI.style.display = 'none';
    } else {
      fallbackUI.style.display = 'flex';
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', setupVideoDetection);