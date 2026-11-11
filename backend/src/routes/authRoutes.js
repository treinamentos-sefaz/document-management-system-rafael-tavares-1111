const express = require('express');
const { createAuthController } = require('../controllers/authController');

function createAuthRouter(authService, maxAttempts = 20) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const attempts = new Map();
  let lastCleanup = 0;

  function limitAttempts(req, res, next) {
    const now = Date.now();
    if (now - lastCleanup >= 60000) {
      for (const [ip, window] of attempts) {
        if (window.resetAt <= now) attempts.delete(ip);
      }
      lastCleanup = now;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const previous = attempts.get(ip);
    const window = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 60000 };
    if (window.count >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)));
      return res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Muitas tentativas. Tente novamente em breve.' } });
    }
    window.count += 1;
    attempts.set(ip, window);
    return next();
  }

  router.post('/auth/register', limitAttempts, controller.register);
  router.post('/auth/login', limitAttempts, controller.login);
  return router;
}

module.exports = { createAuthRouter };