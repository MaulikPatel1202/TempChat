
// This file helps debug WebRTC issues

// Add this script to index.html
function setupWebRTCDebugging() {
  // Monitor for changes in ICE connection state
  function monitorPeerConnection(pc) {
    if (!pc) return;

    const connectionStateEl = document.createElement('div');
    connectionStateEl.style.position = 'fixed';
    connectionStateEl.style.bottom = '10px';
    connectionStateEl.style.left = '10px';
    connectionStateEl.style.padding = '5px 10px';
    connectionStateEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    connectionStateEl.style.color = '#fff';
    connectionStateEl.style.borderRadius = '5px';
    connectionStateEl.style.zIndex = '9999';
    document.body.appendChild(connectionStateEl);

    function updateStatus() {
      connectionStateEl.innerHTML = `
        <div><strong>ICE:</strong> ${pc.iceConnectionState}</div>
        <div><strong>Connection:</strong> ${pc.connectionState}</div>
        <div><strong>Signaling:</strong> ${pc.signalingState}</div>
      `;
      
      // Color coding for status
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        connectionStateEl.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        connectionStateEl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      } else {
        connectionStateEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      }
    }

    pc.addEventListener('iceconnectionstatechange', updateStatus);
    pc.addEventListener('connectionstatechange', updateStatus);
    pc.addEventListener('signalingstatechange', updateStatus);
    
    updateStatus();
  }

  // Automatically find and monitor peer connections
  const originalRTCPeerConnection = window.RTCPeerConnection;
  window.RTCPeerConnection = function() {
    const pc = new originalRTCPeerConnection(...arguments);
    monitorPeerConnection(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log("Setting up WebRTC debugging");
  setupWebRTCDebugging();
});

// Add WebRTC stats gathering
window.getWebRTCStats = async (pc) => {
  if (!pc) {
    console.error("No peer connection provided");
    return;
  }
  
  try {
    const stats = await pc.getStats();
    const output = {};
    
    stats.forEach(report => {
      output[report.type] = output[report.type] || [];
      output[report.type].push(report);
    });
    
    console.log("WebRTC Stats:", output);
    return output;
  } catch (e) {
    console.error("Error getting WebRTC stats:", e);
  }
};