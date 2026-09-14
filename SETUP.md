# Mise en place — Malgré la distance

Le site est un fichier statique (`index.html`) + trois fonctions serveur dans `/api`
(paiement Stripe, webhook, génération du code). Ces instructions supposent un déploiement
sur **Vercel** (comme votre URL actuelle `...vercel.app`). Si vous déployez finalement sur
Netlify, dites-le moi : les fonctions doivent être réécrites au format Netlify Functions.

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

## 2. Resend (envoi d'email du code)

1. Créez un compte sur https://resend.com.
2. Vérifiez votre domaine d'envoi (Domains → Add Domain) pour pouvoir envoyer depuis
   `bonjour@votredomaine.com` — sinon utilisez l'adresse de test `onboarding@resend.dev`
   fournie par défaut (limitée, pratique pour tester).
3. Créez une clé API (API Keys → Create).

## 3. Firebase (base de données des couples)

Le projet Firebase existe déjà côté client (`mafcreation-love`). Il faut maintenant une
clé de service pour que le serveur (webhook Stripe) puisse écrire les codes générés :

1. Console Firebase → ⚙️ Paramètres du projet → **Comptes de service**.
2. "Générer une nouvelle clé privée" → un fichier JSON se télécharge.
3. Ouvrez ce fichier et collez tout son contenu (sur une seule ligne) dans la variable
   d'environnement `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Déployez les nouvelles règles de sécurité (`firestore.rules` à la racine du projet) :
   soit en collant leur contenu dans Firebase Console → Firestore Database → Règles,
   soit via la CLI : `firebase deploy --only firestore:rules`.
   Ces règles empêchent désormais qui que ce soit de créer un faux "couple" ou de modifier
   son propre code/abonnement depuis le navigateur — seul le serveur peut créer un couple.

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

1. Ouvrez le site, cliquez sur "Je n'ai pas de code", entrez votre prénom, votre email, le
   prénom de votre partenaire, puis payez avec une carte de test Stripe (`4242 4242 4242 4242`,
   n'importe quelle date future, n'importe quel CVC).
2. Vous devriez recevoir l'email avec le code en quelques secondes. Les deux prénoms sont
   déjà enregistrés dans l'espace de couple dès la création, ce n'est plus le premier arrivé
   qui choisit un nom au hasard : le code est nominatif dès l'abonnement.
3. Revenez sur le site, cliquez "J'ai un code", entrez-le, puis choisissez lequel des deux
   prénoms est le vôtre : votre espace de couple s'ouvre.
4. Ouvrez le même code sur un autre navigateur/appareil pour simuler votre partenaire :
   choisissez l'autre prénom, choisissez une humeur, et vérifiez qu'elle apparaît en direct
   côté "premier" appareil (recharger la page si besoin).

## Ce qui n'est pas couvert

- Pas de vraie authentification par compte : le "code" reste un secret partagé, comme un lien
  privé. C'est un choix délibéré pour rester simple, mais ça veut dire que quiconque connaît
  le code peut entrer, et choisir librement lequel des deux prénoms il incarne. Les prénoms
  fixés dès l'abonnement rendent le code nominatif (il raconte l'histoire de deux personnes
  précises, pas d'un compte anonyme), mais la protection contre l'infidélité reste sociale
  (un code = une histoire, se réabonner = un nouveau code), pas un verrou technique absolu.
- Pas de gestion d'annulation d'abonnement depuis le site (le client doit gérer/annuler depuis
  le portail client Stripe ou vous demander de le faire depuis le dashboard Stripe).
