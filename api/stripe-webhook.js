const Stripe = require('stripe');
const { Resend } = require('resend');
const { getDb } = require('./_lib/firebaseAdmin');
const { generateUniqueCode } = require('./_lib/generateCode');

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

function emailHtml(code, name, partnerName) {
  return `
  <div style="font-family:Georgia,serif;background:#2b0f1a;color:#fbeee8;padding:32px;border-radius:12px;max-width:480px;margin:0 auto;">
    <p style="font-size:28px;text-align:center;margin:0 0 8px;">💞</p>
    <h1 style="text-align:center;color:#f0cf7f;font-size:22px;margin:0 0 20px;">Malgré la distance</h1>
    <p style="font-size:14px;line-height:1.6;">Bonjour ${name}, merci pour votre abonnement. Voici le code unique de votre histoire avec ${partnerName} :</p>
    <p style="text-align:center;font-size:26px;letter-spacing:2px;font-weight:bold;color:#f0cf7f;background:#3a1420;border:1px solid #d9a441;border-radius:8px;padding:14px;margin:20px 0;">${code}</p>
    <p style="font-size:13px;line-height:1.6;color:#d9b3bb;">Ce code n'appartient qu'à vous deux : partagez-le avec ${partnerName}, et avec personne d'autre. Si un jour vous souhaitez recommencer cette aventure avec quelqu'un d'autre, un nouvel abonnement vous donnera un tout nouveau code propre à cette nouvelle histoire.</p>
    <p style="font-size:13px;line-height:1.6;color:#d9b3bb;">Rendez-vous sur le site, cliquez sur « J'ai un code », entrez-le, puis indiquez si vous êtes ${name} ou ${partnerName} pour accéder à votre espace privé.</p>
  </div>`;
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
      const email = session.customer_email || (session.customer_details && session.customer_details.email);
      const meta = session.metadata || {};
      const name = meta.name || 'Toi';
      const partnerName = meta.partnerName || 'ton/ta partenaire';
      const partnerEmail = meta.partnerEmail || '';

      if (!email) {
        console.error('No email on completed session', session.id);
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

      const recipients = [email, partnerEmail].filter(Boolean);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Malgré la distance <onboarding@resend.dev>',
        to: recipients,
        subject: 'Votre code de couple, Malgré la distance 💗',
        html: emailHtml(code, name, partnerName)
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
