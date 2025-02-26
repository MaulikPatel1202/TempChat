// src/components/LandingPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInAnonymousUser } from '../services/auth';
import { createRoom, getRecentRooms } from '../services/chat';

const LandingPage = ({ user }) => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [recentRooms, setRecentRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecentRooms();
    }
  }, [user]);

  const fetchRecentRooms = async () => {
    try {
      const rooms = await getRecentRooms();
      setRecentRooms(rooms);
    } catch (error) {
      console.error("Error fetching recent rooms:", error);
    }
  };

  const handleCreateRoom = async () => {
    if (!username) return;
    
    setLoading(true);
    localStorage.setItem('username', username);
    
    try {
      let currentUser = user;
      
      if (!currentUser) {
        currentUser = await signInAnonymousUser();
      }
      
      const newRoomId = await createRoom(currentUser.uid, username);
      navigate(`/chat/${newRoomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!username || !roomId) return;
    
    setLoading(true);
    localStorage.setItem('username', username);
    
    try {
      if (!user) {
        await signInAnonymousUser();
      }
      
      navigate(`/chat/${roomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-indigo-700 mb-6">Ephemeral Chat</h1>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Choose a display name
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Your name"
          />
        </div>
        
        <div className="flex flex-col space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-indigo-700 mb-3">Create a new room</h2>
            <button
              onClick={handleCreateRoom}
              disabled={!username || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-indigo-700 mb-3">Join existing room</h2>
            <div className="flex">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Room ID"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!username || !roomId || loading}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-r-lg transition duration-200 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
        
        {user && recentRooms.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-indigo-700 mb-3">Recent rooms</h2>
            <div className="space-y-2">
              {recentRooms.map(room => (
                <div 
                  key={room.id}
                  onClick={() => navigate(`/chat/${room.roomId}`)}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                >
                  <div>
                    <p className="font-medium">{room.creatorName}'s room</p>
                    <p className="text-sm text-gray-500">ID: {room.roomId}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {room.createdAt ? new Date(room.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;