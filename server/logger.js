const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'ai_activity.log');

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
  
  console.log(logEntry.trim());
  fs.appendFileSync(logFile, logEntry);
}

module.exports = {
  info: (msg, data) => log('INFO', msg, data),
  success: (msg, data) => log('SUCCESS', msg, data),
  error: (msg, data) => log('ERROR', msg, data),
  warn: (msg, data) => log('WARN', msg, data)
};
