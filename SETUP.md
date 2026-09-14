# Mise en place — Malgré la distance

Le site est un fichier statique (`index.html`) + des fonctions serveur dans `/api`
(paiement Stripe, webhook, envoi du lien de connexion). Ces instructions supposent un
déploiement sur **Vercel** (comme votre URL actuelle `...vercel.app`). Si vous déployez
finalement sur Netlify, dites-le moi : les fonctions doivent être réécrites au format
Netlify Functions.

L'accès ne passe plus par un code à taper : chaque personne se connecte avec sa propre
adresse email (lien de connexion sans mot de passe, comme "Se connecter avec Slack" par
email). C'est plus sûr contre le partage/l'infidélité qu'un code, qui pouvait être transmis
à n'importe qui.

## 1. Stripe (paiement + abonnement)

1. Créez un compte sur https://dashboard.stripe.com si ce n'est pas déjà fait.
2. Allez dans **Produits** → créez un produit "Malgré la distance", avec un prix **récurrent**
   (mensuel). Notez l'ID du prix (`price_...`).
3. Allez dans **Développeurs → Clés API** → copiez la clé secrète (`sk_test_...` en mode test,
   `sk_live_...` en production).
4. Une fois le site déployé, allez dans **Développeurs → Webhooks** → "Ajouter un endpoint" :
   - URL : `https://votresite.vercel.app/api/stripe-webhook`
   - Événements à écouter : `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copiez le "Signing secret" (`whsec_...`).

## 2. Resend (envoi des emails)

1. Créez un compte sur https://resend.com.
2. Vérifiez votre domaine d'envoi (Domains → Add Domain) pour pouvoir envoyer depuis
   `bonjour@votredomaine.com` — sinon utilisez l'adresse de test `onboarding@resend.dev`
   fournie par défaut (limitée, pratique pour tester).
3. Créez une clé API (API Keys → Create).

## 3. Firebase — base de données + connexion par email

Le projet Firebase existe déjà côté client (`mafcreation-love`). Deux choses à faire :

**a) Activer la connexion par email (obligatoire pour que la connexion fonctionne)**
1. Console Firebase → **Authentication** → onglet "Sign-in method".
2. Activez le fournisseur **"Email link (passwordless sign-in)"**.
3. Dans **Authentication → Settings → Authorized domains**, ajoutez le domaine de votre
   site (ex. `votresite.vercel.app`), sinon les liens de connexion seront refusés.

**b) Clé de service (pour que le serveur crée les comptes/couples)**
1. Console Firebase → ⚙️ Paramètres du projet → **Comptes de service**.
2. "Générer une nouvelle clé privée" → un fichier JSON se télécharge.
3. Ouvrez ce fichier et collez tout son contenu (sur une seule ligne) dans la variable
   d'environnement `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Déployez les nouvelles règles de sécurité (`firestore.rules` à la racine du projet) :
   soit en collant leur contenu dans Firebase Console → Firestore Database → Règles,
   soit via la CLI : `firebase deploy --only firestore:rules`.

   **Important** : contrairement à `index.html` et `/api`, ce fichier de règles n'est PAS
   déployé automatiquement par un `git push`. Il faut toujours le coller manuellement dans
   Firebase Console (ou passer par la CLI Firebase) après chaque modification.

   Ces règles n'autorisent l'accès à l'espace d'un couple qu'aux deux emails exacts
   enregistrés à l'abonnement (vérifiés via une vraie connexion Firebase Authentication),
   et empêchent quiconque de lister l'ensemble des couples enregistrés.

## 4. Variables d'environnement sur Vercel

Dans le tableau de bord Vercel du projet → **Settings → Environment Variables**, ajoutez
toutes les variables listées dans `.env.example` (avec vos vraies valeurs) :

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `APP_BASE_URL` (ex : `https://votresite.vercel.app`, sans `/` final)

Puis redéployez.

## 5. Tester

1. Ouvrez le site, cliquez sur "Je n'ai pas de compte", entrez votre prénom, votre email, le
   prénom et l'email de votre partenaire (les deux emails sont obligatoires), puis payez avec
   une carte de test Stripe (`4242 4242 4242 4242`, n'importe quelle date future, n'importe
   quel CVC).
2. Les deux adresses reçoivent un email de bienvenue en quelques secondes.
3. Revenez sur le site (mode "Se connecter" par défaut), entrez l'un des deux emails :
   vous recevez un lien de connexion personnel.
4. Cliquez sur ce lien : vous êtes connecté·e directement dans l'espace du couple, sans rien
   taper d'autre. Le prénom affiché est déterminé automatiquement par l'email utilisé, plus
   besoin de "choisir qui vous êtes".
5. Ouvrez le site sur un autre appareil/navigateur avec l'email de l'autre partenaire pour
   simuler votre partenaire, choisissez une humeur, et vérifiez qu'elle apparaît en direct
   côté premier appareil (recharger si besoin).

## Ce qui n'est pas couvert

- Pas de gestion d'annulation d'abonnement depuis le site (le client doit gérer/annuler depuis
  le portail client Stripe ou vous demander de le faire depuis le dashboard Stripe).
- L'email du lien de connexion vient de votre domaine Resend configuré, mais Firebase
  Authentication lui-même n'envoie aucun email dans ce montage (on génère le lien côté
  serveur et on l'envoie nous-mêmes via Resend, pour garder un email à votre image) : assurez-
  vous donc que Resend est bien configuré, sinon la connexion ne pourra pas fonctionner.
- Les anciens codes de test créés avant ce système (ex. "TEST123") ne sont plus accessibles du
  tout une fois les nouvelles règles Firestore déployées, puisqu'ils n'ont pas d'email
  enregistré associé. Rien à faire de plus pour les neutraliser, mais vous pouvez les
  supprimer dans Firestore Database → collection `couples` pour faire le ménage.
