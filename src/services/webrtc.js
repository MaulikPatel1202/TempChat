// New file: WebRTC service for audio/video calls

export default class WebRTCService {
  constructor(roomId, userId, isVideo, onRemoteStream, onCallStatusChange) {
    this.roomId = roomId;
    this.userId = userId;
    this.isVideo = isVideo;
    this.onRemoteStream = onRemoteStream;
    this.onCallStatusChange = onCallStatusChange;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = new MediaStream();
    this.candidates = [];
  }

  async startCall() {
    try {
      // First check if we have permissions by doing a permission check
      console.log("Requesting media permissions for call...");
      
      // Be more specific about audio constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: this.isVideo ? { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user"
        } : false
      };
      
      console.log("Using constraints:", JSON.stringify(constraints));
      
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Permissions granted, got local stream with tracks:", 
          this.localStream.getTracks().map(t => `${t.kind}:${t.label}:${t.enabled}`).join(', '));
      } catch (permissionError) {
        console.error("Permission error:", permissionError.name, permissionError.message);
        
        if (permissionError.name === 'NotAllowedError') {
          throw new Error("Microphone/camera access denied. Please allow access in your browser settings and try again.");
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error("No microphone or camera found on your device.");
        } else {
          throw permissionError;
        }
      }
      
      // Now that we have permissions, create the peer connection
      this.peerConnection = this.createPeerConnection();

      // Add local tracks to the connection
      console.log("Adding tracks to peer connection");
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
        console.log(`Added ${track.kind} track to peer connection`);
      });

      // Create an offer and set local description
      console.log("Creating offer");
      const offer = await this.peerConnection.createOffer();
      console.log("Setting local description");
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.onCallStatusChange) {
        this.onCallStatusChange('offer_sent');
      }
      
      return { localStream: this.localStream, offer };
    } catch (error) {
      console.error("Error starting call:", error);
      throw error;
    }
  }

  async answerCall(remoteOffer) {
    try {
      console.log("ANSWER CALL - Starting with remote offer:", remoteOffer);
      // Be more specific about audio constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: this.isVideo ? { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user"
        } : false
      };

      console.log("Answering call, requesting user media with constraints:", JSON.stringify(constraints));

      try {
        // Get user media first before creating peer connection
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Got local stream for answer with tracks:", 
          this.localStream.getTracks().map(t => `${t.kind}:${t.label}:${t.enabled}`).join(', '));
      } catch (permissionError) {
        console.error("Permission error while answering:", permissionError.name, permissionError.message);
        
        if (permissionError.name === 'NotAllowedError') {
          throw new Error("Microphone/camera access denied. Please allow access in your browser settings and try again.");
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error("No microphone or camera found on your device.");
        } else {
          throw permissionError;
        }
      }
      
      // Create peer connection after we have the local stream
      if (!this.peerConnection) {
        this.peerConnection = this.createPeerConnection();
        
        // Add local tracks to the connection
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
          console.log(`Added ${track.kind} track to peer connection for answer`);
        });
      }

      // IMPORTANT: Set remote description first - this is the correct order
      console.log("Setting remote description from offer", remoteOffer);
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(remoteOffer)
      );
      console.log("Remote description set successfully");

      // Then create answer
      console.log("Creating answer");
      const answer = await this.peerConnection.createAnswer();
      console.log("Answer created:", answer);
      console.log("Setting local description for answer");
      await this.peerConnection.setLocalDescription(answer);
      
      if (this.onCallStatusChange) {
        this.onCallStatusChange('answered');
      }
      
      return { localStream: this.localStream, answer };
    } catch (error) {
      console.error("Error answering call:", error);
      throw error;
    }
  }

  createPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add TURN server for more reliable connections - use a more reliable free TURN server
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10
    };
    
    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = event => {
      if (event.candidate) {
        // Store candidates for later transmission
        this.candidates.push(event.candidate);
        console.log("New ICE candidate", event.candidate);
      } else {
        console.log("ICE gathering complete");
      }
    };

    pc.ontrack = event => {
      console.log("Remote track received:", event.track.kind, event.track.readyState);
      console.log("Remote track received:", event.streams);
      if (event.streams && event.streams[0]) {
        // Clear any existing tracks of the same kind from the remoteStream
        const existingTracks = this.remoteStream.getTracks();
        for (const track of existingTracks) {
          if (track.kind === event.track.kind) {
            this.remoteStream.removeTrack(track);
          }
        }
        
        // Add the new track
        this.remoteStream.addTrack(event.track);
        console.log(`Added ${event.track.kind} track to remote stream`);
        
        // Ensure the UI gets updated with the remote stream
        if (this.onRemoteStream) {
          console.log("Calling onRemoteStream with remote stream");
          this.onRemoteStream(this.remoteStream);
        }
      }
      console.log("Remote stream now has tracks:", 
        this.remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', '));
    };

    // Add these event listeners for better debugging
    pc.oniceconnectionstatechange = e => {
      console.log("ICE connection state change:", pc.iceConnectionState);
    };
    
    pc.onsignalingstatechange = e => {
      console.log("Signaling state change:", pc.signalingState);
    };

    pc.onconnectionstatechange = e => {
      console.log("Connection state change:", pc.connectionState);
      
      // Add more detailed logs based on connection state
      switch(pc.connectionState) {
        case 'connected':
          console.log("WebRTC connection established successfully");
          if (this.onCallStatusChange) {
            this.onCallStatusChange('connected');
          }
          break;
        case 'disconnected':
          console.log("WebRTC connection disconnected");
          break;
        case 'failed':
          console.log("WebRTC connection failed - trying to restart ICE");
          if (this.peerConnection) {
            this.peerConnection.restartIce();
          }
          break;
      }
    };
    
    // Add this additional event handler
    pc.onicegatheringstatechange = e => {
      console.log("ICE gathering state:", pc.iceGatheringState);
    };
    
    return pc;
  }

  async addRemoteCandidate(candidate) {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        console.log("Adding ICE candidate immediately:", candidate);
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log("Storing ICE candidate for later");
        this.pendingCandidates = this.pendingCandidates || [];
        this.pendingCandidates.push(candidate);
      }
    } catch (error) {
      console.log("Error adding remote candidate", error);
    }
  }

  // Add a method to process pending candidates
  async processPendingCandidates() {
    if (this.pendingCandidates && this.pendingCandidates.length > 0) {
      console.log(`Processing ${this.pendingCandidates.length} pending ICE candidates`);
      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding pending ICE candidate:", error);
        }
      }
      this.pendingCandidates = [];
    }
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.onCallStatusChange) {
      this.onCallStatusChange('ended');
    }
  }

  async enableVideo() {
    try {
      // Request video stream only.
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      // Add new video tracks to the local stream.
      videoStream.getVideoTracks().forEach(track => {
        if (this.localStream) {
          this.localStream.addTrack(track);
        } else {
          this.localStream = new MediaStream([track]);
        }
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
      // Renegotiate with the remote peer by creating a new offer.
      if (this.peerConnection) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        // In production, send this offer via signaling to update the remote peer.
      }
      if (this.onCallStatusChange) {
        this.onCallStatusChange('video_enabled');
      }
      return videoStream;
    } catch (error) {
      console.error("Error enabling video:", error);
      throw error;
    }
  }
}
