# Guide Backend pour l'intégration Frontend

Ce guide résume l'essentiel pour connecter ton frontend au backend GBA.

---

## 🔗 URL de base
```
http://localhost:5000
```

---

## 🔑 Authentification

### Comment ça marche ?
1. L'utilisateur se connecte via `/api/auth/login`
2. Le backend retourne un **JWT token**
3. Stocke ce token (localStorage ou sessionStorage)
4. Envoie-le dans le header `Authorization: Bearer <token>` pour toutes les requêtes protégées

### Inscription
```javascript
POST /api/auth/register
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Réponse: {
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Connexion
```javascript
POST /api/auth/login
Body: {
  "email": "john@example.com",
  "password": "password123"
}

Réponse: {
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Profil utilisateur
```javascript
GET /api/auth/profile
Headers: {
  "Authorization": "Bearer <token>"
}

Réponse: {
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user"
}
```

---

## 🚗 Véhicules

### Liste des véhicules (public)
```javascript
GET /api/vehicles

Réponse: [
  {
    "_id": "...",
    "vin": "...",
    "brand": "Toyota",
    "model": "Camry",
    "year": 2020,
    "price": 25000,
    "miles": 45000,
    "image": "https://...",
    "photos": ["https://..."],
    "fuel": "Gasoline",
    "transmission": "Automatic",
    ...
  },
  ...
]
```

### Détail d'un véhicule (public)
```javascript
GET /api/vehicles/:id

Réponse: {
  "_id": "...",
  "brand": "Toyota",
  "model": "Camry",
  "year": 2020,
  "price": 25000,
  ...
}
```

### Ajouter un véhicule (admin uniquement)
```javascript
POST /api/vehicles
Headers: {
  "Authorization": "Bearer <admin_token>"
}
Body: {
  "vin": "1HGBH41JXMN109186",
  "brand": "Honda",
  "model": "Civic",
  "year": 2021,
  "price": 22000,
  "miles": 15000,
  ...
}
```

---

## 📦 Commandes

### Créer une commande
```javascript
POST /api/orders
Headers: {
  "Authorization": "Bearer <token>"
}
Body: {
  "vehicleId": "66abc123...",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+33 6 12 34 56 78",
  ...
}

Réponse: {
  "_id": "...",
  "user": "...",
  "vehicle": {...},
  "status": "en attente",
  "totalPrice": 25000,
  "createdAt": "2025-11-04T...",
  ...
}
```

### Mes commandes
```javascript
GET /api/orders
Headers: {
  "Authorization": "Bearer <token>"
}

Réponse: [
  {
    "_id": "...",
    "vehicle": {...},
    "status": "payée",
    "totalPrice": 25000,
    "paymentInfo": {
      "id": "pi_...",
      "status": "succeeded"
    },
    ...
  },
  ...
]
```

### Détail d'une commande
```javascript
GET /api/orders/:id
Headers: {
  "Authorization": "Bearer <token>"
}
```

---

## 💳 Paiement Stripe

### Étapes pour payer
1. **Créer un PaymentIntent** (backend)
2. **Utiliser Stripe.js** (frontend) avec le `clientSecret`
3. **Le webhook** met à jour automatiquement la commande

### Créer un PaymentIntent
```javascript
POST /api/payments/create-payment-intent
Headers: {
  "Authorization": "Bearer <token>"
}
Body: {
  "orderId": "66abc123..."
}

Réponse: {
  "clientSecret": "pi_..._secret_..."
}
```

### Exemple frontend (React + Stripe.js)
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');

// Dans ton composant de paiement
const stripe = useStripe();
const elements = useElements();

const handlePayment = async () => {
  const { clientSecret } = await createPaymentIntent(orderId);
  
  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: elements.getElement(CardElement),
    },
  });
  
  if (result.error) {
    console.error(result.error.message);
  } else {
    // Paiement réussi ! Le webhook backend met à jour la commande
    console.log('Paiement réussi !');
  }
};
```

---

## 👑 Admin

### Liste des utilisateurs (admin)
```javascript
GET /api/admin/users
Headers: {
  "Authorization": "Bearer <admin_token>"
}
```

### Toutes les commandes (admin)
```javascript
GET /api/admin/orders
Headers: {
  "Authorization": "Bearer <admin_token>"
}
```

---

## 📝 Exemple de service API (React)

Crée un fichier `src/api/api.js` :

```javascript
const API_URL = 'http://localhost:5000/api';

// Helper pour ajouter le token
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Auth
export const register = async (name, email, password) => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return res.json();
};

export const login = async (email, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

export const getProfile = async () => {
  const res = await fetch(`${API_URL}/auth/profile`, {
    headers: getHeaders(),
  });
  return res.json();
};

// Véhicules
export const getVehicles = async () => {
  const res = await fetch(`${API_URL}/vehicles`);
  return res.json();
};

export const getVehicle = async (id) => {
  const res = await fetch(`${API_URL}/vehicles/${id}`);
  return res.json();
};

// Commandes
export const createOrder = async (orderData) => {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(orderData),
  });
  return res.json();
};

export const getMyOrders = async () => {
  const res = await fetch(`${API_URL}/orders`, {
    headers: getHeaders(),
  });
  return res.json();
};

// Paiement
export const createPaymentIntent = async (orderId) => {
  const res = await fetch(`${API_URL}/payments/create-payment-intent`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ orderId }),
  });
  return res.json();
};
```

---

## 🔐 Variables d'environnement Frontend

Crée un fichier `.env` dans ton projet frontend :

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...
```

Utilise-les dans ton code :
```javascript
const API_URL = process.env.REACT_APP_API_URL;
```

---

## ✅ Checklist Frontend

- [ ] Créer le service API (`src/api/api.js`)
- [ ] Gérer l'auth (stocker le token, protéger les routes)
- [ ] Afficher la liste des véhicules
- [ ] Afficher le détail d'un véhicule
- [ ] Créer une commande
- [ ] Intégrer Stripe pour le paiement
- [ ] Afficher mes commandes
- [ ] (Admin) Gérer les utilisateurs et commandes

---

## 🚀 Pour démarrer

1. Lance le backend : `npm run dev`
2. Teste les routes avec Postman ou ton frontend
3. Utilise le guide ci-dessus pour les appels API

Bon courage ! 🎉
