# LE-GBA - API backend

API REST de LE-GBA, application de location de véhicules. Elle fournit :
- le **catalogue** public des véhicules (recherche, filtres, tri, photos) ;
- les **réservations** des clients, avec **paiement à la remise du véhicule** et, si activé, **acompte en ligne par Mobile Money** (CinetPay) ;
- l'**administration** : gestion du catalogue, des réservations, des comptes et tableau de bord.

Technologies : Node.js (>= 20, modules ES), Express 5, MongoDB avec Mongoose 8, Zod 4, JSON Web Tokens en cookies httpOnly, Brevo (ou SendGrid) pour les emails, Vitest pour les tests.

---

## Démarrage local

### Prérequis

- Node.js 20 ou plus récent
- Une base MongoDB (locale ou Atlas)

### Installation

```bash
npm install
cp .env.example .env
```

Renseignez ensuite `.env` (voir la section suivante). Les deux secrets JWT doivent être **différents** et faire au moins 32 caractères aléatoires. Pour en générer un :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

En local, laissez `PROXY_SECRET` vide et `TRUST_PROXY_HOPS=0`.

Lancez l'API en mode développement (redémarrage automatique avec nodemon) :

```bash
npm run dev
```

L'API écoute sur `http://localhost:5000` (port modifiable via `PORT`). La route `GET /health` répond `{ "status": "ok" }`.

Au démarrage, si `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont renseignés et qu'aucun compte n'existe avec cet email, un premier compte administrateur est créé (le mot de passe doit respecter les règles de robustesse, sinon le compte n'est pas créé et un message l'indique).

---

## Variables d'environnement

Elles sont validées au démarrage par `src/config/env.js` : si une variable obligatoire manque ou est invalide, le serveur affiche l'erreur et refuse de démarrer.

| Nom                                                           | Rôle                                                                                                                                                                                   | Obligatoire                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `NODE_ENV`                                                    | `development`, `production` ou `test` (défaut : `development`). En production : cookies `Secure` préfixés `__Secure-`, origines de développement refusées.                             | Non                                |
| `PORT`                                                        | Port d'écoute (défaut : `5000`).                                                                                                                                                       | Non                                |
| `MONGO_URI`                                                   | Chaîne de connexion MongoDB.                                                                                                                                                           | Oui                                |
| `JWT_ACCESS_SECRET`                                           | Secret de signature des jetons d'accès (32 caractères minimum).                                                                                                                        | Oui                                |
| `JWT_REFRESH_SECRET`                                          | Secret distinct, utilisé pour l'empreinte HMAC des jetons de renouvellement et de réinitialisation (32 caractères minimum).                                                            | Oui                                |
| `FRONTEND_URL`                                                | Adresse(s) exacte(s) du frontend, séparées par des virgules (ex. `https://votre-frontend.vercel.app`). La première sert aussi aux liens des emails.                                    | Oui                                |
| `TRUST_PROXY_HOPS`                                            | Nombre de proxys devant le serveur, pour connaître la vraie IP du client. Défaut : `0` (l'en-tête `X-Forwarded-For`, falsifiable, est ignoré). `2` derrière Vercel + Northflank.       | Non                                |
| `RESET_CODE_TTL_SECONDS`                                      | Validité du code « mot de passe oublié », en secondes (défaut 30, de 30 à 900). Le code (8 caractères, 5 essais maximum, usage unique) est envoyé par email, sans aucun lien.          | Non                                |
| `PROXY_SECRET`                                                | Secret partagé avec le proxy Vercel (32 caractères minimum). Une fois défini, toute requête `/api` sans l'en-tête `X-Proxy-Auth` correspondant est refusée (403). Vide en local.       | Non (indispensable en production)  |
| `TOTP_ENC_KEY`                                                | Clé de chiffrement des secrets 2FA de l'équipe (32 octets en base64, commande dans `.env.example`). Ne plus la changer une fois des 2FA configurées.                                   | Oui en production                  |
| `RABBITMQ_URL`                                                | Bus d'événements (`amqp://` ou `amqps://`). Vide : bus en mémoire et worker intégré à l'API. Défini : seul `npm run worker` traite les événements. Guide : `docs/RABBITMQ.md`.         | Oui pour le worker en production   |
| `RABBITMQ_PREFETCH`, `RELAY_INTERVAL_MS`                      | Messages traités en parallèle par le worker (défaut 10) ; intervalle du relais de l'outbox en ms (défaut 1000).                                                                        | Non                                |
| `NOTIFICATION_TTL_DAYS`, `SSE_PING_MS`                        | Conservation des notifications de l'application en jours (défaut 90) ; ping du flux temps réel `/api/notifications/stream` en ms (défaut 25000, moins de 120 s à cause du CDN Vercel). | Non                                |
| `MFA_ISSUER`                                                  | Nom affiché dans l'application d'authentification (défaut `LE-GBA`).                                                                                                                   | Non                                |
| `PROXY_SECRET_PREVIOUS`                                       | Ancien secret du proxy, encore accepté pendant un changement de secret. À retirer une fois la rotation terminée.                                                                       | Non                                |
| `ADMIN_NAME`                                                  | Nom du premier administrateur (défaut : `Administrateur`).                                                                                                                             | Non                                |
| `ADMIN_EMAIL`                                                 | Email du premier administrateur ; reçoit aussi les alertes de nouvelle réservation.                                                                                                    | Non                                |
| `ADMIN_PASSWORD`                                              | Mot de passe du premier administrateur (8 caractères minimum, lettres et chiffres, mot de passe non courant). À retirer une fois le compte créé.                                       | Non                                |
| `EMAIL_PROVIDER`                                              | Fournisseur d'emails : `brevo` (défaut, gratuit jusqu'à 300 emails par jour) ou `sendgrid`.                                                                                            | Non                                |
| `BREVO_API_KEY`                                               | Clé API Brevo (SMTP & API > Clés API). Sans clé, les emails ne partent pas.                                                                                                            | Non                                |
| `SENDGRID_API_KEY`                                            | Clé SendGrid, seulement si `EMAIL_PROVIDER=sendgrid` (offre gratuite supprimée en mai 2025).                                                                                           | Non                                |
| `EMAIL_FROM`                                                  | Adresse d'expédition, vérifiée chez le fournisseur (`EMAIL_USER`, ancien nom, est encore accepté).                                                                                     | Non                                |
| `EMAIL_FROM_NAME`                                             | Nom affiché de l'expéditeur (défaut : « LE-GBA »).                                                                                                                                     | Non                                |
| `PAYMENT_PROVIDER`                                            | Paiement en ligne de l'acompte : `none` (défaut, désactivé), `fake` (simulé, refusé en production) ou `cinetpay` (Mobile Money). Voir « Paiement de l'acompte ».                       | Non                                |
| `PAYMENT_DEPOSIT_PERCENT`                                     | Part du prix total payée en ligne, en % (défaut 30, de 1 à 100), arrondie au multiple de 5 FCFA supérieur.                                                                             | Non                                |
| `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY` | Identifiants du compte marchand CinetPay ; la clé secrète vérifie la signature `x-token` des notifications.                                                                            | Oui si `PAYMENT_PROVIDER=cinetpay` |

