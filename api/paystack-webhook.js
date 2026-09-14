const crypto = require('crypto');
const { Resend } = require('resend');
const { getDb } = require('./_lib/firebaseAdmin');
const { generateUniqueCode } = require('./_lib/generateCode');
const { normalizeEmail } = require('./_lib/normalizeEmail');
const { welcomeEmailHtml } = require('./_lib/emailTemplates');

const resend = new Resend(process.env.RESEND_API_KEY);

// Paystack needs the raw request body to verify the webhook signature.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Méthode non autorisée.');
    return;
  }

  const rawBody = await readRawBody(req);

  const signature = req.headers['x-paystack-signature'];
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  if (!signature || signature !== expected) {
    console.error('Paystack webhook signature mismatch');
    res.status(401).send('Invalid signature');
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.status(400).send('Invalid JSON');
    return;
  }

  const db = getDb();

  try {
    if (event.event === 'charge.success') {
      const txn = event.data || {};
      const meta = txn.metadata || {};
      const email = normalizeEmail(txn.customer && txn.customer.email);
      const partnerEmail = normalizeEmail(meta.partnerEmail);
      const name = meta.name || 'Toi';
      const partnerName = meta.partnerName || 'ton/ta partenaire';

      if (!email || !partnerEmail) {
        console.error('Missing email or partnerEmail on Paystack charge', txn.reference);
        res.status(200).json({ received: true });
        return;
      }

      // Paystack can retry webhook delivery; avoid creating a second couple for the same subscriber.
      const existing = await db.collection('emailToCode').doc(email).get();
      if (existing.exists) {
        res.status(200).json({ received: true });
        return;
      }

      const code = await generateUniqueCode(db);

      await db.collection('couples').doc(code).set({
        state: {},
        partners: {
          A: { name, emoji: '', label: '', updatedAt: null },
          B: { name: partnerName, emoji: '', label: '', updatedAt: null }
        },
        subscription: {
          email,
          partnerEmail,
          paystackCustomerCode: (txn.customer || {}).customer_code || null,
          paystackReference: txn.reference || null,
          status: 'active'
        },
        createdAt: Date.now()
      });

      await db.collection('emailToCode').doc(email).set({ code });
      await db.collection('emailToCode').doc(partnerEmail).set({ code });

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Malgré la distance <onboarding@resend.dev>',
        to: [email, partnerEmail],
        subject: 'Votre espace est prêt, Malgré la distance 💗',
        html: welcomeEmailHtml(name, partnerName)
      });
    }

    if (event.event === 'subscription.disable' || event.event === 'subscription.not_renew') {
      const sub = event.data || {};
      const email = normalizeEmail((sub.customer || {}).email);
      if (email) {
        const lookup = await db.collection('emailToCode').doc(email).get();
        if (lookup.exists) {
          const code = lookup.data().code;
          await db.collection('couples').doc(code).set({ subscription: { status: 'canceled' } }, { merge: true });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('paystack-webhook handling error', err);
    res.status(500).json({ error: 'Erreur de traitement du webhook.' });
  }
};
