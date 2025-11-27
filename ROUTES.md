# Documentation des routes API – GBA Backend

Ce document liste toutes les routes disponibles dans ce backend, avec : méthode, chemin, description, paramètres attendus, protection (auth/admin), et exemples de réponse.

---

## Authentification

### POST /api/auth/register
- **Description** : Inscription d’un nouvel utilisateur
- **Body** :
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Réponse** : JWT + infos utilisateur
- **Protection** : Public

### POST /api/auth/login
- **Description** : Connexion utilisateur
- **Body** :
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Réponse** : JWT + infos utilisateur
- **Protection** : Public

### GET /api/auth/profile
- **Description** : Récupérer le profil de l’utilisateur connecté
- **Headers** : `Authorization: Bearer <token>`
- **Réponse** : infos utilisateur
- **Protection** : Authentifié

---

## Véhicules

### GET /api/vehicles
- **Description** : Liste tous les véhicules
- **Réponse** : tableau de véhicules
- **Protection** : Public

### GET /api/vehicles/:id
- **Description** : Détail d’un véhicule
- **Paramètres** : `id` (ObjectId du véhicule)
- **Réponse** : objet véhicule
- **Protection** : Public

### POST /api/vehicles
- **Description** : Ajouter un véhicule
- **Body** : infos véhicule (voir modèle)
- **Headers** : `Authorization: Bearer <token>` (admin)
- **Protection** : Admin uniquement

### PUT /api/vehicles/:id
- **Description** : Modifier un véhicule
- **Paramètres** : `id` (ObjectId)
- **Body** : champs à modifier
- **Headers** : `Authorization: Bearer <token>` (admin)
- **Protection** : Admin uniquement

### DELETE /api/vehicles/:id
- **Description** : Supprimer un véhicule
- **Paramètres** : `id` (ObjectId)
- **Headers** : `Authorization: Bearer <token>` (admin)
- **Protection** : Admin uniquement

---

## Commandes

### POST /api/orders
- **Description** : Créer une commande pour un véhicule
- **Body** :
  ```json
  {
    "vehicleId": "string",
    "...autres infos client..."
  }
  ```
- **Headers** : `Authorization: Bearer <token>`
- **Protection** : Authentifié

### GET /api/orders
- **Description** : Liste des commandes de l’utilisateur connecté
- **Headers** : `Authorization: Bearer <token>`
- **Protection** : Authentifié

### GET /api/orders/:id
- **Description** : Détail d’une commande
- **Paramètres** : `id` (ObjectId)
- **Headers** : `Authorization: Bearer <token>`
- **Protection** : Authentifié

---

## Paiement

### POST /api/payments/create-payment-intent
- **Description** : Créer un PaymentIntent Stripe pour une commande
- **Body** :
  ```json
  {
    "orderId": "string"
  }
  ```
- **Headers** : `Authorization: Bearer <token>`
- **Réponse** : `{ clientSecret: "..." }`
- **Protection** : Authentifié

### POST /api/stripe/webhook
- **Description** : Endpoint Stripe pour recevoir les événements de paiement (utilisé par Stripe, pas par le frontend)
- **Body** : raw Stripe event
- **Protection** : Stripe uniquement

---

## Admin

### GET /api/admin/users
- **Description** : Liste tous les utilisateurs
- **Headers** : `Authorization: Bearer <token>` (admin)
- **Protection** : Admin uniquement

### GET /api/admin/orders
- **Description** : Liste toutes les commandes
- **Headers** : `Authorization: Bearer <token>` (admin)
- **Protection** : Admin uniquement

---

## Autres

### GET /
- **Description** : Message de bienvenue
- **Réponse** : `{ message: "Bienvenue sur l’API GBA 🚗" }`
- **Protection** : Public

---

## Notes générales
- Toutes les routes protégées nécessitent le header `Authorization: Bearer <token>`.
- Les routes admin nécessitent un compte admin (voir création dans `.env`).
- Les réponses d’erreur sont au format JSON : `{ message: "..." }`.
- Pour les routes POST/PUT, le body doit être en JSON (`Content-Type: application/json`).

Pour des exemples d’utilisation (fetch/Axios), demande si besoin !