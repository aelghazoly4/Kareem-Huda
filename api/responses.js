// api/responses.js — صفحة ردود الضيوف للعروسين (بلينك سري)
//   /api/responses?key=<RESPONSES_KEY>             صفحة الردود
//   /api/responses?key=<RESPONSES_KEY>&format=csv  نفس الردود ملف Excel/CSV
// من غير RESPONSES_KEY صحيح الصفحة بترجع "مش موجودة".
const crypto = require('crypto');
const { getRsvpCollection } = require('../lib/db');

const LABELS = { yes: 'هيحضر', maybe: 'يمكن', no: 'معتذر' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function keyOk(given) {
  const expected = process.env.RESPONSES_KEY || '';
  if (!expected || !given) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const when = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const key = (req.query && req.query.key) || '';
  if (!keyOk(key)) return res.status(404).send('Not found');

  let list = [];
  try {
    const rsvps = await getRsvpCollection();
    if (!rsvps) return res.status(503).send('MONGODB_URI is not set on Vercel yet.');
    list = await rsvps.find({}, { projection: { ipHash: 0 } }).sort({ createdAt: -1 }).limit(2000).toArray();
  } catch (err) {
    console.error('Loading responses failed:', err);
    return res.status(500).send('Could not load the responses. Try again.');
  }

  if (req.query.format === 'csv') {
    const rows = [['Name', 'Answer', 'Message', 'Time (Cairo)']].concat(list.map((r) => [
      r.guestName, LABELS[r.attending] || r.attending, r.note || '', r.createdAt ? when.format(new Date(r.createdAt)) : '',
    ]));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kareem-huda-rsvps.csv"');
    // BOM عشان Excel يقرا العربي صح
    return res.status(200).send('﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
  }

  const count = { yes: 0, maybe: 0, no: 0 };
  list.forEach((r) => { if (count[r.attending] != null) count[r.attending] += 1; });

  const rows = list.length ? list.map((r) => `
      <li class="row">
        <div class="top"><b dir="auto">${esc(r.guestName)}</b><span class="badge ${esc(r.attending)}">${esc(LABELS[r.attending] || r.attending)}</span></div>
        ${r.note ? `<p class="note" dir="auto">${esc(r.note)}</p>` : ''}
        <time>${r.createdAt ? esc(when.format(new Date(r.createdAt))) : ''}</time>
      </li>`).join('') : '<li class="empty">لسه مفيش ردود — أول ما حد يأكد هيظهر هنا.</li>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>ردود الضيوف — كريم وهدى</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Pinyon+Script&display=swap" rel="stylesheet">
<style>
:root{--burg:#6b1428;--gold:#b8913a;--olive:#5b6430;--cream:#f7eedb;--ink:#3b2516}
*{box-sizing:border-box}body{margin:0;background:#3e4521;font-family:Cairo,sans-serif;color:var(--ink);padding:24px 14px 40px}
.card{max-width:560px;margin:0 auto;background:var(--cream);border-radius:22px;padding:26px 20px;box-shadow:0 0 0 2px var(--gold),0 20px 40px rgba(0,0,0,.4)}
h1{margin:0;text-align:center;font-family:'Pinyon Script',cursive;font-weight:400;font-size:46px;color:var(--burg);direction:ltr}
.sub{text-align:center;margin:2px 0 18px;color:#7a5a3a;font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.tile{border-radius:14px;padding:12px 4px;text-align:center;background:#fff8e8;border:1px solid rgba(184,145,58,.4)}
.tile b{display:block;font-size:24px;line-height:1.1}.tile span{font-size:12px;color:#7a5a3a}
.tile.yes b{color:#3f7d54}.tile.maybe b{color:#a8842c}.tile.no b{color:#9a2a3e}
.csv{display:block;text-align:center;margin:0 0 14px;color:var(--burg);font-weight:600;font-size:14px}
ul{list-style:none;margin:0;padding:0}.row{padding:12px 4px;border-top:1px solid rgba(184,145,58,.35)}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px}.top b{font-size:16px}
.badge{font-size:12px;font-weight:700;border-radius:20px;padding:3px 12px;white-space:nowrap}
.badge.yes{background:rgba(63,125,84,.13);color:#3f7d54}.badge.maybe{background:rgba(184,145,58,.18);color:#8c6a24}.badge.no{background:rgba(154,42,62,.12);color:#9a2a3e}
.note{margin:6px 0 0;font-size:14px;line-height:1.7;color:#5c3b22}time{display:block;margin-top:4px;font-size:12px;color:#9a8468}
.empty{text-align:center;padding:24px;color:#7a5a3a}
</style></head><body><div class="card">
<h1>Kareem &amp; Huda</h1><p class="sub">ردود تأكيد الحضور</p>
<div class="tiles">
<div class="tile"><b>${list.length}</b><span>كل الردود</span></div>
<div class="tile yes"><b>${count.yes}</b><span>هيحضروا</span></div>
<div class="tile maybe"><b>${count.maybe}</b><span>يمكن</span></div>
<div class="tile no"><b>${count.no}</b><span>معتذرين</span></div>
</div>
<a class="csv" href="?key=${encodeURIComponent(key)}&amp;format=csv">⬇ نزّل الردود ملف Excel</a>
<ul>${rows}</ul></div></body></html>`);
};
