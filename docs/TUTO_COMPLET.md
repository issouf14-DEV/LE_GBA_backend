# 📚 Documentation Complète - Configuration Email GBA Backend

Bienvenue dans la documentation complète du système d'envoi d'emails pour le backend GBA.

---

## 🚀 Démarrage Rapide

### Configuration en 5 minutes

#### 1. Installer les dépendances
```bash
npm install
```

#### 2. Obtenir un mot de passe d'application Gmail

1. Allez sur : https://myaccount.google.com/apppasswords
2. Activez la validation en 2 étapes (si nécessaire)
3. Créez un mot de passe d'application nommé "GBA Backend"
4. Copiez le mot de passe à 16 caractères (supprimez les espaces)

#### 3. Configurer le fichier `.env`

Créez un fichier `.env` à la racine avec :

```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/gba?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production

# Admin (recevra les notifications de commandes)
ADMIN_NAME=Fofana Issouf
ADMIN_EMAIL=fofanaissouf179@gmail.com
ADMIN_PASSWORD=Admin123!

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email Configuration (Gmail)
EMAIL_USER=fofanaissouf179@gmail.com
EMAIL_APP_PASSWORD=votre_mot_de_passe_16_caracteres
```

#### 4. Lancer le serveur
```bash
npm run dev
```

#### 5. Tester l'envoi d'un email

Importez `postman_collection.json` dans Postman et testez l'endpoint :
- `POST /api/orders/notify-admin`

---

## 📖 Table des Matières

