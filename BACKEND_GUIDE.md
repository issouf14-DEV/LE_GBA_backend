# 🗺️ Guide Backend GBA - Navigation et Architecture

Ce guide vous aide à comprendre où se trouve chaque fonctionnalité dans le backend et comment tout fonctionne ensemble.

---

## 📁 Structure du Projet

```
LE_GBA_backend-main/
├── src/
│   ├── app.js                    # 🎯 Configuration principale Express
│   ├── server.js                 # 🚀 Point d'entrée + démarrage serveur
│   ├── config/                   # ⚙️ Configurations
│   │   ├── db.js                # MongoDB connexion
│   │   └── stripe.js            # Stripe configuration
│   ├── controllers/              # 🎮 Logique métier
│   │   ├── authController.js    # Authentification (login, register)
│   │   ├── vehicleController.js # CRUD véhicules
│   │   ├── orderController.js   # Gestion commandes
│   │   └── adminController.js   # Fonctions admin
│   ├── middlewares/              # 🛡️ Middlewares
│   │   ├── authMiddleware.js    # Protection routes (JWT)
│   │   └── errorMiddleware.js   # Gestion erreurs globales
│   ├── models/                   # 📊 Schémas MongoDB
│   │   ├── User.js              # Schéma utilisateur
│   │   ├── Vehicle.js           # Schéma véhicule
│   │   └── Order.js             # Schéma commande
│   ├── routes/                   # 🛣️ Définition des routes
│   │   ├── authRoutes.js        # Routes /api/auth/*
│   │   ├── vehicleRoutes.js     # Routes /api/vehicles/*
│   │   ├── orderRoutes.js       # Routes /api/orders/*
│   │   ├── adminRoutes.js       # Routes /api/admin/*
│   │   ├── payment.routes.js    # Routes /api/payments/*
│   │   └── webhookRoutes.js     # Routes /api/stripe/webhook
│   ├── services/                 # 🔧 Services métier
│   │   └── vehicleDatabaseService.js # Import véhicules externes
│   └── utils/                    # 🛠️ Utilitaires
│       └── payment.js           # Helpers paiement Stripe
├── .env.example                  # 📝 Variables d'environnement modèles
├── .gitignore                    # 🚫 Fichiers ignorés par Git
├── package.json                  # 📦 Dépendances Node.js
├── render.yaml                   # ☁️ Config déploiement Render
└── README.md                     # 📖 Documentation principale
```

---

## 🔍 Où Trouver Quoi ?

### 🔐 Authentification & Utilisateurs

**Je veux :** Comprendre/modifier l'authentification
- **Modèle User** → `src/models/User.js`
  - Schéma : name, email, password (hashé), role (user/admin)
  - Méthode `matchPassword()` pour vérifier mot de passe
  
- **Controller Auth** → `src/controllers/authController.js`
  - `register()` - Inscription nouvel utilisateur
  - `login()` - Connexion + génération JWT
  - `getProfile()` - Récupérer profil utilisateur connecté
  
- **Routes Auth** → `src/routes/authRoutes.js`
  - `POST /api/auth/register` - Inscription
  - `POST /api/auth/login` - Connexion
  - `GET /api/auth/profile` - Profil (protégé)

- **Middleware Protection** → `src/middlewares/authMiddleware.js`
  - `protect` - Vérifie JWT, attache `req.user`
  - `admin` - Vérifie si `req.user.role === 'admin'`

**Exemple d'utilisation :**
```javascript
// Dans une route protégée
router.get('/protected', protect, (req, res) => {
  // req.user contient les infos de l'utilisateur connecté
  res.json({ user: req.user });
});

// Route admin uniquement
router.delete('/admin-only', protect, admin, (req, res) => {
  // Seuls les admins peuvent accéder
});
```

---

### 🚗 Véhicules

**Je veux :** Gérer les véhicules
- **Modèle Vehicle** → `src/models/Vehicle.js`
  - Champs : brand, model, year, price, category, fuelType, transmission, seats, imageUrl, features, etc.
  