Ne commitez jamais le fichier `.env`.

---

## Scripts npm

| Commande                                 | Effet                                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                              | Démarre l'API (`node src/server.js`), utilisé en production.                                                                                                                                         |
| `npm run dev`                            | Démarre l'API avec nodemon (redémarre à chaque modification).                                                                                                                                        |
| `npm test`                               | Lance toute la suite de tests Vitest (base MongoDB en mémoire).                                                                                                                                      |
| `npm run check`                          | Vérifie le formatage et le lint avec Biome.                                                                                                                                                          |
| `npm run format`                         | Corrige automatiquement le formatage et le lint avec Biome.                                                                                                                                          |
| `npm run check:size`                     | Vérifie les règles du projet : 150 lignes maximum par fichier `.js` et aucun émoji dans `src`, `scripts` et `tests`.                                                                                 |
| `npm run email:test -- vous@exemple.com` | Envoie un email de test et affiche la cause exacte d'un échec (clé, expéditeur non vérifié, offre expirée).                                                                                          |
| `npm run create-superadmin`              | Crée le compte super-administrateur : nom, email et mot de passe (12 caractères min.) demandés dans le terminal, mot de passe masqué.                                                                |
| `npm run reset-mfa -- email@exemple.com` | Efface la 2FA d'un compte (téléphone ET codes de secours perdus) et ferme ses sessions : reconfiguration à la connexion suivante. Pour un gestionnaire, le superadmin le fait depuis la page Équipe. |
| `npm run worker`                         | Worker des événements : publie l'outbox sur RabbitMQ et envoie les emails (réservations, statuts, alertes de sécurité). Voir `docs/RABBITMQ.md`.                                                     |
| `npm run migrate`                        | Migration des données de l'ancienne version, en **simulation** (n'écrit rien). Ajouter `-- --apply` pour appliquer.                                                                                  |
| `npm run verify`                         | Enchaîne `check`, `check:size` et les tests : à lancer avant chaque livraison.                                                                                                                       |

---

## Référence des routes

Toutes les routes sont préfixées par `/api`, sauf `/health`. Les corps sont en JSON non compressé.

Règles communes, vérifiées dans cet ordre **avant toute lecture du corps** :
1. si `PROXY_SECRET` est défini, l'en-tête `X-Proxy-Auth` ajouté par le proxy Vercel est obligatoire (sinon 403 « Accès direct refusé ») ;
2. limite générale de 300 requêtes par 15 minutes et par IP ;
3. toute requête qui modifie des données (`POST`, `PUT`, `PATCH`, `DELETE`) doit porter l'en-tête `X-Requested-With: XMLHttpRequest` (sinon 403).

