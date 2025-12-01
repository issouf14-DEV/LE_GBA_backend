# 📂 Structure du Projet - Configuration Email Complète

## Fichiers créés et modifiés

### ✨ Nouveaux fichiers

#### Services
```
src/services/emailService.js
```
Service Nodemailer avec 3 fonctions principales :
- `sendNewOrderEmail()` - Email à l'admin
- `sendOrderConfirmation()` - Email au client
- `testEmailConfiguration()` - Test de config

#### Documentation
```
EMAIL_CONFIGURATION.md      - Guide complet d'utilisation
RENDER_EMAIL_SETUP.md        - Guide de déploiement Render
EMAIL_SUMMARY.md             - Récapitulatif des changements
QUICK_START.md               - Démarrage rapide en 5 minutes
FRONTEND_INTEGRATION.md      - Exemples React pour le frontend
postman_collection.json      - Collection de tests Postman
```

### 📝 Fichiers modifiés

#### Backend
```
src/controllers/orderController.js  - Ajout de 2 fonctions
src/routes/orderRoutes.js           - Ajout de 2 routes API
package.json                        - Ajout de nodemailer
```

#### Configuration
```
.env.example                        - Ajout variables email
.env                                - Créé avec config locale
render.yaml                         - Ajout variables Render
README.md                           - Section email ajoutée
```

---

## 🗂️ Arborescence complète

```
LE_GBA_backend-main/
│
├── 📄 Documentation
│   ├── README.md                      ← Modifié (section email)
│   ├── BACKEND_GUIDE.md
│   ├── FRONTEND_GUIDE.md
│   ├── ROUTES.md
│   │
│   ├── 📧 Email (NOUVEAUX)
│   ├── EMAIL_CONFIGURATION.md         ← Guide complet
│   ├── RENDER_EMAIL_SETUP.md          ← Déploiement Render
│   ├── EMAIL_SUMMARY.md               ← Récapitulatif
│   ├── QUICK_START.md                 ← Démarrage rapide
│   └── FRONTEND_INTEGRATION.md        ← Exemples React
│
├── 🔧 Configuration
│   ├── .env                           ← CRÉÉ (à personnaliser)
│   ├── .env.example                   ← Modifié (+ email vars)
│   ├── .gitignore                     ← Déjà configuré
│   ├── package.json                   ← Modifié (+ nodemailer)
│   ├── render.yaml                    ← Modifié (+ email vars)
│   └── postman_collection.json        ← NOUVEAU (tests API)
│
├── 📁 src/
│   │
│   ├── app.js
│   ├── server.js
│   │
│   ├── 📁 config/
│   │   ├── db.js
│   │   └── stripe.js
│   │
│   ├── 📁 controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── orderController.js         ← MODIFIÉ (+ 2 fonctions)
│   │   └── vehicleController.js
│   │
│   ├── 📁 middlewares/
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   │
│   ├── 📁 models/
│   │   ├── Order.js
│   │   ├── User.js
│   │   └── Vehicle.js
│   │
│   ├── 📁 routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── orderRoutes.js             ← MODIFIÉ (+ 2 routes)
│   │   ├── payment.routes.js
│   │   ├── vehicleRoutes.js
│   │   └── webhookRoutes.js
│   │
│   ├── 📁 services/
│   │   ├── vehicleDatabaseService.js
│   │   └── emailService.js            ← NOUVEAU (service email)
│   │
│   └── 📁 utils/
│       └── payment.js
│
└── 📁 node_modules/
    └── nodemailer/                     ← NOUVEAU (installé)
```

---

## 🔄 Flux de fonctionnement

### 1️⃣ Notification Admin (Nouvelle commande)

```
Frontend (React)
    │
    │ 1. Client crée une commande
    │    (après paiement Stripe)
    ↓
POST /api/orders/notify-admin
    │
    │ 2. Backend reçoit la requête
    ↓
orderController.notifyAdmin()
    │
    │ 3. Appelle le service email
    ↓
emailService.sendNewOrderEmail()
    │
    │ 4. Nodemailer envoie l'email
    ↓
Gmail SMTP
    │
    │ 5. Email reçu
    ↓
Boîte mail de l'admin (ADMIN_EMAIL)
```

### 2️⃣ Confirmation Client (Validation/Rejet)

```
Panel Admin (React)
    │
    │ 1. Admin clique sur Valider/Rejeter
    ↓
POST /api/orders/:id/send-notification
    │
    │ 2. Backend reçoit { status: "approved" }
    ↓
orderController.sendCustomerNotification()
    │
    │ 3. Récupère les infos de la commande
    │    (Order + User + Vehicle populate)
    ↓
emailService.sendOrderConfirmation(data, status)
    │
    │ 4. Génère le bon template (approved/rejected)
    │    Nodemailer envoie l'email
    ↓
Gmail SMTP
    │
    │ 5. Email reçu
    ↓
Boîte mail du client (user.email)
```

---

## 🔑 Variables d'environnement

### Locales (.env)
```env
# Existantes
MONGO_URI=...
JWT_SECRET=...
ADMIN_NAME=...
ADMIN_EMAIL=admin@gba.com              # ← Reçoit les notifications
ADMIN_PASSWORD=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
FRONTEND_URL=...

# NOUVELLES (Email)
EMAIL_USER=votre-email@gmail.com       # ← Compte Gmail émetteur
EMAIL_APP_PASSWORD=abcdefghijklmnop    # ← Mot de passe d'application
```

