const admin = require("firebase-admin");
const User = require("../models/User");

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) {
    console.warn("[PUSH] FIREBASE_SERVICE_ACCOUNT_JSON not set, push disabled");
    return;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    initialized = true;
    console.log("[PUSH] Firebase Admin initialized");
  } catch (err) {
    console.error("[PUSH] Firebase init error:", err.message);
  }
}

initFirebase();

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

async function sendToUser(userId, notification, data = {}) {
  if (!initialized) return;
  const user = await User.findOne({ id: userId }).lean();
  if (!user?.fcm_tokens?.length) return;

  const message = {
    notification,
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
  };

  const results = await Promise.allSettled(
    user.fcm_tokens.map((token) =>
      admin.messaging().send({ ...message, token })
    )
  );

  const staleTokens = [];
  results.forEach((r, i) => {
    if (
      r.status === "rejected" &&
      (r.reason?.code === "messaging/registration-token-not-registered" ||
        r.reason?.code === "messaging/invalid-registration-token")
    ) {
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
