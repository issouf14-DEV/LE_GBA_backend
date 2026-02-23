# GBA Backend

API REST Node.js pour la gestion de véhicules, commandes, utilisateurs et paiements.

## Technologies

- **Node.js** / **Express**
- **MongoDB** (Mongoose)
- **Stripe** (Paiements)
- **JWT** (Authentification)
- **Nodemailer** (Emails)

## Installation

```bash
npm install
```


## Lancement

```bash
# Développement
npm run dev

# Production
npm start
```

## Structure du projet

```
src/
├── app.js              # Configuration Express
├── server.js           # Point d'entrée
├── config/             # Configuration DB & Stripe
├── controllers/        # Logique métier
├── middlewares/        # Auth & gestion d'erreurs
├── models/             # Schémas Mongoose
├── routes/             # Routes API
└── services/           # Services (emails, import)
```

## API Endpoints

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/profile` | Profil (auth) |

### Véhicules
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/vehicles` | Liste |
| GET | `/api/vehicles/:id` | Détail |
| POST | `/api/vehicles` | Créer (admin) |
| PUT | `/api/vehicles/:id` | Modifier (admin) |
| DELETE | `/api/vehicles/:id` | Supprimer (admin) |

### Commandes
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/orders` | Créer (auth) |
| GET | `/api/orders` | Mes commandes (auth) |
| GET | `/api/orders/:id` | Détail |

### Paiements
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/payments/create-payment-intent` | Créer PaymentIntent |
| POST | `/api/stripe/webhook` | Webhook Stripe |

### Administration
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/admin/users` | Utilisateurs (admin) |
| GET | `/api/admin/orders` | Commandes (admin) |

## Authentification

Toutes les routes protégées nécessitent le header :

```
Authorization: Bearer <token>
```

## Tests

```bash
npm test
```

## Licence

MIT
