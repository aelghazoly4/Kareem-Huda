// api/rsvp.js — POST: ضيف بيأكد حضوره (أيوه / يمكن / لأ + رسالة اختيارية)
const crypto = require('crypto');
const { getRsvpCollection } = require('../lib/db');

const ANSWERS = ['yes', 'maybe', 'no'];
const MAX_PER_HOUR = 20; // لكل شبكة — عشان محدش يغرق الردود بسكريبت

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

function ipHash(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || (req.socket && req.socket.remoteAddress) || '';
  return crypto.createHash('sha256').update('kh-rsvp:' + ip).digest('hex').slice(0, 32);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = readBody(req);
  // مصيدة السبام: الخانة دي مخفية عن الناس، والبوتات بس اللي بتملاها
  if (clean(body.website, 100)) return res.status(201).json({ ok: true });

  const guestName = clean(body.guestName, 80);
  if (guestName.length < 2) return res.status(400).json({ error: 'Please write your name.' });

  const attending = String(body.attending || '');
  if (!ANSWERS.includes(attending)) return res.status(400).json({ error: 'Please let us know if you can come.' });

  const note = clean(body.note, 300);

  try {
    const rsvps = await getRsvpCollection();
    if (!rsvps) return res.status(503).json({ error: 'RSVP is not available yet. Please try again later.' });

    const hash = ipHash(req);
    const recent = await rsvps.countDocuments({ ipHash: hash, createdAt: { $gte: new Date(Date.now() - 3600 * 1000) } });
    if (recent >= MAX_PER_HOUR) return res.status(429).json({ error: 'Too many replies — please try again later.' });

    await rsvps.insertOne({ guestName, attending, note, ipHash: hash, createdAt: new Date() });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('RSVP save failed:', err);
    return res.status(500).json({ error: 'We couldn’t save your reply. Please try again.' });
  }
};
