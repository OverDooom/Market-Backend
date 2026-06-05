// src/socket/socket.js — full file replacement

const jwt = require('jsonwebtoken');

let io;

exports.init = (server) => {
  const socketIo = require('socket.io');

  io = socketIo(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('User connected');

    // Client must emit: socket.emit('join', '<access_token>')
    socket.on('join', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user_${decoded.id}`);
      } catch (err) {
        // Invalid or expired token — disconnect the socket
        socket.emit('error', { message: 'Authentication failed' });
        socket.disconnect(true);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};