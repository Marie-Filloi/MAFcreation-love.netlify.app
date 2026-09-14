function welcomeEmailHtml(name, partnerName) {
  return `
  <div style="font-family:Georgia,serif;background:#2b0f1a;color:#fbeee8;padding:32px;border-radius:12px;max-width:480px;margin:0 auto;">
    <p style="font-size:28px;text-align:center;margin:0 0 8px;">💞</p>
    <h1 style="text-align:center;color:#f0cf7f;font-size:22px;margin:0 0 20px;">Malgré la distance</h1>
    <p style="font-size:14px;line-height:1.6;">Merci pour votre abonnement ! Votre espace privé pour l'histoire entre ${name} et ${partnerName} est prêt.</p>
    <p style="font-size:14px;line-height:1.6;">Il n'y a pas de code à retenir ni à partager : chacun de vous se connecte avec sa propre adresse email. Rendez-vous sur le site et entrez l'adresse email sur laquelle vous recevez ce message : vous recevrez un lien de connexion sécurisé, personnel, valable uniquement pour cette adresse.</p>
    <p style="font-size:13px;line-height:1.6;color:#d9b3bb;">Cet espace n'est accessible qu'aux deux adresses email indiquées à l'abonnement. Si un jour vous souhaitez recommencer cette aventure avec quelqu'un d'autre, un nouvel abonnement créera un espace séparé, propre à cette nouvelle histoire.</p>
  </div>`;
}

function loginLinkEmailHtml(link) {
  return `
  <div style="font-family:Georgia,serif;background:#2b0f1a;color:#fbeee8;padding:32px;border-radius:12px;max-width:480px;margin:0 auto;">
    <p style="font-size:28px;text-align:center;margin:0 0 8px;">💞</p>
    <h1 style="text-align:center;color:#f0cf7f;font-size:22px;margin:0 0 20px;">Malgré la distance</h1>
    <p style="font-size:14px;line-height:1.6;">Voici votre lien de connexion personnel. Il vous connecte directement à votre espace de couple, sans mot de passe.</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#d9a441;color:#2b0f1a;font-weight:bold;text-decoration:none;padding:14px 24px;border-radius:8px;">Accéder à mon espace</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#d9b3bb;">Ce lien est personnel et à usage limité : ne le transférez pas. S'il a expiré, retournez simplement sur le site et redemandez-en un nouveau avec votre email.</p>
  </div>`;
}

module.exports = { welcomeEmailHtml, loginLinkEmailHtml };
