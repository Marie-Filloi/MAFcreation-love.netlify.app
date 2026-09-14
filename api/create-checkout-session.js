const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    const { name, email, partnerName, partnerEmail } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Email requis.' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim() || !partnerName || typeof partnerName !== 'string' || !partnerName.trim()) {
      res.status(400).json({ error: 'Le prénom des deux partenaires est requis.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_BASE_URL}/?subscribed=1`,
      cancel_url: `${process.env.APP_BASE_URL}/?subscribed=0`,
      metadata: {
        name: name.trim().slice(0, 60),
        partnerName: partnerName.trim().slice(0, 60),
        partnerEmail: (partnerEmail || '').toString().slice(0, 200)
      }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Impossible de créer la session de paiement.' });
  }
};