### Render.com (Production)
```yaml
# Dans render.yaml
envVars:
  - key: NODE_ENV
  - key: MONGO_URI
  - key: JWT_SECRET
  - key: ADMIN_NAME
  - key: ADMIN_EMAIL
  - key: ADMIN_PASSWORD
  - key: STRIPE_SECRET_KEY
  - key: STRIPE_WEBHOOK_SECRET
  - key: FRONTEND_URL
  
  # NOUVELLES
  - key: EMAIL_USER                    # ← À configurer sur Render
  - key: EMAIL_APP_PASSWORD            # ← À configurer sur Render
```

---

## 📡 API Endpoints (Email)

### 1. Notification Admin
```http
POST /api/orders/notify-admin
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "orderId": "674c8e1234567890abcdef12",
  "customerName": "Jean Dupont",
  "customerEmail": "jean@example.com",
  "customerPhone": "+33 6 12 34 56 78",
  "vehicleMake": "Toyota",
  "vehicleModel": "Camry",
  "vehicleYear": "2023",
  "pickupDate": "2025-12-15T10:00:00Z",
  "returnDate": "2025-12-20T10:00:00Z",
  "totalPrice": 350
}
```

**Réponse** :
```json
{
  "message": "Email de notification envoyé à l'administrateur",
  "result": {
    "success": true,
    "messageId": "<abc@gmail.com>",
    "message": "Email envoyé avec succès à l'administrateur"
  }
}
```

### 2. Confirmation Client
```http
POST /api/orders/:orderId/send-notification
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved"
}
```

**Réponse** :
```json
{
  "message": "Email de confirmation envoyé au client",
  "result": {
    "success": true,
    "messageId": "<xyz@gmail.com>",
    "message": "Email de confirmation (approved) envoyé avec succès au client"
  }
}
```

---

## 🧪 Tests

### Test manuel avec cURL

```bash
# 1. Test notification admin
curl -X POST http://localhost:5000/api/orders/notify-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "orderId": "TEST123",
  "customerName": "Test User",
  "customerEmail": "test@test.com",
  "customerPhone": "+33 6 12 34 56 78",
  "vehicleMake": "Toyota",
  "vehicleModel": "Camry",
  "vehicleYear": "2023",
  "pickupDate": "2025-12-15T10:00:00Z",
  "returnDate": "2025-12-20T10:00:00Z",
  "totalPrice": 350
}
EOF

# 2. Test confirmation client
curl -X POST http://localhost:5000/api/orders/ORDER_ID/send-notification \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### Test avec Postman
1. Importer `postman_collection.json`
2. Configurer la variable `{{baseUrl}}`
3. Ajouter les tokens d'authentification
4. Lancer les requêtes

---

## 📊 Logs et Debugging

### Logs du service email

```javascript
// Console lors d'un envoi réussi
✅ Email envoyé à l'admin: <abc123@gmail.com>
✅ Email de confirmation (approved) envoyé au client: <xyz789@gmail.com>

// Console en cas d'erreur
❌ Erreur lors de l'envoi de l'email à l'admin: Error: Invalid credentials
❌ Erreur lors de l'envoi de l'email de confirmation: Error: Connection timeout
```

### Vérifier les logs sur Render
1. Dashboard Render → Service → **Logs**
2. Chercher les lignes avec ✅ ou ❌
3. Vérifier les erreurs Gmail

---

## 🔐 Sécurité

### ✅ Bonnes pratiques appliquées
- Mots de passe d'application Gmail (pas le mot de passe principal)
- Variables d'environnement (pas hardcodées)
- `.env` dans `.gitignore`
- Authentification JWT sur les endpoints
- Middleware `adminOnly` pour les routes sensibles
- Validation des données avant envoi

### ⚠️ À ne jamais faire
- Commit le fichier `.env`
- Hardcoder les credentials
- Utiliser le mot de passe Gmail principal
- Partager `EMAIL_APP_PASSWORD`
- Logger les mots de passe en console

---

## 📚 Dépendances

### Nouvelles dépendances
```json
{
  "dependencies": {
    "nodemailer": "^6.9.x"
  }
}
```

### Installation
```bash
npm install nodemailer
```

---

## 🚀 Déploiement

### Checklist avant déploiement
- [ ] Tests en local réussis
- [ ] Variables `.env` configurées
- [ ] `render.yaml` mis à jour
- [ ] Code poussé sur GitHub
- [ ] Variables configurées sur Render Dashboard
- [ ] Service redéployé
- [ ] Tests en production réussis

### Commandes Git
```bash
git add .
git commit -m "feat: Add email notification system with Nodemailer"
git push origin main
```

---

## 📞 Support

### En cas de problème

1. **Vérifier les variables** : `.env` et Render
2. **Consulter les logs** : Console locale ou Render
3. **Tester Gmail** : Se connecter manuellement
4. **Vérifier les spams** : Boîte mail destinataire
5. **Consulter la doc** : `EMAIL_CONFIGURATION.md`

### Ressources
- [Nodemailer Docs](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Render Docs](https://render.com/docs)

---

**Configuration complète ! 🎉**

Votre backend est prêt à envoyer des emails en production.