- **Controller Vehicle** → `src/controllers/vehicleController.js`
  - `getVehicles()` - Liste tous les véhicules (avec filtres)
  - `getVehicleById()` - Détails d'un véhicule
  - `createVehicle()` - Créer véhicule (admin)
  - `updateVehicle()` - Modifier véhicule (admin)
  - `deleteVehicle()` - Supprimer véhicule (admin)
  
- **Routes Vehicle** → `src/routes/vehicleRoutes.js`
  - `GET /api/vehicles` - Liste (public)
  - `GET /api/vehicles/:id` - Détail (public)
  - `POST /api/vehicles` - Créer (admin)
  - `PUT /api/vehicles/:id` - Modifier (admin)
  - `DELETE /api/vehicles/:id` - Supprimer (admin)

**Service d'import** → `src/services/vehicleDatabaseService.js`
- Fonction `importCarsFromVehicleDatabase()` pour importer depuis API externe
- Commenté dans `server.js` par défaut

---

### 📦 Commandes (Orders)

**Je veux :** Gérer les réservations/commandes
- **Modèle Order** → `src/models/Order.js`
  - Champs : user (ref), vehicle (ref), startDate, endDate, totalPrice, status, paymentInfo
  - Status possibles : pending, confirmed, cancelled, completed
  
- **Controller Order** → `src/controllers/orderController.js`
  - `createOrder()` - Créer nouvelle commande
  - `getMyOrders()` - Commandes de l'utilisateur connecté
  - `getOrderById()` - Détail d'une commande
  - `updateOrderStatus()` - Modifier statut (admin)
  
- **Routes Order** → `src/routes/orderRoutes.js`
  - `POST /api/orders` - Créer (authentifié)
  - `GET /api/orders/myorders` - Mes commandes (authentifié)
  - `GET /api/orders/:id` - Détail (authentifié)
  - `PUT /api/orders/:id/status` - Modifier statut (admin)

---

### 💳 Paiements (Stripe)

**Je veux :** Gérer les paiements
- **Config Stripe** → `src/config/stripe.js`
  - Initialisation Stripe avec `STRIPE_SECRET_KEY`
  
- **Utils Payment** → `src/utils/payment.js`
  - Fonctions helpers pour créer sessions Stripe
  
- **Routes Payment** → `src/routes/payment.routes.js`
  - `POST /api/payments/create-checkout-session` - Créer session paiement
  
- **Webhook Stripe** → `src/routes/webhookRoutes.js`
  - `POST /api/stripe/webhook` - Reçoit événements Stripe
  - ⚠️ **IMPORTANT** : Doit être AVANT `express.json()` dans `app.js`
  - Vérifie signature webhook avec `STRIPE_WEBHOOK_SECRET`
  - Met à jour commande quand paiement réussi

**Flow paiement :**
1. Frontend appelle `/api/payments/create-checkout-session`
2. Backend crée session Stripe et retourne URL
3. User paie sur Stripe
4. Stripe envoie webhook à `/api/stripe/webhook`
5. Backend met à jour commande en "confirmed"

---

### 👨‍💼 Administration

**Je veux :** Fonctions admin
- **Controller Admin** → `src/controllers/adminController.js`
  - `getAllUsers()` - Liste tous les utilisateurs
  - `deleteUser()` - Supprimer utilisateur
  - `getAllOrders()` - Liste toutes les commandes
  - Statistiques, dashboards, etc.
  
- **Routes Admin** → `src/routes/adminRoutes.js`
  - Toutes protégées par `protect` + `admin`
  - `GET /api/admin/users` - Liste users
  - `DELETE /api/admin/users/:id` - Supprimer user
  - `GET /api/admin/orders` - Liste orders

---

## 🔧 Configuration & Démarrage

### Variables d'Environnement (.env)

```bash
# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/gba

# JWT
JWT_SECRET=votre_secret_super_securise

# Admin (créé automatiquement au démarrage)
ADMIN_NAME=Admin GBA
ADMIN_EMAIL=admin@gba.com
ADMIN_PASSWORD=Admin123!

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
FRONTEND_URL=https://votre-frontend.vercel.app

# Server
PORT=5000
NODE_ENV=production
```