La session est portée uniquement par les cookies : le navigateur doit les envoyer (`credentials: "include"`). Accès : **public** (sans compte), **connecté** (session valide), **admin** (session valide et rôle administrateur relu en base à chaque requête).

### Authentification (`/api/auth`)

| Méthode | Chemin                      | Accès                             | Rôle                                                                                                                    |
| ------- | --------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST    | `/api/auth/register`        | Public                            | Crée un compte client, envoie l'email de bienvenue et ouvre la session.                                                 |
| POST    | `/api/auth/login`           | Public                            | Vérifie email et mot de passe, puis pose les cookies de session.                                                        |
| POST    | `/api/auth/logout`          | Public                            | Ferme la session (jeton de renouvellement et jeton d'accès coupés immédiatement) et efface les cookies.                 |
| POST    | `/api/auth/refresh`         | Public (cookie de renouvellement) | Renouvelle la session : nouveau jeton d'accès et nouveau jeton de renouvellement.                                       |
| GET     | `/api/auth/profile`         | Connecté                          | Renvoie le profil de l'utilisateur connecté.                                                                            |
| PUT     | `/api/auth/profile`         | Connecté                          | Met à jour nom, prénom, téléphone et adresse.                                                                           |
| PUT     | `/api/auth/password`        | Connecté                          | Change le mot de passe (ancien requis) et ferme les autres sessions.                                                    |
| POST    | `/api/auth/forgot-password` | Public                            | Répond immédiatement, avec le même message que le compte existe ou non ; le lien est préparé et envoyé en arrière-plan. |
| POST    | `/api/auth/reset-password`  | Public                            | Définit un nouveau mot de passe à partir du jeton reçu par email.                                                       |

### Véhicules (`/api/vehicles`)

| Méthode | Chemin                    | Accès  | Rôle                                                                                                                                   |
| ------- | ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/vehicles`           | Public | Liste paginée, filtres `type`, `brand`, `minPrice`, `maxPrice`, tri `sort` (`priceAsc`, `priceDesc`, `yearAsc`, `yearDesc`, `recent`). |
| GET     | `/api/vehicles/:id`       | Public | Détail d'un véhicule.                                                                                                                  |
| GET     | `/api/vehicles/:id/image` | Public | Photo enregistrée depuis l'administration, servie comme une image (mise en cache).                                                     |
| POST    | `/api/vehicles`           | Admin  | Ajoute un véhicule (photo en URL https ou fichier JPEG/PNG/WebP de 2 Mo maximum ; corps jusqu'à 3 Mo).                                 |
| PUT     | `/api/vehicles/:id`       | Admin  | Modifie un véhicule (corps jusqu'à 3 Mo).                                                                                              |
| DELETE  | `/api/vehicles/:id`       | Admin  | Supprime un véhicule, sauf s'il a des réservations en attente ou validées.                                                             |

### Réservations (`/api/orders`)

Toutes ces routes exigent une session. Statuts possibles : `en_attente`, `validee`, `rejetee`, `annulee`, `terminee`.

| Méthode | Chemin                                  | Accès    | Rôle                                                                                                                            |
| ------- | --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/api/orders`                           | Connecté | Crée une réservation (véhicule, dates, coordonnées, notes) ; prix et durée calculés par le serveur. 10 par heure et par compte. |
| GET     | `/api/orders/mine`                      | Connecté | Liste les réservations du client (100 dernières).                                                                               |
| PATCH   | `/api/orders/:id/cancel`                | Connecté | Annule sa propre réservation, uniquement tant qu'elle est en attente.                                                           |
| POST    | `/api/orders/:id/resend-email`          | Connecté | Renvoie l'email de statut de sa réservation à l'adresse du compte.                                                              |
| GET     | `/api/orders`                           | Admin    | Liste paginée de toutes les réservations, avec le client.                                                                       |
| PATCH   | `/api/orders/:id/status`                | Admin    | Change le statut selon les transitions autorisées ; le client est prévenu par email.                                            |
| POST    | `/api/orders/:id/send-payment-reminder` | Admin    | Envoie au client un rappel (paiement à la remise du véhicule).                                                                  |
| POST    | `/api/orders/:id/send-rental-summary`   | Admin    | Envoie au client le récapitulatif de la location.                                                                               |

Transitions autorisées : `en_attente` vers `validee`, `rejetee` ou `annulee` ; `validee` vers `terminee` ou `annulee`. Les autres statuts sont définitifs. Chaque changement est **atomique** : la réservation n'est modifiée que si elle a toujours le statut attendu (un client qui annule pendant qu'un admin valide ne peut pas obtenir les deux).

