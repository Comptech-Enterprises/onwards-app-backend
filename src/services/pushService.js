const User = require("../models/User");

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;

if (FCM_SERVER_KEY) {
  console.log("[PUSH] FCM server key configured, push enabled");
} else {
  console.warn("[PUSH] FCM_SERVER_KEY not set, push disabled");
}

async function registerToken(userId, token) {
  if (!token) return;
  await User.updateOne(
    { id: userId },
    { $addToSet: { fcm_tokens: token } }
  );
}

async function removeToken(userId, token) {
  if (!token) return;
  await User.updateOne(
    { id: userId },
    { $pull: { fcm_tokens: token } }
  );
}

async function sendPush(fcmToken, notification, data = {}) {
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify({
      to: fcmToken,
      notification,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    }),
  });

  const result = await res.json();

  if (result.failure > 0 && result.results?.[0]?.error) {
    const err = result.results[0].error;
    if (err === "NotRegistered" || err === "InvalidRegistration") {
      return { stale: true };
    }
  }

  return { stale: false };
}

async function sendToUser(userId, notification, data = {}) {
  if (!FCM_SERVER_KEY) return;
  const user = await User.findOne({ id: userId }).lean();
  if (!user?.fcm_tokens?.length) return;

  const results = await Promise.allSettled(
    user.fcm_tokens.map((token) => sendPush(token, notification, data))
  );

  const staleTokens = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value?.stale) {
      staleTokens.push(user.fcm_tokens[i]);
    }
  });

  if (staleTokens.length) {
    await User.updateOne(
      { id: userId },
      { $pull: { fcm_tokens: { $in: staleTokens } } }
    );
  }
}

async function sendToMultipleUsers(userIds, notification, data = {}) {
  await Promise.allSettled(
    userIds.map((uid) => sendToUser(uid, notification, data))
  );
}

module.exports = { registerToken, removeToken, sendToUser, sendToMultipleUsers };
