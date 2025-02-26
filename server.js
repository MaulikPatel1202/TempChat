const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1';

const app = express();
let server;
let wss;

if (!isVercel) {
  // Standard setup for local development
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });

  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, 'build')));

  // For any request that doesn't match one above, send back React's index.html file
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  // In Vercel, we'll use the serverless WebSocket API
  server = http.createServer(app);
  wss = new WebSocket.Server({ noServer: true });
  
  // Define route for WebSocket upgrade
  app.get('/socket', (req, res) => {
    res.end('WebSocket server');
  });
}

// Map to store connected clients by room
const rooms = new Map();

// Handle WebSocket connections
function handleConnection(ws) {
  console.log('New client connected');
  let clientRoomId = null;
  let clientId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data.type);

      if (data.type === 'join') {
        clientRoomId = data.roomId;
        clientId = data.userId;

        // Initialize room if it doesn't exist
        if (!rooms.has(clientRoomId)) {
          rooms.set(clientRoomId, new Map());
        }
        
        // Add client to room
        const room = rooms.get(clientRoomId);
        room.set(clientId, ws);
        
        console.log(`Client ${clientId} joined room ${clientRoomId}`);
        
        // Notify client they've joined successfully
        ws.send(JSON.stringify({
          type: 'joined',
          roomId: clientRoomId,
          userId: clientId
        }));
      } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate' || data.type === 'end') {
        // Forward message to other clients in the same room
        if (!clientRoomId) {
          console.error('Client tried to send message without joining a room first');
          return;
        }
        
        const room = rooms.get(clientRoomId);
        if (room) {
          // Send to all clients in the room except the sender
          room.forEach((client, id) => {
            if (id !== clientId && client.readyState === WebSocket.OPEN) {
              console.log(`Forwarding ${data.type} from ${clientId} to ${id}`);
              client.send(JSON.stringify({
                ...data,
                from: clientId
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (clientRoomId && clientId) {
      const room = rooms.get(clientRoomId);
      if (room) {
        room.delete(clientId);
        
        // Notify others in the room that this client left
        room.forEach((client, id) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'peer_left',
              userId: clientId
            }));
          }
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(clientRoomId);
          console.log(`Room ${clientRoomId} deleted (empty)`);
        }
      }
    }
  });
}

// Set up WebSocket handling
if (!isVercel) {
  wss.on('connection', handleConnection);
} else {
  // For Vercel, handle the upgrade manually
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/socket') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });
  
  wss.on('connection', handleConnection);
}

// Start the server if not in Vercel environment
if (!isVercel) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
  });
}

// Export the Express app for Vercel
module.exports = app;