Une demande **en attente depuis plus de 48 heures** est annulée automatiquement, pour ne plus bloquer le véhicule : au démarrage du serveur, puis toutes les heures, et avant chaque nouvelle réservation.

### Administration (`/api/admin`)

Toutes ces routes exigent une session et le rôle administrateur.

| Méthode | Chemin                 | Accès | Rôle                                                                                                  |
| ------- | ---------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| GET     | `/api/admin/stats`     | Admin | Tableau de bord : totaux, revenus, répartition par statut, 6 derniers mois, 5 dernières réservations. |
| GET     | `/api/admin/users`     | Admin | Liste paginée des comptes.                                                                            |
| POST    | `/api/admin/users`     | Admin | Crée un compte (client ou administrateur).                                                            |
| PUT     | `/api/admin/users/:id` | Admin | Change le rôle d'un compte (impossible sur son propre compte).                                        |
| DELETE  | `/api/admin/users/:id` | Admin | Supprime un compte (ni le sien, ni un client ayant une réservation en cours) et ferme ses sessions.   |

Pagination des listes : paramètres `page` (défaut 1, maximum 1000) et `limit` (défaut 20, maximum 100).

### Paiement de l'acompte (`/api/payments`)

Désactivé par défaut (`PAYMENT_PROVIDER=none` : les routes répondent 503, sauf `/config`). Le montant est **toujours calculé par le serveur** (`PAYMENT_DEPOSIT_PERCENT` du prix total, multiple de 5 FCFA) ; seule une réservation **confirmée** (`validee`) peut être payée, par son client, avec une seule tentative en cours à la fois. Le reste se paie à la remise du véhicule.

| Méthode  | Chemin                          | Accès           | Rôle                                                                                                |
| -------- | ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| GET      | `/api/payments/config`          | Public          | `{ enabled, depositPercent }`.                                                                      |
| POST     | `/api/payments/orders/:id`      | Client          | Crée (ou reprend) la tentative et renvoie l'adresse de la page de paiement (`paymentUrl`).          |
| GET      | `/api/payments/orders/:id`      | Client          | État réel de l'acompte, vérifié auprès du fournisseur si une tentative est en cours.                |
| GET      | `/api/payments`                 | `payments.read` | Liste paginée des paiements (filtre `status`).                                                      |
| POST     | `/api/payments/cinetpay/notify` | CinetPay        | Notification : signature `x-token` (HMAC SHA-256) vérifiée, puis état confirmé par `payment/check`. |
| GET/POST | `/api/payments/cinetpay/return` | Navigateur      | Retour du client après paiement : redirection vers `/payment/return` du site.                       |

