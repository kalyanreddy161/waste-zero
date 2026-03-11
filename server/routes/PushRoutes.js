const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getVapidPublic } = require('../controllers/PushController');

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);
router.get('/vapid-public', getVapidPublic);

module.exports = router;