### 1. Vue d'ensemble
- [Qu'est-ce qui a été ajouté ?](#quest-ce-qui-a-été-ajouté)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)

### 2. Installation et Configuration
- [Prérequis](#prérequis)
- [Installation locale](#installation-locale)
- [Configuration Gmail](#configuration-gmail)
- [Variables d'environnement](#variables-denvironnement)

### 3. Utilisation
- [Routes API](#routes-api)
- [Exemples d'appels](#exemples-dappels)
- [Tests](#tests)

### 4. Déploiement
- [Déploiement sur Render](#déploiement-sur-render)
- [Variables Render](#variables-render)
- [Vérification](#vérification)

### 5. Intégration Frontend
- [Service Email React](#service-email-react)
- [Composants](#composants)
- [Gestion des erreurs](#gestion-des-erreurs)

### 6. Référence
- [Structure du projet](#structure-du-projet)
- [Templates d'emails](#templates-demails)
- [Dépannage](#dépannage)

---

## Qu'est-ce qui a été ajouté ?

### Nouveaux fichiers créés

#### Backend
```
src/services/emailService.js    # Service Nodemailer avec 3 fonctions
```

#### Tests
```
postman_collection.json         # Collection de tests API
```

### Fichiers modifiés

```
src/controllers/orderController.js   # +2 fonctions (notifyAdmin, sendCustomerNotification)
src/routes/orderRoutes.js            # +2 routes API
package.json                         # +nodemailer
render.yaml                          # +variables EMAIL_USER et EMAIL_APP_PASSWORD
README.md                            # +section email
```

### Statistiques
- **3 fonctions** d'envoi d'emails
- **2 routes API** créées
- **2 variables** d'environnement ajoutées
- **Templates HTML** professionnels inclus

---

## Architecture

### Flux de notification Admin

```
Client crée une commande (Frontend)
           ↓
POST /api/orders/notify-admin
           ↓
orderController.notifyAdmin()
           ↓
emailService.sendNewOrderEmail()
           ↓
Nodemailer → Gmail SMTP
           ↓
Email reçu sur fofanaissouf179@gmail.com
```

### Flux de confirmation Client

```
Admin valide/rejette (Panel Admin)
           ↓
POST /api/orders/:id/send-notification
           ↓
orderController.sendCustomerNotification()
           ↓
emailService.sendOrderConfirmation(data, status)
           ↓
Nodemailer → Gmail SMTP
           ↓
Email reçu par le client
```

---

## Fonctionnalités

### ✅ Notification à l'Admin

Quand un client passe une commande, l'admin reçoit un email avec :
- Informations du client (nom, email, téléphone)
- Détails du véhicule (marque, modèle, année)
- Dates de récupération et retour
- Prix total
- Design HTML professionnel

**Route** : `POST /api/orders/notify-admin`

### ✅ Confirmation au Client

Quand l'admin valide ou rejette une commande :

**Validation** :
- Message positif et encourageant
- Récapitulatif de la réservation
- Prochaines étapes à suivre
- Coordonnées de contact

**Rejet** :
- Message d'excuse professionnel
- Explication du refus
- Invitation à réessayer
- Coordonnées de contact

**Route** : `POST /api/orders/:id/send-notification`

---

## Prérequis

- Node.js 18.x ou 20.x
- Compte Gmail avec validation en 2 étapes activée
- MongoDB (local ou Atlas)
- npm

---

## Installation locale

### 1. Cloner et installer
```bash
cd LE_GBA_backend-main
npm install
```

### 2. Créer le fichier `.env`
```bash
# Copier le template (déjà configuré avec votre email)
cp .env.example .env
```

### 3. Configurer les credentials
Ouvrez `.env` et modifiez :
- `MONGO_URI` : Votre URI MongoDB
- `JWT_SECRET` : Votre clé secrète JWT
- `STRIPE_SECRET_KEY` : Votre clé Stripe
- `EMAIL_APP_PASSWORD` : Le mot de passe d'application Gmail

---

## Configuration Gmail

### Étape 1 : Activer la validation en 2 étapes

1. Allez sur : https://myaccount.google.com/security
2. Cherchez "Validation en deux étapes"
3. Cliquez sur **Activer**
4. Suivez les instructions (SMS ou application)

### Étape 2 : Créer un mot de passe d'application

1. Allez sur : https://myaccount.google.com/apppasswords
2. Sélectionnez "Autre (nom personnalisé)"
3. Tapez : `GBA Backend`
4. Cliquez sur **Générer**
5. **Copiez** le mot de passe (exemple : `abcd efgh ijkl mnop`)
6. **Supprimez les espaces** : `abcdefghijklmnop`

### Étape 3 : Ajouter dans `.env`

```env
EMAIL_USER=fofanaissouf179@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
```

---

## Variables d'environnement

### Fichier `.env` complet

```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/gba

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Admin (reçoit les notifications)
ADMIN_NAME=Fofana Issouf
ADMIN_EMAIL=fofanaissouf179@gmail.com
ADMIN_PASSWORD=Admin123!

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Email (NOUVELLES VARIABLES)
EMAIL_USER=fofanaissouf179@gmail.com          # Compte Gmail émetteur
EMAIL_APP_PASSWORD=votre_mot_de_passe_16_car  # Mot de passe d'application
```

---

## Routes API

### 1. POST /api/orders/notify-admin

Envoie un email de notification à l'admin lors d'une nouvelle commande.

**Headers** :
```
Authorization: Bearer <user_token>
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

**Réponse (200)** :
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

### 2. POST /api/orders/:id/send-notification

Envoie un email de confirmation au client (validation ou rejet).

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
Ou :
```json
{
  "status": "rejected"
}
```

**Réponse (200)** :
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

## Exemples d'appels

### Avec cURL

```bash
# 1. Notification admin
curl -X POST http://localhost:5000/api/orders/notify-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'

# 2. Confirmation client (validation)
curl -X POST http://localhost:5000/api/orders/ORDER_ID/send-notification \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'

# 3. Confirmation client (rejet)
curl -X POST http://localhost:5000/api/orders/ORDER_ID/send-notification \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "rejected"}'
```

### Avec Postman

1. Importez `postman_collection.json`
2. Configurez la variable `{{baseUrl}}` : `http://localhost:5000`
3. Ajoutez votre token Bearer dans Authorization
4. Envoyez la requête

---

## Tests

### Test manuel complet

```bash
# 1. Démarrer le serveur
npm run dev

# 2. Vérifier les logs
# Devrait afficher : "Server running on port 5000"

# 3. Tester avec Postman
# Importer postman_collection.json
# Lancer "1. Notification Admin - Nouvelle Commande"

# 4. Vérifier l'email
# Ouvrir fofanaissouf179@gmail.com
# Chercher l'email (vérifier les spams)
```

### Logs attendus

```
✅ Email envoyé à l'admin: <messageId@gmail.com>
```

En cas d'erreur :
```
❌ Erreur lors de l'envoi de l'email: Error message
```

---

## Déploiement sur Render

### Étape 1 : Pousser le code sur GitHub

```bash
git add .
git commit -m "feat: Add email notification system with Nodemailer"
git push origin main
```

### Étape 2 : Configurer les variables sur Render

1. Allez sur https://render.com
2. Sélectionnez votre service **LE_GBA_backend**
3. Cliquez sur **Environment**
4. Cliquez sur **Add Environment Variable** ou **Modifier**

**Ajoutez ces variables** :

| Clé | Valeur |
|-----|--------|
| `EMAIL_USER` | `fofanaissouf179@gmail.com` |
| `EMAIL_APP_PASSWORD` | `votre_mot_de_passe_16_caracteres` |

**Modifiez cette variable** :

| Clé | Nouvelle Valeur |
|-----|-----------------|
| `ADMIN_EMAIL` | `fofanaissouf179@gmail.com` |

5. Cliquez sur **Save Changes**
6. Render redémarre automatiquement (2-3 minutes)

### Étape 3 : Vérifier les logs

1. Allez dans **Logs**
2. Vérifiez qu'il n'y a pas d'erreur
3. Cherchez : `Server running on port 5000`

### Étape 4 : Tester en production

```bash
curl -X POST https://le-gba-backend.onrender.com/api/orders/notify-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Variables Render

### Configuration complète sur Render

```yaml
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
ADMIN_NAME=Fofana Issouf
ADMIN_EMAIL=fofanaissouf179@gmail.com     # ← MODIFIÉ
ADMIN_PASSWORD=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://your-frontend.vercel.app
EMAIL_USER=fofanaissouf179@gmail.com      # ← NOUVEAU
EMAIL_APP_PASSWORD=abcdefghijklmnop       # ← NOUVEAU
```

---

## Service Email React

### Créer le service

```javascript
// src/services/api/emailService.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const notifyAdminNewOrder = async (orderData, token) => {
  const response = await fetch(`${API_URL}/api/orders/notify-admin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderId: orderData._id,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone || 'Non fourni',
      vehicleMake: orderData.vehicle.make,
      vehicleModel: orderData.vehicle.model,
      vehicleYear: orderData.vehicle.year,
      pickupDate: orderData.pickupDate,
      returnDate: orderData.returnDate,
      totalPrice: orderData.totalPrice,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la notification admin');
  }

  return response.json();
};

export const sendCustomerNotification = async (orderId, status, adminToken) => {
  const response = await fetch(`${API_URL}/api/orders/${orderId}/send-notification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la notification client');
  }

  return response.json();
};
```

---

## Composants

### Après création de commande

```jsx
// src/pages/CheckoutPage.jsx
import { notifyAdminNewOrder } from '../services/api/emailService';
import toast from 'react-hot-toast';

const CheckoutPage = () => {
  const handleOrderCreated = async (orderData) => {
    try {
      // 1. Créer la commande
      const order = await createOrder(orderData);
      
      // 2. Notifier l'admin par email
      await notifyAdminNewOrder(order, userToken);
      
      // 3. Feedback utilisateur
      toast.success('Commande créée ! L\'admin a été notifié.');
      
      // 4. Redirection
      navigate('/confirmation');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la création de la commande');
    }
  };

  return (
    <div>
      {/* Votre formulaire de commande */}
      <button onClick={() => handleOrderCreated(orderData)}>
        Confirmer la commande
      </button>
    </div>
  );
};
```

### Panel Admin - Validation/Rejet

```jsx
// src/pages/admin/OrderManagement.jsx
import { sendCustomerNotification } from '../../services/api/emailService';
import toast from 'react-hot-toast';

const OrderManagement = () => {
  const handleApproveOrder = async (orderId) => {
    try {
      // 1. Mettre à jour le statut
      await updateOrderStatus(orderId, 'approved');
      
      // 2. Envoyer l'email au client
      await sendCustomerNotification(orderId, 'approved', adminToken);
      
      // 3. Feedback
      toast.success('Commande validée et client notifié !');
      
      // 4. Recharger
      fetchOrders();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la validation');
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      await updateOrderStatus(orderId, 'rejected');
      await sendCustomerNotification(orderId, 'rejected', adminToken);
      toast.info('Commande rejetée et client notifié.');
      fetchOrders();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du rejet');
    }
  };

  return (
    <div className="order-management">
      {orders.map(order => (
        <div key={order._id}>
          <h3>Commande #{order._id.slice(-6)}</h3>
          {order.status === 'en attente' && (
            <>
              <button onClick={() => handleApproveOrder(order._id)}>
                ✅ Valider
              </button>
              <button onClick={() => handleRejectOrder(order._id)}>
                ❌ Rejeter
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## Gestion des erreurs

### Avec React Query

```jsx
import { useMutation } from '@tanstack/react-query';
import { notifyAdminNewOrder } from '../services/api/emailService';

const useNotifyAdmin = () => {
  return useMutation({
    mutationFn: ({ orderData, token }) => notifyAdminNewOrder(orderData, token),
    onSuccess: () => {
      toast.success('Admin notifié !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
};

// Utilisation
const CheckoutPage = () => {
  const notifyAdmin = useNotifyAdmin();

  const handleOrderCreated = (order) => {
    notifyAdmin.mutate({ orderData: order, token: userToken });
  };

  return (
    <button 
      onClick={() => handleOrderCreated(order)}
      disabled={notifyAdmin.isPending}
    >
      {notifyAdmin.isPending ? 'Envoi...' : 'Créer la commande'}
    </button>
  );
};
```

---

## Structure du projet

```
LE_GBA_backend-main/
│
├── src/
│   ├── services/
│   │   └── emailService.js          # Service Nodemailer (NOUVEAU)
│   │
│   ├── controllers/
│   │   └── orderController.js       # +2 fonctions email
│   │
│   └── routes/
│       └── orderRoutes.js           # +2 routes API
│
├── docs/                            # NOUVEAU (tous les docs)
│
├── .env                             # Config locale (gitignored)
├── .env.example                     # Template (gitignored)
├── package.json                     # +nodemailer
├── render.yaml                      # +variables email
├── postman_collection.json          # Tests Postman
└── README.md                        # +section email
```

---

## Templates d'emails

### Email Admin (nouvelle commande)

```
Sujet: 🚗 Nouvelle commande #123

┌─────────────────────────────────────┐
│   Nouvelle commande de location     │
└─────────────────────────────────────┘

👤 Informations Client
   Nom: Jean Dupont
   Email: jean@example.com
   Téléphone: +33 6 12 34 56 78

🚗 Détails du Véhicule
   Véhicule: Toyota Camry (2023)
   Date de récupération: 15/12/2025
   Date de retour: 20/12/2025

💰 Prix Total
   350 €

⚠️ Veuillez vérifier et valider/rejeter
```

### Email Client (validation)

```
Sujet: ✅ Commande confirmée #123

Bonjour Jean Dupont,

🎉 Bonne nouvelle ! Votre commande a été validée.

📋 Récapitulatif:
   • Véhicule: Toyota Camry (2023)
   • Récupération: 15 décembre 2025
   • Retour: 20 décembre 2025
   • Prix: 350 €

📝 Prochaines étapes:
   ✓ Préparez vos documents
   ✓ Présentez-vous à l'agence
   ✓ Paiement à la récupération

Merci de votre confiance !
L'équipe GBA
```

---

## Dépannage

### Problème : "Invalid credentials"

**Cause** : Mot de passe d'application incorrect ou validation en 2 étapes non activée

**Solution** :
1. Vérifier que la validation en 2 étapes est activée
2. Régénérer un nouveau mot de passe d'application
3. Vérifier `EMAIL_USER` et `EMAIL_APP_PASSWORD` dans `.env`
4. Pas d'espaces dans le mot de passe

### Problème : Les emails n'arrivent pas

**Solutions** :
1. Vérifier les **Spams**
2. Vérifier que `ADMIN_EMAIL` = `fofanaissouf179@gmail.com`
3. Consulter les logs : chercher ✅ ou ❌
4. Tester avec un autre compte destinataire

### Problème : Erreur 500 sur l'API

**Solutions** :
1. Vérifier les logs backend
2. Vérifier que `nodemailer` est installé : `npm list nodemailer`
3. Vérifier les variables d'environnement
4. Redémarrer le serveur : `npm run dev`

### Problème : "Connection timeout"

**Solutions** :
1. Attendre quelques minutes (temporaire)
2. Vérifier la connexion internet
3. Vérifier que le compte Gmail n'est pas bloqué
4. Se connecter manuellement à Gmail depuis un navigateur

---

## Limites de Gmail

- **500 emails/jour** pour Gmail gratuit
- **2000 emails/jour** pour Google Workspace

### Alternatives pour volume élevé

- **SendGrid** : 100 emails/jour gratuits, puis payant
- **Mailgun** : 5000 emails/mois gratuits
- **Amazon SES** : Pay-as-you-go, très économique

---

## Checklist Finale

### Configuration locale
- [ ] Nodemailer installé (`npm install`)
- [ ] Validation en 2 étapes activée sur Gmail
- [ ] Mot de passe d'application Gmail créé
- [ ] Fichier `.env` configuré
- [ ] `EMAIL_USER` = `fofanaissouf179@gmail.com`
- [ ] `ADMIN_EMAIL` = `fofanaissouf179@gmail.com`
- [ ] `EMAIL_APP_PASSWORD` renseigné
- [ ] Serveur démarré sans erreur
- [ ] Email de test envoyé et reçu

### Configuration Render
- [ ] Code poussé sur GitHub
- [ ] Variables ajoutées sur Render Dashboard
- [ ] `EMAIL_USER` = `fofanaissouf179@gmail.com`
- [ ] `EMAIL_APP_PASSWORD` configuré
- [ ] `ADMIN_EMAIL` = `fofanaissouf179@gmail.com`
- [ ] Service redéployé
- [ ] Logs vérifiés (pas d'erreur)
- [ ] Email de test depuis production envoyé et reçu

### Intégration Frontend
- [ ] Service `emailService.js` créé
- [ ] Appel après création de commande
- [ ] Boutons Valider/Rejeter dans le panel admin
- [ ] Gestion des erreurs et loading states
- [ ] Toasts pour feedback utilisateur
- [ ] Tests en local
- [ ] Tests en production

---

## Ressources

### Documentation officielle
- [Nodemailer](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Render.com](https://render.com/docs)

### Fichiers du projet
- `src/services/emailService.js` : Code source du service
- `src/controllers/orderController.js` : Contrôleurs email
- `src/routes/orderRoutes.js` : Routes API
- `postman_collection.json` : Tests Postman

---

## Support

### En cas de problème
1. Consultez la section [Dépannage](#dépannage)
2. Vérifiez les logs de l'application
3. Testez avec Postman
4. Vérifiez les variables d'environnement

---

**Documentation complète - Version 1.1.0**

*Dernière mise à jour : 01 décembre 2025*

**Configuration terminée ! 🎉**

Vous pouvez maintenant envoyer des emails réels depuis votre backend GBA.
