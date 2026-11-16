const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { registerToken, removeToken } = require("../services/pushService");

const router = Router();

router.post("/register-token", authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    await registerToken(req.user.id, token);
    res.json({ ok: true });
  } catch (err) {
    console.error("[PUSH] register-token error:", err.message);
    res.status(500).json({ error: "Failed to register token" });
  }
});

router.post("/remove-token", authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    await removeToken(req.user.id, token);
    res.json({ ok: true });
  } catch (err) {
    console.error("[PUSH] remove-token error:", err.message);
    res.status(500).json({ error: "Failed to remove token" });
  }
});

module.exports = router;
