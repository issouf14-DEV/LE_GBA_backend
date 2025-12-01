# Configuration de l'envoi d'emails - GBA Backend

## 📧 Service d'emails configuré

Le backend utilise maintenant **Nodemailer** avec Gmail pour envoyer des emails réels (plus de simulation console).

---

## 🔧 Configuration Gmail

### Étape 1 : Créer un mot de passe d'application Gmail

1. **Activez la validation en deux étapes** sur votre compte Gmail :
   - Allez sur : https://myaccount.google.com/security
   - Cherchez "Validation en deux étapes" et activez-la

2. **Créez un mot de passe d'application** :
   - Allez sur : https://myaccount.google.com/apppasswords
   - Sélectionnez "Autre (nom personnalisé)"
   - Tapez : `GBA Backend`
   - Cliquez sur **Générer**
   - **Copiez le mot de passe à 16 caractères** (sans espaces)

### Étape 2 : Configurer les variables d'environnement

#### En local (.env)
Créez un fichier `.env` à la racine du projet :

```env
# Email Configuration
EMAIL_USER=votre-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop

# Admin Email (pour recevoir les notifications)
ADMIN_EMAIL=admin@gba.com
```

#### Sur Render.com
1. Allez dans votre service backend sur Render
2. Allez dans **Environment** (Variables d'environnement)
3. Ajoutez ces variables :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `EMAIL_USER` | `votre-email@gmail.com` | Compte Gmail utilisé pour envoyer les emails |
| `EMAIL_APP_PASSWORD` | `abcdefghijklmnop` | Mot de passe d'application Gmail (16 caractères) |
| `ADMIN_EMAIL` | `admin@gba.com` | Email de l'admin (reçoit les notifications de commandes) |

4. Cliquez sur **Save Changes**
5. Le service redémarrera automatiquement

---

## 📬 Routes API créées

### 1. Notification à l'admin (nouvelle commande)
**Endpoint** : `POST /api/orders/notify-admin`

**Headers** :
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** :
```json
{
  "orderId": "674c8e1234567890abcdef12",
  "customerName": "Jean Dupont",
  "customerEmail": "jean.dupont@example.com",
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
    "messageId": "<abc123@gmail.com>",
    "message": "Email envoyé avec succès à l'administrateur"
  }
}
```

---

### 2. Confirmation au client (validation/rejet)
**Endpoint** : `POST /api/orders/:id/send-notification`

**Headers** :
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body** :
```json
{
  "status": "approved"
}
```
ou
```json
{
  "status": "rejected"
}
```

**Réponse** :
```json
{
  "message": "Email de confirmation envoyé au client",
  "result": {
    "success": true,
    "messageId": "<xyz789@gmail.com>",
    "message": "Email de confirmation (approved) envoyé avec succès au client"
  }
}
```

---

## 🚀 Utilisation dans le frontend

### Exemple : Envoyer notification après création de commande

```javascript
// Après qu'un client crée une commande
const notifyAdminAfterOrder = async (orderData) => {
  try {
    const response = await fetch('https://your-backend.onrender.com/api/orders/notify-admin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderData._id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehicleYear: vehicle.year,
        pickupDate: orderData.pickupDate,
        returnDate: orderData.returnDate,
        totalPrice: orderData.totalPrice,
      }),
    });

    const result = await response.json();
    console.log('✅ Admin notifié:', result);
  } catch (error) {
    console.error('❌ Erreur notification admin:', error);
  }
};
```

### Exemple : Admin valide/rejette une commande

```javascript
// Quand l'admin valide ou rejette une commande
const sendOrderDecision = async (orderId, status) => {
  try {
    const response = await fetch(`https://your-backend.onrender.com/api/orders/${orderId}/send-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: status, // 'approved' ou 'rejected'
      }),
    });

    const result = await response.json();
    console.log('✅ Client notifié:', result);
  } catch (error) {
    console.error('❌ Erreur notification client:', error);
  }
};
```

---

## 🧪 Tester la configuration

### Test manuel avec cURL

```bash
# 1. Notification admin
curl -X POST https://your-backend.onrender.com/api/orders/notify-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST123",
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "+33 6 12 34 56 78",
    "vehicleMake": "Toyota",
    "vehicleModel": "Camry",
    "vehicleYear": "2023",
    "pickupDate": "2025-12-15",
    "returnDate": "2025-12-20",
    "totalPrice": 350
  }'

# 2. Confirmation client
curl -X POST https://your-backend.onrender.com/api/orders/ORDER_ID/send-notification \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

## 🎨 Aperçu des emails

### Email à l'admin (nouvelle commande)
- **Sujet** : `🚗 Nouvelle commande #ORDER_ID`
- **Contient** :
  - Informations du client (nom, email, téléphone)
  - Détails du véhicule (marque, modèle, année)
  - Dates de location
  - Prix total
  - Avertissement pour valider/rejeter

### Email au client (validation)
- **Sujet** : `✅ Commande confirmée #ORDER_ID`
- **Contient** :
  - Message de confirmation positif
  - Récapitulatif de la réservation
  - Prochaines étapes à suivre
  - Coordonnées de contact

### Email au client (rejet)
- **Sujet** : `❌ Commande refusée #ORDER_ID`
- **Contient** :
  - Message d'excuse
  - Récapitulatif de la demande
  - Invitation à contacter pour alternatives

---

## ⚠️ Limites Gmail

Gmail impose des limites d'envoi :
- **500 emails/jour** pour les comptes gratuits
- **2000 emails/jour** pour Google Workspace

Pour des volumes plus importants, considérez :
- **SendGrid** (100 emails/jour gratuits, puis payant)
- **Mailgun**
- **Amazon SES**

---

## 🔒 Sécurité

✅ **Bonnes pratiques appliquées** :
- Mots de passe d'application (pas le mot de passe principal)
- Variables d'environnement (pas hardcodées)
- Logs en console pour traçabilité
- Gestion d'erreurs appropriée

❌ **À ne JAMAIS faire** :
- Commit le fichier `.env` dans Git
- Partager le mot de passe d'application
- Utiliser le mot de passe principal Gmail

---

## 📝 Logs

Les emails génèrent des logs dans la console :

```
✅ Email envoyé à l'admin: <abc123@gmail.com>
✅ Email de confirmation (approved) envoyé au client: <xyz789@gmail.com>
❌ Erreur lors de l'envoi de l'email: Invalid credentials
```

---

## 🆘 Dépannage

### Erreur : "Invalid credentials"
- Vérifiez que la validation en 2 étapes est activée
- Régénérez un mot de passe d'application
- Vérifiez les variables `EMAIL_USER` et `EMAIL_APP_PASSWORD`

### Erreur : "Connection timeout"
- Vérifiez votre connexion internet
- Gmail peut bloquer temporairement (attendez quelques minutes)

### Les emails n'arrivent pas
- Vérifiez les **spams/courrier indésirable**
- Vérifiez que `ADMIN_EMAIL` est correct
- Testez avec un autre compte email destinataire

---

## 📚 Ressources

- [Documentation Nodemailer](https://nodemailer.com/)
- [Mots de passe d'application Gmail](https://support.google.com/accounts/answer/185833)
- [Limites d'envoi Gmail](https://support.google.com/mail/answer/22839)

---

**Configuration terminée ! 🎉**
