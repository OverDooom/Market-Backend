

const jwt = require('jsonwebtoken');

let io;

exports.init = (server) => {
  const socketIo = require('socket.io');

  io = socketIo(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('User connected');

    
    socket.on('join', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user_${decoded.id}`);
      } catch (err) {
        
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