### Démarrage du Serveur (`server.js`)

**Séquence de démarrage :**
1. Charge les variables `.env`
2. Connecte à MongoDB (`connectDB()`)
3. Crée un admin si n'existe pas (`createAdmin()`)
4. (Optionnel) Importe véhicules (`importVehicles()`)
5. Lance le serveur Express sur le PORT

---

## 🛣️ Flow des Requêtes

### Exemple : Utilisateur réserve un véhicule

```
1. Frontend → POST /api/auth/login
   ↓
2. authController.login()
   ↓ Vérifie email/password
   ↓ Génère JWT
   ↓
3. Retourne { token, user }
   
4. Frontend → POST /api/orders (avec JWT dans header)
   ↓ Middleware protect vérifie JWT
   ↓
5. orderController.createOrder()
   ↓ Crée Order dans MongoDB
   ↓
6. Retourne { order }

7. Frontend → POST /api/payments/create-checkout-session
   ↓
8. Crée session Stripe
   ↓
9. Retourne { url } (URL Stripe Checkout)

10. User paie sur Stripe
    ↓
11. Stripe → POST /api/stripe/webhook
    ↓ Vérifie signature
    ↓ Met à jour Order.status = 'confirmed'
    ↓
12. Paiement confirmé ✅
```

---

## 🛡️ Middlewares Importants

### 1. authMiddleware.js
```javascript
protect    // Vérifie JWT, décode, attache req.user
admin      // Vérifie si req.user.role === 'admin'
```

### 2. errorMiddleware.js
```javascript
notFound      // Gère routes inexistantes (404)
errorHandler  // Gère toutes les erreurs de l'app
```

### Utilisation dans app.js
```javascript
// Ordre important !
app.use("/api/stripe", webhookRoutes);  // AVANT express.json()
app.use(express.json());                // Parse JSON
app.use(cors(corsOptions));             // CORS configuré

// Routes...

app.use(notFound);       // Catch 404
app.use(errorHandler);   // Catch erreurs
```

---

## 🔍 Cas d'Usage Fréquents

### ❓ Comment ajouter une nouvelle route ?

**Exemple :** Ajouter `GET /api/vehicles/featured`

1. **Controller** (`vehicleController.js`) :
```javascript
export const getFeaturedVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ featured: true }).limit(6);
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

2. **Route** (`vehicleRoutes.js`) :
```javascript
import { getFeaturedVehicles } from '../controllers/vehicleController.js';

router.get('/featured', getFeaturedVehicles);
```

3. **Tester** :
```bash
GET http://localhost:5000/api/vehicles/featured
```

---

### ❓ Comment protéger une route ?

```javascript
import { protect, admin } from '../middlewares/authMiddleware.js';

// Route authentifiée uniquement
router.get('/profile', protect, getProfile);

// Route admin uniquement
router.delete('/users/:id', protect, admin, deleteUser);
```

---

### ❓ Comment ajouter un champ au modèle User ?

**Dans `models/User.js` :**
```javascript
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  
  // ✅ Nouveau champ
  phone: { type: String },
  address: { type: String },
}, { timestamps: true });
```

**Puis modifier le controller si nécessaire.**

---

### ❓ Comment débugger une erreur ?

1. **Vérifier les logs du serveur** - Les erreurs s'affichent dans la console
2. **Vérifier `errorMiddleware.js`** - Ajouter plus de logs si besoin
3. **Tester avec Postman/Thunder Client** - Isoler les problèmes frontend/backend
4. **Vérifier les variables d'environnement** - `.env` bien configuré ?
5. **Vérifier MongoDB** - La connexion fonctionne ? Collections créées ?

---

### ❓ Comment tester les webhooks Stripe localement ?

1. **Installer Stripe CLI** :
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

2. **Copier le webhook secret** affiché dans `.env`

3. **Simuler un événement** :
```bash
stripe trigger payment_intent.succeeded
```

---

## 📊 Base de Données MongoDB

### Collections

| Collection | Modèle | Description |
|-----------|--------|-------------|
| `users` | User.js | Utilisateurs (clients + admins) |
| `vehicles` | Vehicle.js | Véhicules disponibles à la location |
| `orders` | Order.js | Commandes/réservations |

### Relations

```
Order
  ├─ user (ref → User._id)
  └─ vehicle (ref → Vehicle._id)
