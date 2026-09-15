const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");

    console.log("[WS] New connection attempt");

    if (!token) {
      console.log("[WS] Rejected: no token");
      ws.close(4001, "Missing token");
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.id;
      ws.userRole = decoded.role;
      ws.isAlive = true;
      console.log("[WS] Authenticated:", decoded.id, decoded.role);
    } catch (err) {
      console.log("[WS] Rejected: invalid token", err.message);
      ws.close(4002, "Invalid token");
      return;
    }

    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("close", () => { console.log("[WS] Disconnected:", ws.userId); });
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
  let sent = 0;
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && ws.userId !== excludeUserId) {
      ws.send(message);
      sent++;
    }
  });
  console.log("[WS] Broadcast", event, "to", sent, "clients (total:", wss.clients.size + ")");
}

module.exports = { initWebSocket, broadcast };
