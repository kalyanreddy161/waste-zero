const PushSubscription = require('../models/PushSubscription');

// POST /api/push/subscribe
const subscribe = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { subscription, deviceId } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ message: 'Invalid subscription' });

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys && subscription.keys.p256dh;
    const auth = subscription.keys && subscription.keys.auth;

    if (!p256dh || !auth) return res.status(400).json({ message: 'Invalid subscription keys' });

    await PushSubscription.updateOne(
      { endpoint },
      { $set: { userId, endpoint, p256dh, auth, deviceId } },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('push subscribe error', err);
    return res.status(500).json({ message: 'Failed to subscribe' });
  }
};

// POST /api/push/unsubscribe
const unsubscribe = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ message: 'deviceId required' });

    await PushSubscription.deleteOne({ userId, deviceId });
    return res.json({ success: true });
  } catch (err) {
    console.error('push unsubscribe error', err);
    return res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

// GET /api/push/vapid-public
const getVapidPublic = async (req, res) => {
  try {
    return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  } catch (err) {
    return res.status(500).json({ publicKey: null });
  }
};

module.exports = { subscribe, unsubscribe, getVapidPublic };
