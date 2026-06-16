const fs = require('fs');
const geoip = require('geoip-lite');

const VISITORS_LOG = process.env.VISITORS_LOG || 'visitors.log';
const SKIP_IPS = new Set(
  (process.env.SKIP_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

function initializeVisitorLog() {
  if (!fs.existsSync(VISITORS_LOG)) {
    fs.writeFileSync(VISITORS_LOG, 'Visitors Log\n' + '='.repeat(80) + '\n');
  }
}

function getVisitorIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip;
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function getUserAgent(req) {
  return String(req.headers?.['user-agent'] || 'Unknown');
}

function getVisitorTimezone(req) {
  const ua = getUserAgent(req);
  const match = ua.match(/[Tt]imezone=([^\s;,)]+)/);
  return match ? match[1] : '';
}

function getVisitorLocation(ip) {
  if (!ip || ip === 'unknown') {
    return { city: '', country: '' };
  }

  const location = geoip.lookup(ip);
  return location || { city: '', country: '' };
}

function makeVisitorLogEntry(req) {
  const ip = getVisitorIp(req);
  const userAgent = getUserAgent(req);
  const timezone = getVisitorTimezone(req);
  const location = getVisitorLocation(ip);

  return `Visitor - ${new Date().toISOString()} - tz:${timezone} - ip:${ip} - city:${location.city || ''} - country:${location.country || ''} - ua:${userAgent}\n`;
}

function appendVisitorLog(entry) {
  if (!entry || typeof entry !== 'string') {
    return;
  }

  const ipMatch = entry.match(/ip:([^\s-]+)/);
  const ip = ipMatch ? ipMatch[1] : null;
  if (SKIP_IPS.has(ip)) {
    return;
  }

  try {
    fs.appendFileSync(VISITORS_LOG, entry, 'utf8');
  } catch (error) {
    console.error('Unable to write visitor log entry:', error);
  }
}

module.exports = {
  initializeVisitorLog,
  makeVisitorLogEntry,
  appendVisitorLog
};
