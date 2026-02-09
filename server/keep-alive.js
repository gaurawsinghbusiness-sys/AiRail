/**
 * Keep-Alive Service
 * Periodically pings the application's own URL to prevent Render Free tier from sleeping.
 */
const https = require('https');
const logger = require('./logger');

function initKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) {
    logger.info('Keep-alive: RENDER_EXTERNAL_URL not set, skipping self-ping.');
    return;
  }

  const pingUrl = `${url}/ping`;
  logger.info(`Keep-alive: Starting self-ping service for ${pingUrl}`);

  // Ping every 10 minutes (600,000 ms)
  setInterval(() => {
    https.get(pingUrl, (res) => {
      logger.info(`Keep-alive: Ping sent to ${pingUrl}, status: ${res.statusCode}`);
    }).on('error', (err) => {
      logger.error('Keep-alive: Ping failed', err.message);
    });
  }, 600000);
}

module.exports = { initKeepAlive };
