module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    const { name, email, partnerName, partnerEmail } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Votre email est requis.' });
      return;
    }
    if (!partnerEmail || typeof partnerEmail !== 'string' || !partnerEmail.includes('@')) {
      res.status(400).json({ error: "L'email de votre partenaire est requis : c'est ce qui lui permettra de se connecter à votre espace, lui et lui seul." });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim() || !partnerName || typeof partnerName !== 'string' || !partnerName.trim()) {
      res.status(400).json({ error: 'Le prénom des deux partenaires est requis.' });
      return;
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        plan: process.env.PAYSTACK_PLAN_CODE,
        callback_url: `${process.env.APP_BASE_URL}/?subscribed=1`,
        metadata: {
          name: name.trim().slice(0, 60),
          partnerName: partnerName.trim().slice(0, 60),
          partnerEmail: partnerEmail.trim().toLowerCase().slice(0, 200)
        }
      })
    });

    const data = await paystackRes.json();
    if (!data.status || !data.data || !data.data.authorization_url) {
      console.error('Paystack init error', data);
      throw new Error(data.message || 'Paystack error');
    }

    res.status(200).json({ url: data.data.authorization_url });
  } catch (err) {
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Impossible de créer la session de paiement.' });
  }
};
