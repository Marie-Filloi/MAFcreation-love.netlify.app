const Stripe = require('stripe');
const { Resend } = require('resend');
const { getDb } = require('./_lib/firebaseAdmin');
const { generateUniqueCode } = require('./_lib/generateCode');
const { normalizeEmail } = require('./_lib/normalizeEmail');
const { welcomeEmailHtml } = require('./_lib/emailTemplates');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Stripe needs the raw request body to verify the webhook signature.
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

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const db = getDb();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const rawEmail = session.customer_email || (session.customer_details && session.customer_details.email);
      const meta = session.metadata || {};
      const name = meta.name || 'Toi';
      const partnerName = meta.partnerName || 'ton/ta partenaire';
      const email = normalizeEmail(rawEmail);
      const partnerEmail = normalizeEmail(meta.partnerEmail);

      if (!email || !partnerEmail) {
        console.error('Missing email or partnerEmail on completed session', session.id);
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
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
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

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        const snap = await db.collection('couples')
          .where('subscription.stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();
        if (!snap.empty) {
          await snap.docs[0].ref.set({ subscription: { status: 'canceled' } }, { merge: true });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook handling error', err);
    res.status(500).json({ error: 'Erreur de traitement du webhook.' });
  }
};