```

**Exemple de populate :**
```javascript
const order = await Order.findById(id)
  .populate('user', 'name email')
  .populate('vehicle', 'brand model price');
```

---

## 🚀 Déploiement sur Render

### Checklist

- [ ] Variables d'environnement configurées sur Render
- [ ] `MONGO_URI` pointe vers MongoDB Atlas (pas local)
- [ ] `FRONTEND_URL` est l'URL du frontend en production
- [ ] `NODE_ENV=production`
- [ ] Webhook Stripe configuré avec l'URL Render : `https://votre-app.onrender.com/api/stripe/webhook`
- [ ] Tester `/health` endpoint : doit retourner `{ status: "OK" }`

### URLs importantes

- **API Base** : `https://votre-app.onrender.com`
- **Health Check** : `https://votre-app.onrender.com/health`
- **Webhook Stripe** : `https://votre-app.onrender.com/api/stripe/webhook`

---

## 📞 Endpoints Résumé

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/` | Non | Accueil API |
| GET | `/health` | Non | Health check |
| **AUTH** |
| POST | `/api/auth/register` | Non | Inscription |
| POST | `/api/auth/login` | Non | Connexion |
| GET | `/api/auth/profile` | User | Profil |
| **VEHICLES** |
| GET | `/api/vehicles` | Non | Liste véhicules |
| GET | `/api/vehicles/:id` | Non | Détail véhicule |
| POST | `/api/vehicles` | Admin | Créer véhicule |
| PUT | `/api/vehicles/:id` | Admin | Modifier véhicule |
| DELETE | `/api/vehicles/:id` | Admin | Supprimer véhicule |
| **ORDERS** |
| POST | `/api/orders` | User | Créer commande |
| GET | `/api/orders/myorders` | User | Mes commandes |
| GET | `/api/orders/:id` | User | Détail commande |
| PUT | `/api/orders/:id/status` | Admin | Modifier statut |
| **PAYMENTS** |
| POST | `/api/payments/create-checkout-session` | User | Session paiement |
| **WEBHOOKS** |
| POST | `/api/stripe/webhook` | Non | Webhook Stripe |
| **ADMIN** |
| GET | `/api/admin/users` | Admin | Liste users |
| DELETE | `/api/admin/users/:id` | Admin | Supprimer user |
| GET | `/api/admin/orders` | Admin | Liste orders |

---

## 🐛 Problèmes Fréquents

### "JWT malformed" ou "No token"
→ Vérifier que le token est envoyé dans le header : `Authorization: Bearer <token>`

### "CORS policy error"
→ Vérifier `FRONTEND_URL` dans `.env` et `corsOptions` dans `app.js`

### "MongoNetworkError"
→ Vérifier `MONGO_URI`, whitelist IP sur MongoDB Atlas

### "Stripe signature verification failed"
→ Vérifier `STRIPE_WEBHOOK_SECRET` correspond au webhook configuré

### "Admin not created"
→ Vérifier variables `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` dans `.env`

---

## 🎯 Points Clés à Retenir

1. **app.js** = Configuration Express (middlewares, routes)
2. **server.js** = Démarrage serveur + initialisation
3. **Controllers** = Logique métier (que faire ?)
4. **Routes** = Définition endpoints (quel chemin ?)
5. **Models** = Structure données MongoDB
6. **Middlewares** = Interceptent requêtes (auth, erreurs)
7. **Webhook Stripe** DOIT être avant `express.json()`
8. **JWT** stocké côté frontend, vérifié par `protect` middleware

---

## 📚 Ressources

- [Express.js](https://expressjs.com/)
- [Mongoose](https://mongoosejs.com/)
- [JWT](https://jwt.io/)
- [Stripe Docs](https://stripe.com/docs/api)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Render Docs](https://render.com/docs)

---

**Dernière mise à jour :** 27 novembre 2025
**Version Backend :** 1.0.0
