import signalingManager from './signaling-manager';

class WebRTCService {
  constructor(roomId, userId, isVideo = false, onRemoteStream, onCallStatus) {
    this.roomId = roomId;
    this.userId = userId;
    this.isVideo = isVideo;
    this.onRemoteStream = onRemoteStream;
    this.onCallStatus = onCallStatus;
    this.localStream = null;
    this.peerConnection = null;
    this.remoteStream = new MediaStream();
    
    // Initialize WebRTC
    this.initializePeerConnection();
    
    // Setup signaling
    signalingManager.onMessage(this.handleSignalingMessage.bind(this));
  }
  
  initializePeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    };
    
    this.peerConnection = new RTCPeerConnection(configuration);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingManager.sendMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          roomId: this.roomId,
          from: this.userId
        });
      }
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState);
      
      switch(this.peerConnection.connectionState) {
        case "connected":
          this.onCallStatus("connected");
          break;
        case "disconnected":
        case "failed":
          this.onCallStatus("disconnected");
          break;
        case "closed":
          this.onCallStatus("ended");
          break;
        default:
          break;
      }
    };
    
    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      this.remoteStream.addTrack(event.track);
      this.onRemoteStream(this.remoteStream);
    };
  }
  
  async getLocalStream() {
    try {
      const constraints = {
        audio: true,
        video: this.isVideo
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to the peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }
  
  async startCall() {
    try {
      this.onCallStatus("starting");
      await this.getLocalStream();
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.onCallStatus("offer_sent");
      
      // Send offer through signaling
      signalingManager.sendMessage({
        type: 'offer',
        offer: offer,
        roomId: this.roomId,
        from: this.userId
      });
      
      return { localStream: this.localStream, offer: offer };
    } catch (error) {
      console.error("Error starting call:", error);
      throw error;
    }
  }
  
  async answerCall(offer) {
    try {
      this.onCallStatus("answering");
      await this.getLocalStream();
      
      // Set the remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // Send answer through signaling
      signalingManager.sendMessage({
        type: 'answer',
        answer: answer,
        roomId: this.roomId,
        from: this.userId
      });
      
      this.onCallStatus("answered");
      
      return { localStream: this.localStream, answer: answer };
    } catch (error) {
      console.error("Error answering call:", error);
      throw error;
    }
  }
  
  handleSignalingMessage(message) {
    // Only process messages for this room
    if (message.roomId !== this.roomId || message.from === this.userId) {
      return;
    }
    
    console.log("Received signaling message:", message.type);
    
    switch (message.type) {
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice-candidate':
        this.handleICECandidate(message);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  }
  
  async handleOffer(message) {
    try {
      if (this.peerConnection.signalingState !== "stable") {
        console.log("Ignoring offer in non-stable state");
        return;
      }
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }
  
  async handleAnswer(message) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
      this.onCallStatus("call_established");
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }
  
  async handleICECandidate(message) {
    try {
      if (message.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }
  
  async enableVideo() {
    try {
      if (!this.localStream) {
        console.error("No local stream available");
        return null;
      }
      
      // Check if video is already enabled
      if (this.localStream.getVideoTracks().length > 0) {
        console.log("Video is already enabled");
        return this.localStream;
      }
      
      // Get video stream
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Add video track to peer connection
      const videoTrack = videoStream.getVideoTracks()[0];
      this.localStream.addTrack(videoTrack);
      
      // Add to peer connection
      this.peerConnection.addTrack(videoTrack, this.localStream);
      
      // Update status
      this.onCallStatus("video_enabled");
      
      this.isVideo = true;
      
      return this.localStream;
    } catch (error) {
      console.error("Error enabling video:", error);
      throw error;
    }
  }
  
  endCall() {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Reset state
    this.localStream = null;
    this.remoteStream = new MediaStream();
    
    // Reinitialize peer connection for future calls
    this.initializePeerConnection();
    
    // Update status
    this.onCallStatus("ended");
  }
}

export default WebRTCService;
