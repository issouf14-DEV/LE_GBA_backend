# 🎯 GUIDE ENTRETIEN TECHNIQUE - Projet GBA Location

**Projet:** Plateforme de location de véhicules  
**Stack:** MERN (MongoDB, Express, React, Node.js)  
**Déploiement:** Backend Render + Frontend Railway  
**Date:** Décembre 2025

---

## 📋 TABLE DES MATIÈRES

1. [Architecture Générale](#architecture)
2. [Authentification & Sécurité](#authentification)
3. [Gestion des Données](#donnees)
4. [Paiements Stripe](#paiements)
5. [Système d'Emails](#emails)
6. [CORS & Déploiement](#cors)
7. [Gestion d'Erreurs](#erreurs)
8. [Points Techniques à Mentionner](#points-techniques)

---

## 🏗️ ARCHITECTURE GÉNÉRALE {#architecture}

### Stack Technique

**Backend (Node.js/Express):**
```
- Express.js (API REST)
- MongoDB + Mongoose (base de données)
- JWT (authentification)
- Stripe (paiements)
- SendGrid (emails transactionnels)
- bcryptjs (hachage mots de passe)
```

**Frontend (React):**
```
- React 18 + Vite
- React Router (navigation)
- Axios (requêtes API)
- TailwindCSS (styling)
- Context API (gestion état global)
```

**Déploiement:**
```
- Backend: Render (auto-deploy depuis GitHub)
- Frontend: Railway
- Base de données: MongoDB Atlas (cloud)
```

### Architecture MVC

```
src/
├── models/          # Modèles Mongoose (User, Vehicle, Order)
├── controllers/     # Logique métier
├── routes/          # Endpoints API
├── middlewares/     # Auth, erreurs, validation
├── services/        # Services externes (email, Stripe)
└── config/          # Configuration (DB, Stripe)
```

**Séparation des responsabilités:**
- **Models** : Schémas et validation des données
- **Controllers** : Logique métier (CRUD, règles métier)
- **Routes** : Définition des endpoints et middleware
- **Services** : Communications externes (API tierces)

---

## 🔐 AUTHENTIFICATION & SÉCURITÉ {#authentification}

### 1. Authentification JWT

**Comment ça fonctionne:**

```javascript
// Lors de la connexion (authController.js)
const token = jwt.sign(
  { userId: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Middleware de protection (authMiddleware.js)
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded; // Utilisateur disponible dans les routes
```

**Points clés à mentionner:**
- ✅ Token stocké côté client (localStorage)
- ✅ Expiration automatique (7 jours)
- ✅ Vérifié à chaque requête protégée
- ✅ Contient userId et role (pour autorisation)

### 2. Hachage des Mots de Passe

**Implémentation avec bcryptjs:**

```javascript
// Dans le modèle User.js (pre-save hook)
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Méthode de comparaison
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
```

**Sécurité:**
- ✅ Salt unique par utilisateur (10 rounds)
- ✅ Impossible de retrouver le mot de passe original
- ✅ Comparaison sécurisée avec `bcrypt.compare()`

### 3. Autorisation par Rôles

**Middleware admin:**

```javascript
export const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};
```

**Utilisation:**
```javascript
router.put('/orders/:id/status', protect, adminOnly, updateOrderStatus);
```

**Points clés:**
- ✅ 2 rôles : `user` et `admin`
- ✅ Vérification en cascade (auth → role)
- ✅ Admin créé automatiquement au démarrage (server.js)

### 4. Variables d'Environnement

**Sécurisation des secrets:**

```env
JWT_SECRET=clé_secrète_unique_64_caractères
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/gba
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG.xxx...
```

**Points clés:**
- ✅ Jamais commitées dans Git (.gitignore)
- ✅ Différentes en dev/prod
- ✅ Chargées avec dotenv
- ✅ Configurées sur Render (dashboard)

---

## 💾 GESTION DES DONNÉES {#donnees}

### 1. Modèles Mongoose

**User Model (models/User.js):**

```javascript
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: /^\S+@\S+\.\S+$/  // Validation email
  },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });
```

**Vehicle Model:**

```javascript
const VehicleSchema = new mongoose.Schema({
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  pricePerDay: { type: Number, required: true },
  category: { type: String, enum: ['compact', 'sedan', 'suv', 'luxury'] },
  available: { type: Boolean, default: true },
  imageUrl: String
}, { timestamps: true });
```

**Order Model:**

```javascript
const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPrice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  stripePaymentIntentId: String
}, { timestamps: true });
```

**Points clés à mentionner:**
- ✅ Validation au niveau schéma (required, enum, match)
- ✅ Relations entre collections (ref)
- ✅ Timestamps automatiques (createdAt, updatedAt)
- ✅ Indexes pour performance (unique sur email)

### 2. Requêtes Complexes

**Populate (jointures):**

```javascript
// Récupérer une commande avec user et vehicle complets
const order = await Order.findById(orderId)
  .populate('user', 'name email')  // Sélection de champs
  .populate('vehicle', 'make model pricePerDay');
```

**Filtres et pagination:**

```javascript
// Récupérer véhicules disponibles avec pagination
const vehicles = await Vehicle.find({ available: true })
  .sort({ createdAt: -1 })
  .limit(10)
  .skip((page - 1) * 10);
```

**Aggregation:**

```javascript
// Statistiques admin (CA par mois)
const stats = await Order.aggregate([
  { $match: { status: 'completed', paymentStatus: 'paid' } },
  { $group: {
      _id: { $month: '$createdAt' },
      totalRevenue: { $sum: '$totalPrice' },
      orderCount: { $sum: 1 }
  }},
  { $sort: { _id: 1 } }
]);
```

---

## 💳 PAIEMENTS STRIPE {#paiements}

### 1. Payment Intent

**Flow complet:**

```javascript
// 1. Création du Payment Intent (backend)
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(totalPrice * 100), // Centimes
  currency: 'eur',
  metadata: {
    orderId: order._id.toString(),
    userId: user._id.toString()
  }
});

// 2. Frontend affiche le formulaire Stripe Elements
// 3. Confirmation du paiement (frontend)
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});

// 4. Webhook reçoit la confirmation (backend)
stripe.webhooks.constructEvent(
  req.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

**Points clés:**
- ✅ Payment Intent (préautorisation avant capture)
- ✅ Montants en centimes (pas d'arrondis flottants)
- ✅ Metadata pour traçabilité
- ✅ Webhooks pour confirmation asynchrone

### 2. Webhooks Stripe

**Gestion des événements:**

```javascript
const event = stripe.webhooks.constructEvent(
  req.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);

switch (event.type) {
  case 'payment_intent.succeeded':
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'paid',
      status: 'confirmed'
    });
    await sendConfirmationEmail(order);
    break;
    
  case 'payment_intent.payment_failed':
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'failed'
    });
    break;
}
```

**Sécurité:**
- ✅ Signature vérifiée (évite les faux webhooks)
- ✅ Idempotence (même event traité 1 seule fois)
- ✅ Route webhook AVANT express.json() (raw body nécessaire)

### 3. Gestion d'Erreurs Stripe

```javascript
try {
  const paymentIntent = await stripe.paymentIntents.create({...});
} catch (error) {
  if (error.type === 'StripeCardError') {
    // Carte refusée
    return res.status(400).json({ 
      message: 'Carte refusée',
      code: error.code 
    });
  }
  // Autre erreur Stripe
  console.error('Stripe error:', error);
  return res.status(500).json({ message: 'Erreur de paiement' });
}
```

---

## 📧 SYSTÈME D'EMAILS {#emails}

### 1. Migration Nodemailer → SendGrid

**Problème initial:**
- ❌ Nodemailer (SMTP Gmail) → Ports bloqués sur Render
- ❌ Emails non livrés en production

**Solution:**
```javascript
// Avant (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// Après (SendGrid API REST)
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: user.email,
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: 'Bienvenue sur GBA Location',
  html: emailTemplate
});
```

**Avantages SendGrid:**
- ✅ API REST (HTTPS) - pas de ports bloqués
- ✅ Plus fiable que SMTP
- ✅ Analytics intégrés
- ✅ Gestion bounces/spam automatique

### 2. Types d'Emails Envoyés

**Email de bienvenue:**
```javascript
export const sendWelcomeEmail = async (user) => {
  const msg = {
    to: user.email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: '🚗 Bienvenue sur GBA Location',
    html: `
      <h2>Bonjour ${user.name} !</h2>
      <p>Merci de vous être inscrit...</p>
    `
  };
  await sgMail.send(msg);
};
```

**Notification admin (nouvelle commande):**
```javascript
export const sendNewOrderEmail = async (orderData) => {
  await sgMail.send({
    to: process.env.ADMIN_EMAIL,
    subject: `🚗 Nouvelle commande #${orderData.orderId}`,
    html: `
      <h2>Nouvelle commande</h2>
      <p>Client: ${orderData.customerName}</p>
      <p>Véhicule: ${orderData.vehicleMake} ${orderData.vehicleModel}</p>
      <p>Prix: ${orderData.totalPrice}€</p>
    `
  });
};
```

**Confirmation de commande:**
```javascript
export const sendOrderConfirmationEmail = async (order) => {
  // Envoyé après paiement réussi
  // Contient détails location + reçu
};
```

**Points clés:**
- ✅ Templates HTML avec inline CSS
- ✅ Emails transactionnels déclenchés par actions
- ✅ Gestion d'erreurs (n'interrompt pas le flow)

### 3. Configuration SendGrid

**Variables nécessaires:**
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=no-reply@votredomaine.com
ADMIN_EMAIL=admin@gba.com
```

**Vérification expéditeur:**
- Dashboard SendGrid → Sender Authentication
- Vérifier email via lien
- Utiliser email vérifié comme FROM

---

## 🌐 CORS & DÉPLOIEMENT {#cors}

### 1. Configuration CORS Dynamique

**Problème:**
- Frontend sur Railway, Backend sur Render
- Erreur CORS bloque les requêtes cross-origin

**Solution implémentée:**

```javascript
// Configuration multi-origines
const allowedOrigins = [
  'http://localhost:5173',      // Dev Vite
  'http://localhost:3000',      // Dev React
  process.env.FRONTEND_URL      // Variable Render
].filter(Boolean);

// Fonction de validation
const isAllowedOrigin = (origin) => {
  if (!origin) return true;  // Postman, curl
  if (origin.includes('.railway.app')) return true;  // Tous Railway
  return allowedOrigins.includes(origin);
};

// Configuration CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // Cookies/auth headers
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

**Points clés à mentionner:**
- ✅ Credentials: true (pour JWT dans headers)
- ✅ Whitelist dynamique (dev + prod)
- ✅ Support wildcard pour Railway (*.railway.app)
- ✅ Logs pour debugging

### 2. Déploiement Render

**Configuration render.yaml:**

```yaml
services:
  - type: web
    name: gba-backend
    env: node
    region: frankfurt
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: SENDGRID_API_KEY
        sync: false
      - key: FRONTEND_URL
        sync: false
```

**Auto-deploy:**
- ✅ Push sur GitHub main → Build automatique
- ✅ Variables d'environnement séparées
- ✅ Health check endpoint `/health`

### 3. Optimisations Production

**Compression & Sécurité:**

```javascript
import helmet from 'helmet';
import compression from 'compression';

app.use(helmet());        // Headers sécurité
app.use(compression());   // Compression gzip
```

**Rate Limiting:**

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requêtes par IP
});

app.use('/api/', limiter);
```

**Logs:**

```javascript
import morgan from 'morgan';

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
```

---

## ⚠️ GESTION D'ERREURS {#erreurs}

### 1. Middleware d'Erreurs Centralisé

**errorMiddleware.js:**

```javascript
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Erreur Mongoose validation
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ 
      message: 'Erreur de validation',
      errors 
    });
  }

  // Erreur Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(400).json({ 
      message: 'Cet email est déjà utilisé' 
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      message: 'Token invalide' 
    });
  }

  // Erreur générique
  res.status(err.statusCode || 500).json({
    message: err.message || 'Erreur serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route ${req.originalUrl} non trouvée` });
};
```

**Utilisation:**

```javascript
// À la fin de app.js
app.use(notFound);
app.use(errorHandler);
```

### 2. Try-Catch Async

**Pattern dans les controllers:**

```javascript
export const createOrder = async (req, res, next) => {
  try {
    const { vehicleId, startDate, endDate } = req.body;

    // Validation
    if (!vehicleId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    // Logique métier
    const order = await Order.create({
      user: req.user.userId,
      vehicle: vehicleId,
      startDate,
      endDate,
      totalPrice: calculatePrice(startDate, endDate, vehicle.pricePerDay)
    });

    res.status(201).json(order);
  } catch (error) {
    next(error); // Passe au middleware d'erreurs
  }
};
```

### 3. Erreurs Personnalisées

```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Utilisation
throw new AppError('Véhicule non trouvé', 404);
```

---

## 🎯 POINTS TECHNIQUES À MENTIONNER {#points-techniques}

### 1. Choix d'Architecture

**Pourquoi MERN ?**
- ✅ JavaScript fullstack (même langage frontend/backend)
- ✅ MongoDB flexible (schéma évolutif)
- ✅ React performant (Virtual DOM)
- ✅ Node.js async (gestion concurrence)

**Pourquoi Express ?**
- ✅ Minimaliste et extensible
- ✅ Middleware pattern flexible
- ✅ Large écosystème

### 2. Sécurité Implémentée

✅ **Authentification JWT** (stateless, scalable)  
✅ **Hachage bcrypt** (salt unique, 10 rounds)  
✅ **Validation Mongoose** (au niveau schéma)  
✅ **CORS configuré** (whitelist origines)  
✅ **Helmet.js** (headers HTTP sécurisés)  
✅ **Rate limiting** (protection DDoS)  
✅ **Variables d'environnement** (secrets sécurisés)  
✅ **HTTPS** (Render/Railway par défaut)

### 3. Performance & Scalabilité

**Optimisations:**
- ✅ Indexes MongoDB (unique, recherche rapide)
- ✅ Populate sélectif (évite over-fetching)
- ✅ Pagination (limit/skip)
- ✅ Compression gzip
- ✅ CDN pour assets statiques

**Scalabilité:**
- ✅ Stateless (JWT permet horizontal scaling)
- ✅ MongoDB Atlas (auto-scaling)
- ✅ Render (multiple instances)

### 4. Tests & Qualité

**Tests à implémenter (mentionner comme amélioration):**
```javascript
// Tests unitaires (Jest)
describe('User Model', () => {
  it('should hash password on save', async () => {
    const user = new User({ email: 'test@test.com', password: '123456' });
    await user.save();
    expect(user.password).not.toBe('123456');
  });
});

// Tests d'intégration (Supertest)
describe('POST /api/auth/register', () => {
  it('should create new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: '123456', name: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });
});
```

### 5. Améliorations Futures

**À mentionner comme évolution:**

✅ **Upload d'images** (Cloudinary/S3)  
✅ **Notifications temps réel** (Socket.io)  
✅ **Cache Redis** (sessions, données fréquentes)  
✅ **Recherche avancée** (Elasticsearch)  
✅ **CI/CD** (GitHub Actions)  
✅ **Monitoring** (Sentry, DataDog)  
✅ **Analytics** (Google Analytics, Mixpanel)  
✅ **Système de reviews** (notes véhicules)  
✅ **Géolocalisation** (agences, carte)  
✅ **Multi-langues** (i18n)

---

## 💡 CONSEILS POUR L'ENTRETIEN

### Questions Fréquentes

**1. "Pourquoi JWT plutôt que sessions ?"**
- Stateless (pas de stockage serveur)
- Scalable (horizontal scaling facile)
- Mobile-friendly (pas de cookies)
- Microservices-ready

**2. "Comment gérez-vous la sécurité ?"**
- JWT avec expiration
- Bcrypt (10 rounds)
- Validation stricte (Mongoose + middleware)
- CORS configuré
- Helmet.js pour headers
- HTTPS en production

**3. "Expliquez le flow d'une commande"**
1. User sélectionne véhicule + dates
2. Frontend crée commande (POST /api/orders)
3. Backend vérifie disponibilité
4. Création Payment Intent Stripe
5. Frontend affiche formulaire paiement
6. Confirmation paiement
7. Webhook Stripe → mise à jour commande
8. Email confirmation envoyé

**4. "Comment testez-vous l'application ?"**
- Postman (tests API manuels)
- Collection Postman exportée
- Tests unitaires à venir (Jest)
- Tests d'intégration à venir (Supertest)

**5. "Quelle est la partie la plus complexe ?"**
- Intégration Stripe (webhooks, sécurité)
- CORS multi-environnements
- Migration emails (Nodemailer → SendGrid)
- Gestion états commandes (pending → paid → confirmed)

### Ce Qu'il Faut Savoir Expliquer

✅ **Flow authentification complet** (register → login → protected route)  
✅ **Schéma de données** (User, Vehicle, Order avec relations)  
✅ **Middleware chain** (CORS → JSON → Auth → Route → Error)  
✅ **Payment Intent Stripe** (création → confirmation → webhook)  
✅ **Configuration CORS** (pourquoi, comment, origines autorisées)  
✅ **Déploiement** (Render auto-deploy, variables env, health check)  
✅ **Gestion erreurs** (try-catch → middleware centralisé)

### Vocabulaire Technique à Utiliser

- **RESTful API** (GET, POST, PUT, DELETE)
- **Middleware** (fonctions interceptrices)
- **JWT** (JSON Web Token)
- **Hashing** (bcrypt, salt)
- **CORS** (Cross-Origin Resource Sharing)
- **ORM** (Mongoose = ODM pour MongoDB)
- **Webhook** (callback HTTP asynchrone)
- **Payment Intent** (préautorisation Stripe)
- **Populate** (équivalent JOIN SQL)
- **Aggregation** (pipeline MongoDB)

---

## 📊 STATISTIQUES DU PROJET

**Backend:**
- 📁 8 routes principales
- 🎯 3 modèles Mongoose
- 🔐 2 middlewares d'authentification
- 📧 6 types d'emails
- 💳 3 webhooks Stripe
- ⚙️ 15+ variables d'environnement

**Sécurité:**
- ✅ JWT (7 jours expiration)
- ✅ Bcrypt (10 rounds)
- ✅ CORS configuré
- ✅ Helmet.js
- ✅ Rate limiting
- ✅ Validation stricte

**Performance:**
- ✅ Indexes MongoDB
- ✅ Populate sélectif
- ✅ Pagination
- ✅ Compression gzip

---

## 🎓 RÉSUMÉ POUR L'ENTRETIEN

**"J'ai développé une plateforme de location de véhicules avec le stack MERN."**

**Architecture:**
- API REST avec Express
- MongoDB pour les données
- Authentification JWT avec bcrypt
- Paiements Stripe (Payment Intent + webhooks)
- Emails transactionnels SendGrid

**Sécurité:**
- JWT stateless avec expiration
- Mots de passe hachés (bcrypt 10 rounds)
- CORS configuré pour multi-environnements
- Validation stricte Mongoose
- Helmet.js et rate limiting

**Défis techniques relevés:**
- Intégration Stripe (webhooks signature vérifiée)
- CORS dynamique (dev + prod Railway/Render)
- Migration emails (SMTP bloqué → SendGrid API)
- Gestion états complexes (commandes + paiements)

**Déploiement:**
- Backend Render (auto-deploy GitHub)
- Frontend Railway
- MongoDB Atlas (cloud)
- Variables d'environnement sécurisées
- Health checks et monitoring

**Améliorations futures:**
- Tests automatisés (Jest, Supertest)
- Upload images (Cloudinary)
- Cache Redis
- Notifications temps réel (Socket.io)

---

**Bonne chance pour ton entretien ! 🚀**

*Tu maîtrises un projet fullstack complet avec authentification, paiements, emails et déploiement cloud - c'est largement suffisant pour impressionner !*
