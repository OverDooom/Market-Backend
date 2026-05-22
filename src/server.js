const app = require('./app');

const http = require('http');

const server = http.createServer(app);

const socket = require('./socket/socket');

socket.init(server);

server.listen(3000, () => {
  console.log(
    `Server running on port 3000`
  );
});