Les deux routes `cinetpay/*` sont montées avant le contrôle anti-CSRF (CinetPay n'envoie pas `X-Requested-With`) mais derrière le proxy Vercel, avec leur propre limite de requêtes et un corps de 8 Ko maximum. Un paiement accepté passe la réservation en `paymentStatus: deposit_paid` et écrit l'événement `payment.accepted` (reçu par email) dans la même transaction.

---

## Sécurité

### Accès au serveur

- **Secret de proxy** : en production, le frontend appelle l'API via le proxy `/api` de Vercel, configuré dans le `vercel.json` du frontend pour ajouter l'en-tête `X-Proxy-Auth`. L'API compare cet en-tête à `PROXY_SECRET` (ou `PROXY_SECRET_PREVIOUS` pendant une rotation) **à durée constante**. Un appel direct à l'URL publique Northflank, par exemple avec une IP inventée dans `X-Forwarded-For` pour contourner les limites, est refusé. `/health` reste accessible pour la vérification de santé de Northflank.
- **Ordre des contrôles** : proxy, limite générale et anti-CSRF passent **avant** la lecture du corps de la requête. Un appel anonyme n'est donc jamais lu.
- **Corps de requête** : 100 Ko maximum partout ; 3 Mo seulement pour `POST` et `PUT /api/vehicles`, et seulement après vérification de la session et du rôle admin. Corps compressés (gzip) refusés sans être décompressés (415). Profondeur JSON limitée à 8 niveaux (400).

### Session

- La session est portée par **deux cookies httpOnly** (illisibles par le JavaScript de la page), `SameSite=Strict`, `Secure` en production :
  - jeton d'accès JWT valable **15 minutes**, envoyé à toute l'API (`gba_at`, ou `__Secure-gba_at` en production) ;
  - jeton de renouvellement valable **7 jours**, envoyé uniquement aux routes `/api/auth` (`gba_rt`, ou `__Secure-gba_rt` en production).
- Le préfixe `__Secure-` oblige le navigateur à n'accepter ces cookies que sur une connexion HTTPS.
- **Aucun jeton n'est stocké dans le navigateur** ni renvoyé dans le corps des réponses. L'en-tête `Authorization` est ignoré.
- Le jeton de renouvellement est **à usage unique** : chaque renouvellement le remplace. Seule son empreinte **HMAC-SHA256** (clé `JWT_REFRESH_SECRET`) est conservée en base : une copie de la base ne suffit pas à vérifier un jeton deviné. S'il est présenté une seconde fois, c'est qu'il a été volé : toutes les sessions issues de la même connexion sont fermées (détection de vol). Une **tolérance de 30 secondes** évite de prendre pour un vol deux onglets qui renouvellent au même instant.
- Le jeton d'accès contient l'identifiant de sa session (`sid`) : après une déconnexion ou un vol détecté, il est **refusé immédiatement**, sans attendre la fin de ses 15 minutes.
- Chaque compte porte un **numéro de version de session**, incrémenté à chaque changement de mot de passe : les jetons d'accès émis avant sont refusés immédiatement. Changement ou réinitialisation du mot de passe et suppression du compte ferment aussi toutes les sessions.

### Requêtes venant d'autres sites

- **CSRF** : les requêtes qui modifient des données exigent l'en-tête `X-Requested-With: XMLHttpRequest` (qu'un formulaire ou une image d'un autre site ne peut pas ajouter) et, si l'en-tête `Origin` est présent, une origine autorisée.
- **CORS** limité aux origines exactes listées dans `FRONTEND_URL` (aucun joker) ; `localhost:5173` et `localhost:4173` sont ajoutés hors production.

### Validation des données

- Chaque corps, paramètre et filtre est validé par un **schéma Zod strict** : tout champ inconnu (`role`, `totalPrice`, `status`...) fait échouer la requête. Les messages sont en français.
- **Anti-injection NoSQL** : les clés commençant par `$`, contenant un point ou `__proto__` sont retirées des corps, et Mongoose refuse les opérateurs cachés dans les filtres (`sanitizeFilter`). Les recherches texte sont échappées (pas d'expression régulière piégée).

### Mots de passe et connexion

- Mots de passe hachés avec bcrypt (coût 12) ; 8 caractères minimum avec lettres et chiffres, **72 octets maximum** (au-delà, bcrypt tronquerait en silence : le mot de passe est refusé). Les mots de passe de l'ancienne version, hachés avec un coût plus faible, sont **re-chiffrés au coût 12** à la connexion suivante.
- **Limites de tentatives**, avec des compteurs stockés dans MongoDB (collection `ratelimits`, supprimés automatiquement à expiration) : ils survivent aux redémarrages et aux redéploiements du serveur.

  | Action                                                                     | Limite                                                                                                                               |
  | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
  | Toute l'API                                                                | 300 requêtes par 15 min et par IP                                                                                                    |
  | Connexion                                                                  | 5 échecs par 15 min pour un même compte depuis une même IP, et 30 échecs par 15 min par IP (les connexions réussies ne comptent pas) |
  | Inscription                                                                | 10 par heure et par IP                                                                                                               |
  | Changement et réinitialisation du mot de passe                             | 10 par 15 min et par IP                                                                                                              |
  | Emails déclenchés par l'utilisateur (mot de passe oublié, renvoi, rappels) | 5 par heure et par IP                                                                                                                |
  | Mot de passe oublié                                                        | 3 par heure pour une même adresse email                                                                                              |
  | Réservations                                                               | 10 par heure et par compte                                                                                                           |

  La limite de connexion par compte et par IP empêche un attaquant de bloquer la victime : elle peut toujours se connecter depuis une autre adresse. Les emails servant de clé sont hachés, jamais stockés en clair.
- **Verrou de secours** : 20 échecs sur un même compte en 15 minutes (depuis plusieurs adresses) le verrouillent 15 minutes. Les échecs plus anciens sont oubliés. La réponse est identique, en message et en durée, à celle d'une limite atteinte.
- Connexion : même message et temps de réponse comparable que le compte existe ou non.
- **Mot de passe oublié** : réponse immédiate et identique que le compte existe ou non ; le lien est préparé en arrière-plan, donc le temps de réponse ne révèle rien.
- **Mots de passe publiés refusés** (liste de mots de passe courants, dont l'ancien mot de passe administrateur). Un compte qui utilise encore un tel mot de passe ne peut plus se connecter : l'utilisateur doit passer par « Mot de passe oublié ».
- Le lien de réinitialisation est valable 30 minutes, ne sert qu'une fois et place le jeton **après `#`** dans l'URL : le navigateur ne l'envoie jamais au serveur, il n'apparaît donc dans aucun journal. Seule son empreinte HMAC est stockée.
- **Choix assumé** : l'inscription répond toujours « Un compte existe déjà avec cet email » (409) si l'adresse est prise. C'est un compromis d'ergonomie, dont l'abus est freiné par les limites de tentatives ; le supprimer demanderait une vérification de l'email à l'inscription.

### Réservations et emails

- **Prix et durée calculés par le serveur** à partir du véhicule en base ; une copie du véhicule est conservée dans la réservation.
- **Anti double réservation** : vérification des chevauchements avant l'enregistrement, puis contrôle après coup qui ne garde que la plus ancienne de deux demandes simultanées.
- Durée maximale de 90 jours, début au plus **180 jours à l'avance**, 5 réservations en attente maximum par client.
- Un client ne voit et n'annule que ses propres réservations.
- Les emails sont **échappés** (aucune injection de balises) et les emails de suivi partent **à l'adresse du compte**, jamais à l'adresse libre saisie dans le formulaire. Un échec d'envoi ne bloque jamais la requête et aucune donnée personnelle n'est écrite dans les journaux.

### Réponses du serveur

- En-têtes de sécurité posés par **helmet**.
- **Erreurs génériques** : le client ne reçoit qu'un message sûr, les détails techniques restent dans les journaux du serveur.
- Les réponses ne contiennent jamais le document brut de la base (mot de passe, champs internes et photos lourdes exclus).

---

## Déploiement sur Northflank

L'API est hébergée sur **Northflank**, offre gratuite « Developer Sandbox » : le service reste **toujours allumé** (pas de mise en veille). Northflank construit l'image Docker à partir du `Dockerfile` du dépôt et la redéploie automatiquement à chaque push sur `main`.

### 1. L'image Docker

Le `Dockerfile` produit une image de production :
- base `node:22-alpine` (image légère) ;
- dépendances de **production uniquement**, installées avec `npm ci --omit=dev` à partir de `package-lock.json` (versions exactes) ;
- le serveur tourne avec l'utilisateur **non-root `node`**, sans droits administrateur ;
- `NODE_ENV=production` et écoute sur le **port 8080** ;
- **aucun secret dans l'image** : toute la configuration arrive par les variables d'environnement de Northflank.

Le fichier `.dockerignore` empêche d'envoyer dans l'image ce qui est sensible ou inutile : `.env` (et ses variantes, sauf `.env.example`), `.git`, `node_modules`, `tests`, la configuration des tests et du lint.

Pour tester l'image en local (Docker installé, `.env` rempli) :

```bash
docker build -t le-gba-api .
docker run --rm -p 8080:8080 --env-file .env le-gba-api
```

L'API répond alors sur `http://localhost:8080/health`. Le fichier `.env` est lu au lancement du conteneur, il n'est jamais copié dans l'image.

### 2. Créer le service sur Northflank

1. Créez un compte sur Northflank. Une **vérification par carte bancaire** est demandée ; rien n'est prélevé sur l'offre gratuite.
2. Créez un **projet** et choisissez une **région Europe**.
3. Reliez votre compte **GitHub** (intégrations Git de l'équipe) et autorisez l'accès au dépôt du backend.
4. Dans le projet, créez un **Combined service** (construction et exécution dans le même service) :
   - dépôt : celui du backend, branche **`main`** ;
   - type de build : **Dockerfile**, chemin du fichier `/Dockerfile`, contexte de build `/` ;
   - port : **8080**, protocole **HTTP**, exposé **publiquement** ;
   - ressources : celles proposées par l'offre gratuite.
5. Avant le premier démarrage, renseignez les variables d'environnement (étape 3 ci-dessous).
6. Dans les réglages du service, ajoutez une **vérification de santé** (health check) de type **HTTP** sur le chemin **`/health`**, port 8080. Northflank ne considère le service prêt que lorsque `/health` répond.
7. Laissez le **déploiement automatique** activé : chaque push sur `main` reconstruit l'image et redéploie le service.

Une fois le service démarré, Northflank affiche son **URL publique**, au format `https://<service>--<projet>--<équipe>.code.run`. Recopiez-la telle quelle : elle sert pour Vercel (étape 5).

### 3. Variables d'environnement

Créez-les dans un **Secret group** du projet, relié au service (ou directement dans les variables du service). Marquez chacune comme **secrète** : Northflank masque alors leur valeur dans l'interface.

| Nom                                             | Valeur                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                      | `production`                                                                                                                                                      |
| `PORT`                                          | `8080`                                                                                                                                                            |
| `MONGO_URI`                                     | Chaîne de connexion Atlas de l'utilisateur dédié (voir étape 4).                                                                                                  |
| `JWT_ACCESS_SECRET`                             | Valeur aléatoire générée avec la commande `node` de `.env.example`.                                                                                               |
| `JWT_REFRESH_SECRET`                            | Une **autre** valeur générée de la même façon (jamais la même que `JWT_ACCESS_SECRET`).                                                                           |
| `FRONTEND_URL`                                  | URL exacte du site Vercel (`https://...`, sans barre finale).                                                                                                     |
| `TRUST_PROXY_HOPS`                              | `2` : Vercel puis le répartiteur de charge de Northflank sont devant le serveur. À confirmer en regardant l'IP vue dans les journaux (voir ci-dessous).           |
| `PROXY_SECRET`                                  | Même valeur que la variable `PROXY_SECRET` de Vercel, 32 caractères minimum.                                                                                      |
| `TOTP_ENC_KEY`                                  | Clé de chiffrement des secrets 2FA (commande dans `.env.example`), de type **Secret**. Gardez-en une copie sûre : la perdre oblige à reconfigurer toutes les 2FA. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`   | Premier administrateur seulement. **Retirez `ADMIN_PASSWORD`** (et redéployez) dès que le compte est créé.                                                        |
| `EMAIL_PROVIDER`, `BREVO_API_KEY`, `EMAIL_FROM` | Facultatif : fournisseur, clé et adresse d'expédition vérifiée. Testez avec `npm run email:test -- vous@exemple.com`.                                             |

Pour générer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Vérifier `TRUST_PROXY_HOPS`** : après le déploiement, utilisez le site puis regardez l'IP du client vue par le serveur dans les journaux du service. Ce doit être votre IP publique, pas une adresse interne de Vercel ou de Northflank. Sinon, ajustez la valeur et redéployez : une valeur trop faible fait partager la même limite de requêtes à tous les clients, une valeur trop forte laisse un client choisir son IP.

### 4. MongoDB Atlas

L'offre gratuite de Northflank n'a **pas d'adresse IP de sortie fixe**. Dans Atlas, **Network Access**, il faut donc autoriser `0.0.0.0/0` (toutes les adresses).

C'est acceptable **uniquement** si l'accès à la base est protégé par son utilisateur :
- un **utilisateur de base dédié** à l'API (Atlas, **Database Access**), jamais un compte administrateur ;
- un **mot de passe long et aléatoire** (généré, pas choisi) ;
- des droits limités à **`readWrite` sur la base de l'application** seulement.

C'est la chaîne de connexion de cet utilisateur qui va dans `MONGO_URI`.

### 5. Vercel (frontend)

Le `vercel.json` du frontend n'écrit aucune adresse : la route `/api` envoie les appels vers la variable Vercel **`BACKEND_URL`** et ajoute l'en-tête `X-Proxy-Auth` à partir de la variable **`PROXY_SECRET`**. Changer d'hébergeur ne demande donc aucune modification du code.

Dans Vercel (projet frontend, Settings > Environment Variables), pour **Production** et **Preview** :
- `BACKEND_URL` : l'URL publique Northflank, au format `https://<service>--<projet>--<équipe>.code.run`, sans « / » final ;
- `PROXY_SECRET` : la même valeur que sur Northflank, de type **Sensitive**. Navigateur et API sont ainsi sur la même origine, ce qui permet les cookies `SameSite=Strict`.

Une fois `PROXY_SECRET` défini sur Northflank, le backend de production refuse les appels qui ne passent pas par Vercel : en développement, `npm run dev` du frontend doit viser un **backend local**.

### 6. Procédure de bascule

À suivre dans cet ordre :
1. **Sauvegarder la base** (sauvegarde ou export Atlas).
2. Lancer la migration en **simulation**, avec la `MONGO_URI` de production dans `.env` :

   ```bash
   npm run migrate
   ```

   Elle affiche le nombre de commandes et de véhicules à convertir et signale si un administrateur utilise encore un mot de passe publié.
3. **Appliquer** la migration :

   ```bash
   npm run migrate -- --apply
   ```

   Elle convertit les anciennes commandes (paiement à la remise), déplace les photos base64 et retire les champs obsolètes. Elle peut être relancée sans risque.
4. **Créer le service Northflank** (étapes 2 à 4) et vérifier que `/health` répond `{ "status": "ok" }` sur son URL publique.
5. **Dans Vercel**, renseigner les variables `BACKEND_URL` (URL publique Northflank, sans « / » final) et `PROXY_SECRET` (type Sensitive), puis **redéployer** le frontend. `vercel.json` lit ces deux variables : aucune adresse n'est écrite dans le code.
6. **Tester en ligne** : connexion, réservation, espace administrateur.
7. **Supprimer toute ancienne instance de l'API** reliée à la même base : la supprimer, pas seulement la suspendre (une ancienne version vulnérable ne doit plus rester accessible).
8. **Changer le mot de passe administrateur** via « Mot de passe oublié » sur le site.

### 7. Changer le secret du proxy sans coupure

1. Dans le Secret group Northflank, créez `PROXY_SECRET_PREVIOUS` avec la valeur actuelle de `PROXY_SECRET`.
2. Générez un nouveau secret (`openssl rand -hex 32` ou la commande `node` ci-dessus), mettez-le dans `PROXY_SECRET` sur Northflank et redéployez le service. L'API accepte alors l'ancien et le nouveau secret.
3. Mettez la même nouvelle valeur dans `PROXY_SECRET` sur Vercel et **redéployez** le frontend.
4. Une fois Vercel redéployé, supprimez `PROXY_SECRET_PREVIOUS` du Secret group Northflank et redéployez le service.

---

## Tests

Vitest, Supertest et mongodb-memory-server : chaque fichier démarre une base MongoDB en mémoire (aucune base réelle ni secret nécessaire, les variables de test sont dans `vitest.config.js`).

```bash
npm test
```

Ce qui est couvert :
- **Authentification** (`auth.test.js`) : inscription en cookies httpOnly sans jeton renvoyé, refus d'un champ non prévu (rôle admin), refus des mots de passe faibles ou publiés et des emails déjà utilisés ; même message que le compte existe ou non, verrouillage après 20 échecs, blocage de l'ancien mot de passe publié, en-tête `Authorization` ignoré ; déconnexion, rotation du jeton de renouvellement, détection de vol, tolérance pour deux onglets.
- **Mots de passe** (`password.test.js`) : changement depuis le profil (ancien mot de passe exigé, autres sessions fermées), mot de passe oublié (réponse identique, seule l'empreinte du jeton stockée), réinitialisation à usage unique, lien expiré, déblocage d'un compte verrouillé.
- **Réservations** (`orders.test.js`) : prix calculé par le serveur, refus d'un prix ou d'un statut envoyé par le navigateur, contrôles de dates et de durée, véhicule indisponible, double réservation simultanée, session obligatoire, absence d'accès aux réservations d'autrui, transitions de statut.
- **Véhicules** (`vehicles.test.js`) : catalogue sans données internes, recherche piégée traitée comme du texte, photos base64 exclues des listes et conservées lors d'une modification, refus des images dangereuses, routes d'administration interdites aux clients, champs non prévus refusés.
- **Administration** (`admin.test.js`) : 403 pour un client, perte d'accès immédiate d'un admin rétrogradé, création de compte sans renvoi du mot de passe, protections sur son propre compte et sur les clients ayant des réservations en cours, statistiques calculées sur toutes les commandes.
- **Sécurité** (`security.test.js`) : CSRF, CORS, injections NoSQL, `$where`, pollution de prototype, faux jetons (`alg: none`, mauvaise signature, expiré), corps trop gros, JSON cassé, pagination excessive, erreurs sans détails techniques, en-têtes de sécurité, limite de 5 essais par compte même en changeant d'IP déclarée.
- **Contre-audit** (`audit.test.js`) : JSON imbriqué sur des milliers de niveaux refusé sans faire tomber le serveur, corps gzip refusé, appel anonyme jamais lu jusqu'à 3 Mo, déconnexion qui coupe immédiatement le jeton d'accès, mot de passe de plus de 72 octets refusé, re-chiffrement au coût 12, échecs de plus de 15 minutes oubliés.
- **Contre-audit des réservations** (`audit-orders.test.js`) : refus au-delà de 180 jours, demande de plus de 48 h qui ne bloque plus le véhicule, annulation client et validation admin simultanées (une seule gagne), connexion réussie qui ne consomme pas d'essai.
- **Proxy** (`proxy.test.js`) : appel sans secret refusé même avec une IP inventée, secret faux ou de longueur différente refusé, ancien secret accepté pendant une rotation, appels du proxy et `/health` acceptés.
- **Migration** (`migrate.test.js`) : simulation sans écriture, conversion des commandes, déplacement des photos, relance sans casse.

---

## Structure des dossiers

```
.
├── Dockerfile               Image de production (Northflank)
├── .dockerignore            Fichiers exclus de l'image (.env, tests, .git...)
├── .env.example             Modèle de configuration
├── vitest.config.js         Configuration des tests
├── biome.json               Formatage et lint
├── scripts/
│   ├── migrate.js           Migration des données (simulation ou --apply)
│   ├── migrations/          Étapes : commandes, véhicules
│   └── check-size.js        Règle des 150 lignes et absence d'émojis
├── src/
│   ├── server.js            Connexion MongoDB, premier admin, expiration des demandes, démarrage
│   ├── app.js               Application Express : ordre des middlewares et routes
│   ├── config/              Variables d'environnement, base, cookies
│   ├── middlewares/         Session, proxy/CORS/CSRF/corps JSON, limites (stockage MongoDB), validation, erreurs
│   ├── routes/              auth, vehicles, orders, admin
│   ├── controllers/         Logique de chaque route
│   ├── services/            Jetons, réservations, statuts, véhicules, statistiques, emails
│   ├── schemas/             Schémas Zod
│   ├── models/              User, Vehicle, Order, RefreshToken
│   └── utils/               Échappement HTML et regex
└── tests/                   Tests Vitest (+ helpers/ : base en mémoire, comptes)
```
