
// This file allows WebSockets to work on Vercel
const { Server } = require('ws');
const { parse } = require('url');

const rooms = new Map();

module.exports = (req, res) => {
  // Check if this is a WebSocket request
  const { pathname } = parse(req.url);
  
  if (pathname !== '/api/socket') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  
  const wss = new Server({ noServer: true });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    let clientRoomId = null;
    let clientId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
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
              if (id !== clientId && client.readyState === 1) { // 1 = OPEN
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
            if (client.readyState === 1) {
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
  });

  // Upgrade the HTTP request to WebSocket
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
    wss.emit('connection', ws, req);
  });
};