# GBA Backend – Documentation Complète

Ce backend Node.js gère l’API de gestion de véhicules, commandes, utilisateurs et paiements pour l’application GBA. Il utilise Express, MongoDB (Mongoose), Stripe, JWT, et propose une structure claire pour l’intégration frontend.

## Sommaire
- [Installation & Prérequis](#installation--prérequis)
- [Configuration (.env)](#configuration-env)
- [Lancement du serveur](#lancement-du-serveur)
- [Structure des dossiers](#structure-des-dossiers)
- [Principaux endpoints API](#principaux-endpoints-api)
- [Authentification & Sécurité](#authentification--sécurité)
- [Paiement & Webhooks Stripe](#paiement--webhooks-stripe)
- [Import de véhicules (optionnel)](#import-de-véhicules-optionnel)
- [Conseils pour le frontend](#conseils-pour-le-frontend)
- [Annexes](#annexes)

---

## Installation & Prérequis

1. **Node.js** (18.x ou 20.x recommandé)
2. **npm** (installé avec Node)
3. **MongoDB** (local ou Atlas)
4. (Optionnel) **Stripe CLI** pour tester les webhooks

```powershell
npm install
```

---

## Configuration (.env)
Crée un fichier `.env` à la racine avec :

```
MONGO_URI=mongodb://localhost:27017/gba
PORT=5000
NODE_ENV=development
JWT_SECRET=une_chaine_tres_secrete
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@exemple.local
ADMIN_PASSWORD=MotDePasse123!
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VEHICLE_DATABASE_API_URL=https://api.api-ninjas.com/v1/vehicles
VEHICLE_DATABASE_API_KEY=ta_clef_api_vehicle_db
UNSPLASH_ACCESS_KEY=ta_clef_unsplash
```

---

## Lancement du serveur

- **Développement** : `npm run dev`
- **Production** : `npm start`

Le serveur démarre sur `http://localhost:5000` (modifiable via `PORT`).

---

## Structure des dossiers

- `src/app.js` : configuration Express, routes, middlewares
- `src/server.js` : point d’entrée, connexion DB, création admin
- `src/config/` : config DB & Stripe
- `src/controllers/` : logique métier (auth, admin, commandes, véhicules)
- `src/models/` : schémas Mongoose (User, Order, Vehicle)
- `src/routes/` : routes Express (auth, admin, véhicules, commandes, paiements, webhook)
- `src/services/vehicleDatabaseService.js` : import de véhicules via API externe
- `src/middlewares/` : middlewares d’auth, gestion d’erreurs

---

## Principaux endpoints API

### Authentification
- `POST /api/auth/register` : inscription utilisateur
- `POST /api/auth/login` : connexion (retourne un JWT)
- `GET /api/auth/profile` : profil utilisateur (protégé)

### Véhicules
- `GET /api/vehicles` : liste des véhicules
- `GET /api/vehicles/:id` : détail d’un véhicule
- `POST /api/vehicles` : ajouter un véhicule (admin)
- `PUT /api/vehicles/:id` : modifier (admin)
- `DELETE /api/vehicles/:id` : supprimer (admin)

### Commandes
- `POST /api/orders` : créer une commande (utilisateur connecté)
- `GET /api/orders` : mes commandes (utilisateur connecté)
- `GET /api/orders/:id` : détail d’une commande

### Paiement
- `POST /api/payments/create-payment-intent` : créer un PaymentIntent Stripe (retourne clientSecret)
- `POST /api/stripe/webhook` : endpoint Stripe pour recevoir les événements de paiement (utilisé par Stripe, pas par le frontend)

### Admin
- `GET /api/admin/users` : liste des utilisateurs (admin)
- `GET /api/admin/orders` : toutes les commandes (admin)

---

## Authentification & Sécurité
- Auth basée sur JWT : le token est à envoyer dans l’en-tête `Authorization: Bearer <token>` pour toutes les routes protégées.
- Un admin est créé automatiquement au démarrage si inexistant (infos dans `.env`).
- Les routes admin sont protégées par un middleware (`adminOnly`).

---

## Paiement & Webhooks Stripe
- Le frontend doit d’abord créer un PaymentIntent via `/api/payments/create-payment-intent`.
- Stripe appelle `/api/stripe/webhook` pour notifier le backend du succès/échec du paiement : le backend met à jour la commande.
- Pour tester en local, utilise Stripe CLI :
  ```powershell
  stripe listen --forward-to localhost:5000/api/stripe/webhook
  stripe trigger payment_intent.succeeded
  ```
- Le champ `paymentInfo` de la commande est mis à jour après succès Stripe.

---

## Import de véhicules (optionnel)
- Le service `importCarsFromVehicleDatabase` permet d’importer des véhicules depuis une API externe (API Ninjas).
- Nécessite les variables `VEHICLE_DATABASE_API_URL` et `VEHICLE_DATABASE_API_KEY`.
- Peut être appelé manuellement ou automatisé (voir code commenté dans `src/server.js`).

---

## Conseils pour le frontend
- **Connexion** : utilise `/api/auth/login` pour obtenir un JWT, stocke-le côté client (localStorage ou cookie sécurisé).
- **Appels API protégés** : ajoute le header `Authorization: Bearer <token>`.
- **Liste véhicules** : `/api/vehicles` (GET)
- **Commander** : `/api/orders` (POST, body : véhicule, infos client)
- **Paiement** : 
  1. Crée un PaymentIntent côté backend
  2. Utilise Stripe.js côté frontend avec le `clientSecret` reçu
  3. Le backend met à jour la commande via le webhook Stripe
- **Suivi commandes** : `/api/orders` (GET)
- **Admin** : routes spécifiques, nécessite un compte admin (voir `.env`)

---

## Annexes
- **Tests** : `npm test` (Jest, Supertest)
- **Logs** : Morgan (console)
- **CORS** : activé pour tous les domaines (modifie dans `src/app.js` si besoin)
- **Erreurs** : middleware global, format JSON

---

Pour toute question ou besoin d’exemple d’appel API (fetch/Axios), demande !# LE_GBA-FRONTEND
