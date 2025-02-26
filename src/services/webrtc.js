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
      const constraints = {
        audio: true,
        video: this.isVideo ? { width: 640, height: 480 } : false
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.peerConnection = this.createPeerConnection();

      // Add local tracks to the connection.
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create an offer and set local description.
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // In a real app, send the offer (offer.sdp and type) via signaling (e.g. WebSocket or Firestore) to the remote peer.
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
      const constraints = {
        audio: true,
        video: this.isVideo ? { width: 640, height: 480 } : false
      };

      // Get user media first before creating peer connection
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create peer connection after we have the local stream
      if (!this.peerConnection) {
        this.peerConnection = this.createPeerConnection();
        
        // Add local tracks to the connection
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // IMPORTANT: Set remote description first - this is the correct order
      console.log("Setting remote description from offer", remoteOffer);
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(remoteOffer)
      );

      // Then create answer
      console.log("Creating answer");
      const answer = await this.peerConnection.createAnswer();
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
        // Add TURN server for more reliable connections
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
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
      console.log("Remote track received:", event.streams);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          console.log("Adding remote track to remote stream:", track.kind);
          this.remoteStream.addTrack(track);
        });
        
        // Ensure the UI gets updated with the remote stream
        if (this.onRemoteStream) {
          console.log("Calling onRemoteStream with remote stream");
          this.onRemoteStream(this.remoteStream);
        }
      }
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
      if (pc.connectionState === 'connected' && this.onCallStatusChange) {
        this.onCallStatusChange('connected');
      }
    };
    
    return pc;
  }

  async addRemoteCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.log("Error adding remote candidate", error);
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
