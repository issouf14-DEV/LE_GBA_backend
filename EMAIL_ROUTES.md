# 📮 Routes Email - API GBA Backend

## 🔐 Routes Authentification (`/api/auth`)

### 1. Inscription avec email de bienvenue automatique
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
**Réponse :** User + JWT Token  
**Email envoyé automatiquement :** ✅ Email de bienvenue

---

### 2. Email de bienvenue manuel (Admin uniquement)
```http
POST /api/auth/send-welcome-email
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```
**Réponse :**
```json
{
  "message": "Email de bienvenue envoyé avec succès",
  "result": { "accepted": ["john@example.com"], "messageId": "..." }
}
```

---

## 📦 Routes Commandes (`/api/orders`)

### 3. Notification admin - Nouvelle commande
```http
POST /api/orders/notify-admin
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "vehicleMake": "Toyota",
  "vehicleModel": "Corolla",
  "vehicleYear": "2023",
  "pickupDate": "2025-12-10",
  "returnDate": "2025-12-20",
  "totalPrice": 500
}
```
**Email envoyé à :** `fofanaissouf179@gmail.com` (admin)

---

### 4. Confirmation/Rejet au client (Admin uniquement)
```http
POST /api/orders/:orderId/send-notification
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "approved"  // ou "rejected"
}
```
**Email envoyé au :** Client de la commande

---

### 5. Rappel de paiement (Admin uniquement)
```http
POST /api/orders/:orderId/send-payment-reminder
Authorization: Bearer YOUR_ADMIN_TOKEN
```
**Email envoyé au :** Client avec détails du paiement en attente

**Body optionnel :** (sera calculé automatiquement depuis la commande)

---

### 6. Récapitulatif de location (Admin uniquement)
```http
POST /api/orders/:orderId/send-rental-summary
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "startDate": "2025-12-10",
  "endDate": "2025-12-20",
  "startKm": 10000,
  "endKm": 10500,
  "fuelLevelStart": "Plein",
  "fuelLevelEnd": "3/4",
  "vehicleCondition": "Bon état",
  "additionalCharges": 50,
  "additionalChargesReason": "Nettoyage intérieur"
}
```
**Email envoyé au :** Client avec le récapitulatif complet

---

## 🧪 Exemples de tests avec cURL

### Test route health
```bash
curl https://votre-backend.onrender.com/health
```

### Test inscription (avec email automatique)
```bash
curl -X POST https://votre-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### Test notification admin
```bash
curl -X POST https://votre-backend.onrender.com/api/orders/notify-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "vehicleMake": "Toyota",
    "vehicleModel": "Corolla",
    "vehicleYear": "2023",
    "pickupDate": "2025-12-10",
    "returnDate": "2025-12-20",
    "totalPrice": 500
  }'
```

---

## 📊 Résumé des permissions

| Route | Authentification | Rôle Admin |
|-------|------------------|------------|
| `POST /api/auth/register` | ❌ Non | ❌ Non |
| `POST /api/auth/send-welcome-email` | ✅ Oui | ✅ Oui |
| `POST /api/orders/notify-admin` | ✅ Oui | ❌ Non |
| `POST /api/orders/:id/send-notification` | ✅ Oui | ✅ Oui |
| `POST /api/orders/:id/send-payment-reminder` | ✅ Oui | ✅ Oui |
| `POST /api/orders/:id/send-rental-summary` | ✅ Oui | ✅ Oui |

---

## 🎯 URLs complètes (une fois déployé)

**Local :**
```
http://localhost:5000/api/auth/register
http://localhost:5000/api/orders/notify-admin
```

**Production (Render) :**
```
https://votre-backend.onrender.com/api/auth/register
https://votre-backend.onrender.com/api/orders/notify-admin
```

---

## ⚙️ Configuration requise

Variables d'environnement sur Render :
- `EMAIL_USER=fofanaissouf179@gmail.com`
- `EMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx` (16 caractères)
- `ADMIN_EMAIL=fofanaissouf179@gmail.com`

---

**Dernière mise à jour :** 1er décembre 2025  
**Version :** v1.2.0 (Commit `f4fd638`)
