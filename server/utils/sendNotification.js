// delegate to notification service which handles presence + web-push
const notificationService = require('../services/notificationService');

async function sendNotification(params) {
  return notificationService.notify(params);
}

module.exports = sendNotification;
