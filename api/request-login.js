const { Resend } = require('resend');
const { getDb, admin } = require('./_lib/firebaseAdmin');
const { normalizeEmail } = require('./_lib/normalizeEmail');
const { loginLinkEmailHtml } = require('./_lib/emailTemplates');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    const email = normalizeEmail((req.body || {}).email);
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Merci d\'entrer un email valide.' });
      return;
    }

    const db = getDb();
    const lookup = await db.collection('emailToCode').doc(email).get();
    if (!lookup.exists) {
      res.status(404).json({ error: "Cet email n'est associé à aucun abonnement. Vérifiez l'orthographe, ou abonnez-vous." });
      return;
    }

    const actionCodeSettings = {
      url: `${process.env.APP_BASE_URL}/`,
      handleCodeInApp: true
    };
    const link = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Malgré la distance <onboarding@resend.dev>',
      to: email,
      subject: 'Votre lien de connexion, Malgré la distance 💗',
      html: loginLinkEmailHtml(link)
    });

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('request-login error', err);
    res.status(500).json({ error: "Impossible d'envoyer le lien de connexion pour le moment." });
  }
};
