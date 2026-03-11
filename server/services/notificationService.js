const webpush = require('web-push');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');

// web-push setup (expects VAPID keys in env)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@yourapp.com'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.error('web-push setVapidDetails error', e);
  }
}

/**
 * Build a compact browser notification payload
 */
function buildPushPayload({ type, meta }) {
  let title = 'Notification';
  let body = '';
  let url = '/home';

  if (type === 'message') {
    title = 'New Message';
    body = (meta && meta.senderName ? meta.senderName + ': ' : '') + (meta && meta.message ? meta.message : 'You have a new message');
    url = `/home/messages`;
    if (meta && meta.conversationId) url = `/home/messages?conversation=${meta.conversationId}`;
  } else if (type === 'application') {
    title = 'New Application';
    body = meta && meta.opportunityTitle ? `New application for ${meta.opportunityTitle}` : 'New application received';
    url = '/home/opportunities';
  } else if (type === 'accepted' || type === 'rejected') {
    title = 'Application Update';
    body = meta && meta.opportunityTitle ? `Your ${meta.opportunityTitle} application ${type}` : `Your application was ${type}`;
    url = '/home/opportunities';
  }

  return JSON.stringify({ title, body, url });
}

async function notify({ io, receiverId, senderId, type, referenceId, application_id, conversationId, meta }) {
  try {
    // Persist notification in DB
    const notif = new Notification({ receiverId, senderId, type, referenceId, application_id, conversationId });
    const saved = await notif.save();

    const payload = {
      id: saved._id,
      receiverId: String(saved.receiverId),
      senderId: saved.senderId ? String(saved.senderId) : null,
      type: saved.type,
      referenceId: saved.referenceId ? String(saved.referenceId) : null,
      conversationId: saved.conversationId ? String(saved.conversationId) : null,
      application_id: saved.application_id ? String(saved.application_id) : null,
      read: saved.read,
      createdAt: saved.createdAt,
    };

    if (meta) payload.meta = meta;

    const socketServer = io || global.io;

    // Determine presence. presence map stored on global.presence (set in server.js)
    const presence = (global && global.presence && global.presence.get(String(receiverId))) || 'offline';

    // If active -> emit socket notification
    if (socketServer && presence === 'active') {
      socketServer.to(String(receiverId)).emit('notification', payload);
      return saved;
    }

    // Otherwise send web push to all subscriptions for this user
    const subs = await PushSubscription.find({ userId: receiverId });
    if (!subs || subs.length === 0) return saved;

    const pushPayload = buildPushPayload({ type, meta: meta || {} });

    for (const s of subs) {
      const pushSub = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth,
        },
      };
      try {
        await webpush.sendNotification(pushSub, pushPayload);
      } catch (err) {
        const status = err && err.statusCode ? err.statusCode : null;
        if (status === 404 || status === 410) {
          try {
            await PushSubscription.deleteOne({ endpoint: s.endpoint });
          } catch (e) { }
        } else {
          console.error('webpush error', err && err.body ? err.body : err);
        }
      }
    }

    return saved;
  } catch (err) {
    console.error('notificationService.notify error:', err);
    throw err;
  }
}

module.exports = { notify };
