const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.id;
      ws.userRole = decoded.role;
      ws.isAlive = true;
    } catch {
      ws.close(4002, "Invalid token");
      return;
    }

    ws.on("pong", () => { ws.isAlive = true; });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
}

function broadcast(event, data, excludeUserId) {
  if (!wss) return;
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && ws.userId !== excludeUserId) {
      ws.send(message);
    }
  });
}

module.exports = { initWebSocket, broadcast };
