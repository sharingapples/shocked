const WebSocket = require('ws');

const port = process.env.PORT || 9999;

const wss = new WebSocket.Server({ port });
wss.on('connection', (ws, req) => {
  ws.send(`New Connection ${req.socket.remoteAddress}:${req.socket.remotePort}`);
  ws.on('message', (msg) => {
    if (msg === 'close') {
      ws.close();
    } else {
      ws.send(msg);
    }
  });
});
