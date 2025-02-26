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
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.peerConnection = this.createPeerConnection();

      // Add local tracks.
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Set remote offer.
      await this.peerConnection.setRemoteDescription(remoteOffer);

      // Create answer.
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
      ]
    };
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = event => {
      if (event.candidate) {
        // Store candidates to be sent once connection is established
        this.candidates.push(event.candidate);
        // In production, candidates would be sent via signaling channel
        // This is now handled in the sendCallSignal function in media.js
      }
    };

    pc.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream.addTrack(track);
      });
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
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
