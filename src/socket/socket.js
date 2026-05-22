let io;

exports.init = (server) => {

  const socketIo =
    require('socket.io');

  io = socketIo(server, {
    cors: {
      origin: '*'
    }
  });

  io.on('connection', (socket) => {

    console.log('User connected');

    socket.on('join', (userId) => {

      socket.join(`user_${userId}`);
    });

    socket.on('disconnect', () => {

      console.log('User disconnected');
    });
  });

  return io;
};

exports.getIO = () => {

  if (!io) {
    throw new Error(
      'Socket.io not initialized'
    );
  }

  return io;
};