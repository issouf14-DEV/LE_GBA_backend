# 🚀 Configuration Render - Variables d'environnement

## 📋 Variables à configurer sur Render.com

Allez sur votre dashboard Render → Votre service → **Environment** et ajoutez :

### 🔐 Authentification & Base de données
```
NODE_ENV=production
MONGO_URI=mongodb+srv://votre-uri-mongodb
JWT_SECRET=votre-secret-jwt-aleatoire-32-caracteres
```

### 👤 Admin par défaut
```
ADMIN_NAME=Admin GBA
ADMIN_EMAIL=fofanaissouf179@gmail.com
ADMIN_PASSWORD=votre-mot-de-passe-admin-securise
```

### 💳 Stripe
```
STRIPE_SECRET_KEY=sk_live_xxxx (ou sk_test_xxxx pour test)
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

### 🌐 Frontend
```
FRONTEND_URL=https://votre-frontend.vercel.app
```

### 📧 Configuration Email (NOUVEAU)
```
EMAIL_USER=fofanaissouf179@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx (16 caractères)
```

## 📧 Comment obtenir EMAIL_APP_PASSWORD ?

1. Allez sur https://myaccount.google.com/apppasswords
2. Connectez-vous avec votre compte Gmail
3. Cliquez sur "Générer" (ou "Generate")
4. Nommez l'application : "GBA Backend"
5. Copiez le mot de passe de 16 caractères (format: xxxx xxxx xxxx xxxx)
6. Collez-le dans Render **SANS LES ESPACES** : `xxxxxxxxxxxxxxxx`

## ✅ Routes email disponibles après déploiement

### Routes automatiques
- `POST /api/auth/register` → Envoie automatiquement l'email de bienvenue

### Routes manuelles (admin seulement)
- `POST /api/auth/send-welcome-email` → Email de bienvenue manuel
- `POST /api/orders/notify-admin` → Notification admin nouvelle commande
- `POST /api/orders/:id/send-notification` → Confirmation/rejet client
- `POST /api/orders/:id/send-payment-reminder` → Rappel de paiement
- `POST /api/orders/:id/send-rental-summary` → Récapitulatif de location

## 🔄 Déploiement

**Render redéploie automatiquement** après chaque push sur `main`.

Vérifiez sur : https://dashboard.render.com/

## 🧪 Test des routes

Après déploiement, testez avec :
```bash
curl https://votre-backend.onrender.com/health
```

Devrait retourner :
```json
{"status":"OK","timestamp":"2025-12-01T..."}
```

## 📌 Checklist finale

- [ ] Toutes les variables d'environnement ajoutées sur Render
- [ ] EMAIL_APP_PASSWORD configuré (16 caractères)
- [ ] ADMIN_EMAIL = fofanaissouf179@gmail.com
- [ ] Déploiement réussi (logs verts sur Render)
- [ ] Route `/health` fonctionne
- [ ] Routes email testées avec Postman

## ⚠️ Important

- **Ne jamais commit** les vraies valeurs dans `.env`
- Render utilise le fichier `render.yaml` comme template
- Les vraies valeurs sont dans le dashboard Render → Environment
- Le redéploiement prend environ 2-3 minutes

---

**Dernière mise à jour :** Commit `f4fd638` - Routes email ajoutées ✅
