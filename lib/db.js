// lib/db.js
// اتصال واحد بـ MongoDB بيتعاد استخدامه بين الطلبات (Vercel serverless).
// محتاج متغير البيئة MONGODB_URI — ولو مش موجود الدالة بترجّع null
// والـ API بيرد إن تأكيد الحضور لسه متظبطش.
const { MongoClient } = require('mongodb');

let clientPromise = null;

async function getRsvpCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect().catch((err) => {
      // لو الاتصال فشل، الطلب الجاي يحاول من الأول بدل ما يفضل شايل الخطأ
      clientPromise = null;
      throw err;
    });
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'kareem_huda_wedding').collection('rsvps');
}

module.exports = { getRsvpCollection };
