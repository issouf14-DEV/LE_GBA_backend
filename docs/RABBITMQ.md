# RabbitMQ dans LE-GBA : guide de formation

Ce guide s'adresse à quelqu'un qui connaît Node.js, Express et MongoDB, mais pas les files de messages.
Lisez-le dans l'ordre : chaque partie s'appuie sur la précédente. Les exercices de la fin se font en local.

## 1. Pourquoi un bus de messages ici

Aujourd'hui, quand un client réserve une voiture, l'API enregistre la commande puis envoie l'email à
l'administrateur **pendant la requête**. Cela pose trois problèmes :
- si Brevo est lent, le client attend sa réponse ;
- si Brevo est en panne ou refuse l'envoi, l'email est **perdu** : personne ne réessaie ;
- chaque nouvelle réaction (notification temps réel, SMS…) alourdirait encore le contrôleur.

Avec un bus de messages, l'API se contente de noter « une réservation a été créée » et répond tout de
suite. Un autre programme, le **worker**, lit cette information et envoie l'email. S'il échoue, il
réessaie plus tard. Rien n'est perdu.

Autre avantage : on peut brancher d'autres consommateurs sur le même événement sans toucher à l'API.
La phase 5 ajoutera les notifications temps réel ; un envoi de SMS pourra suivre.

## 2. Les notions, une par une

Chaque notion a d'abord une image simple, puis son sens exact.

### Producteur

- **Image** : la personne qui dépose une lettre à la poste.
- **Sens exact** : le programme qui publie des messages. Dans LE-GBA, c'est le **relais** du worker
  (voir partie 3), pas l'API directement.

### Consommateur

- **Image** : le facteur qui prend les lettres dans son casier et les distribue.
- **Sens exact** : le programme abonné à une file, qui reçoit les messages et les traite. Ici, le
  consommateur `email` du worker.

### Message

- **Image** : la lettre. Elle contient juste ce qu'il faut pour agir.
- **Sens exact** : un petit document JSON. Dans LE-GBA :
  `{ "id": "...", "type": "order.created", "payload": { "orderId": "..." }, "occurredAt": "..." }`.
  Il ne contient **que des identifiants**. Le consommateur relit le reste en base.

### Exchange

- **Image** : le centre de tri de la poste. Il ne garde rien, il oriente.
- **Sens exact** : le point où l'on publie. Il distribue chaque message aux files concernées selon des
  règles. Trois types courants :
  - `direct` : la clé du message doit être exactement égale à celle de la règle ;
  - `topic` : la règle peut contenir des jokers (`*` = un mot, `#` = zéro ou plusieurs mots),
    par exemple `order.*` reçoit `order.created` et `order.status_changed` ;
  - `fanout` : chaque message part dans toutes les files reliées, sans regarder la clé.
- **Ici** : un seul exchange, `gba.events`, de type `topic`. Le type topic laisse la porte ouverte :
  un futur consommateur pourra s'abonner à `order.#` d'un seul coup.

### Routing key (clé de routage)

- **Image** : le code postal écrit sur l'enveloppe.
- **Sens exact** : une chaîne jointe au message, que l'exchange compare aux règles. Ici, c'est le type
  d'événement : `order.created`, `order.status_changed`, `user.password_changed`, `user.mfa_enabled`,
  `user.mfa_reset`.

### File (queue)

- **Image** : le casier d'un facteur. Les lettres y attendent qu'il passe.
- **Sens exact** : là où les messages sont **stockés** jusqu'à ce qu'un consommateur les traite.
  Ici : `gba.email`, plus des files techniques : `gba.email.retry.<délai>ms` (une par délai) et `gba.email.dead`.

### Binding (liaison)

- **Image** : la consigne affichée au centre de tri : « codes postaux 225xx → casier d'Abidjan ».
- **Sens exact** : une règle « cette file reçoit les messages de cet exchange qui ont cette clé ».
  La file `gba.email` est liée à `gba.events` pour les cinq types d'événements qui déclenchent un email.

### Acquittement (ack / nack)

- **Image** : le destinataire signe l'accusé de réception.
- **Sens exact** : le consommateur dit à RabbitMQ « c'est traité, tu peux supprimer » (`ack`) ou
  « je refuse ce message » (`nack`). Tant qu'un message n'est pas acquitté, RabbitMQ le garde. Si le
  worker plante en plein traitement, le message est redonné à un autre consommateur.

### Prefetch

- **Image** : le nombre maximum de lettres que le facteur emporte dans sa sacoche.
- **Sens exact** : le nombre de messages non acquittés qu'un consommateur peut avoir en même temps.
  Ici 10 (variable `RABBITMQ_PREFETCH`). Trop haut : un seul worker accapare tout. Trop bas : lent.

### Messages persistants et files durables

- **Image** : les lettres sont rangées dans un coffre, pas posées sur une table.
- **Sens exact** : une file **durable** survit au redémarrage de RabbitMQ ; un message **persistant**
  est écrit sur disque. Il faut les deux pour ne rien perdre si RabbitMQ redémarre. LE-GBA utilise
  les deux partout.

### Confirmation de l'éditeur (publisher confirm)

- **Image** : le reçu que donne le guichet de la poste quand il a bien pris la lettre.
- **Sens exact** : après une publication, RabbitMQ répond « je l'ai bien enregistré ». Le relais
  n'indique « publié » en base qu'après ce reçu. Sans reçu, il réessaiera.

### Lettre morte (DLX) et file morte

- **Image** : le service des lettres non distribuables.
- **Sens exact** : quand un message est refusé définitivement (ou expire), RabbitMQ peut le renvoyer
  vers un **exchange de lettres mortes** (dead letter exchange, DLX). Ici, la file `gba.email` a pour
  DLX `gba.dlx`, et la file morte `gba.email.dead` reçoit ces messages. On peut les examiner ensuite.

### Nouvel essai avec délai (TTL + lettre morte)

- **Image** : « absent, nous repasserons dans 5 minutes ».
- **Sens exact** : RabbitMQ n'a pas de minuterie intégrée. On combine deux mécanismes :
  1. le consommateur publie une copie du message dans la file d'attente du délai voulu
     (`gba.email.retry.5000ms`, `gba.email.retry.30000ms`…), avec un compteur `x-attempt` augmenté
     de 1, puis acquitte l'original ;
  2. personne ne lit ces files ; chacune a une durée de vie (TTL) : à l'expiration, RabbitMQ envoie
     le message en lettre morte… configurée pour revenir dans `gba.email`.

  Pourquoi une file par délai : RabbitMQ n'expire les messages qu'en tête de file. Dans une file
  unique, un message à 5 s attendrait derrière un message à 10 min. Avec un seul délai par file,
  l'ordre d'arrivée est aussi l'ordre d'expiration.

  Délais entre les tentatives : 5 s, 30 s, 2 min, 10 min. Après la 5e tentative ratée, le message
  part dans `gba.email.dead`.

### Livraison « au moins une fois » et idempotence

- **Image** : le facteur repasse parfois avec la même lettre s'il n'est pas sûr de l'avoir remise.
- **Sens exact** : RabbitMQ garantit qu'un message sera livré **au moins une fois**, pas **exactement
  une fois**. Un même message peut donc arriver deux fois (worker coupé avant l'ack, par exemple).
  Le traitement doit être **idempotent** : le refaire ne doit rien changer. LE-GBA note chaque message
  traité dans la collection `processedevents` (index unique sur `eventId` + `consumer`). Un message
  déjà noté est acquitté sans rien renvoyer.

  Limite honnête : si le worker s'arrête juste après l'envoi de l'email et avant cette note, l'email
  peut partir deux fois. C'est rare et préférable à un email perdu.

## 3. Le modèle outbox

### Le problème

Pourquoi l'API ne publie-t-elle pas directement dans RabbitMQ ? Imaginez :
1. la base enregistre la commande ;
2. l'API tente de publier `order.created`, mais RabbitMQ est injoignable à cet instant.

La commande existe, l'événement est perdu, l'administrateur n'est jamais prévenu. L'inverse est aussi
possible : événement publié, puis la base refuse la commande. Deux systèmes, deux écritures : on ne
peut pas les rendre atomiques ensemble.

### La solution

L'API écrit l'événement **dans MongoDB**, dans une collection `outboxevents` (la « boîte d'envoi »),
**dans la même transaction** que la commande. Soit les deux sont enregistrés, soit aucun.

Ensuite, le **relais** du worker vide cette boîte d'envoi vers RabbitMQ :
- toutes les secondes (`RELAY_INTERVAL_MS`), il cherche les événements `pending` ;
- il en **réclame** un de façon atomique et pose un **bail** (lease) de 30 secondes : « celui-là est
  à moi pendant 30 s » ;
- il le publie et attend la confirmation de RabbitMQ ;
- il le marque `published`.

Le bail règle deux cas :
- deux relais (deux workers) ne prennent jamais le même événement, la réclamation est atomique ;
- si un relais plante après avoir réclamé un événement, le bail expire et un autre le reprend.

Les événements publiés sont effacés automatiquement après 7 jours.

## 4. Le parcours complet d'une réservation

```
  Navigateur du client
        |
        | 1. POST /api/orders
        v
+---------------------------------------------+
| API (Express)                               |
|  2. transaction MongoDB :                   |
|     - crée la commande         (orders)     |
|     - crée l'OutboxEvent      (outboxevents)|
|       type order.created, status pending    |
|  3. répond 201 au client, sans attendre     |
+---------------------------------------------+
        |
        | (MongoDB Atlas, rien d'autre)
        v
+---------------------------------------------+
| Worker : relais (toutes les secondes)       |
|  4. réclame l'événement (bail 30 s)         |
|  5. publie sur RabbitMQ, attend le reçu     |
|  6. marque l'événement published            |
+---------------------------------------------+
        |
        | routing key = order.created
        v
+------------------------+     binding order.created     +-------------+
| exchange gba.events    | ----------------------------> | file        |
| (topic, durable)       |                               | gba.email   |
+------------------------+                               +-------------+
                                                                |
                                                                v
+---------------------------------------------+
| Worker : consommateur email                 |
|  7. déjà traité ? (processedevents) -> ack  |
|  8. relit la commande en base               |
|  9. envoie l'email à l'admin via Brevo      |
| 10. note le message traité, puis ack        |
+---------------------------------------------+
        |
        | échec à l'étape 9 ?
        v
  gba.email.retry.<délai>ms (5 s, 30 s, 2 min, 10 min) --> retour dans gba.email
  après 5 tentatives : gba.dlx --> gba.email.dead (à examiner)
```

Le client a sa réponse à l'étape 3. Tout le reste se passe en arrière-plan, en général en une à deux
secondes.

## 5. Ce qui ne passe pas par le bus

Certains emails restent envoyés directement par l'API :
- le code de réinitialisation du mot de passe et le code de vérification d'email ;
- les invitations (équipe et clients) ;
- le renvoi d'email demandé par le client, le rappel de paiement et le récapitulatif envoyés par
  l'équipe.

Deux raisons. D'abord, ces emails contiennent des **secrets** (codes, liens d'invitation) : on ne veut
pas qu'ils transitent ni dorment dans une file ou une file morte. Ensuite, l'écran attend un **résultat
immédiat** (« email envoyé » ou « échec ») : un traitement différé ne pourrait pas le donner.

## 6. Sécurité

- **Identifiants uniquement** dans les messages : jamais d'email, de nom, de code, de jeton ou de mot
  de passe. Une fuite de la file ne révèle donc rien d'exploitable.
- **TLS en production** : l'URL commence par `amqps://` (chiffré), jamais `amqp://` hors de votre
  ordinateur.
- **Réseau privé** : sur Northflank, le worker joint RabbitMQ par le réseau interne du projet.
  Ne rendez pas l'addon accessible publiquement.
- **Mot de passe** : `RABBITMQ_URL` contient le mot de passe. Elle se déclare comme variable
  **secrète**, jamais dans le code ni dans Git.
- **Journaux** : n'écrivez jamais l'URL complète dans les logs (le mot de passe y figure). Au plus le
  nom d'hôte.
- **Interface de gestion** : jamais exposée sur Internet. En local, elle n'écoute que sur 127.0.0.1.
  En production, passez par la redirection de port de l'outil en ligne de commande de l'hébergeur,
  ou par la console du fournisseur.

## 7. Pratique en local

### Installer et démarrer RabbitMQ

1. Installez **Docker Desktop** et lancez-le.
2. Dans un terminal PowerShell, à la racine du backend, définissez les identifiants :

   ```powershell
   $env:RABBITMQ_DEFAULT_USER="gba"
   $env:RABBITMQ_DEFAULT_PASS="motdepasse"
   ```

   Ces variables ne durent que le temps du terminal. Pour ne pas les retaper, mettez plutôt ces deux
   lignes dans le fichier `.env` du backend (ignoré par Git) : Docker Compose le lit automatiquement.
   Choisissez un mot de passe sans caractères spéciaux, sinon il faudra l'encoder dans l'URL
   (`@` devient `%40`, par exemple).
3. Démarrez :

   ```powershell
   docker compose up -d
   docker compose ps   # attendre l'état « healthy »
   ```
4. Ouvrez http://localhost:15672 et connectez-vous avec ces identifiants.

Attention : les identifiants ne sont pris en compte qu'à la **première** création du volume. Pour les
changer ensuite : `docker compose down -v` (efface aussi les messages), puis `docker compose up -d`.

### Brancher l'application

Dans `.env` :
```
RABBITMQ_URL=amqp://gba:motdepasse@localhost:5672
```
Puis, dans deux terminaux :
```powershell
npm run dev      # terminal 1 : l'API
npm run worker   # terminal 2 : le worker (relais + consommateurs)
```
Au premier démarrage, le worker crée lui-même l'exchange, les files et les liaisons. Vérifiez-les dans
l'interface : onglet **Exchanges** (`gba.events`, `gba.dlx`) et onglet des files (`gba.email`,
`gba.email.retry.<délai>ms`, `gba.email.dead`).

### Sans RabbitMQ

Si `RABBITMQ_URL` est absente, l'application utilise un **bus en mémoire** qui imite RabbitMQ (mêmes
nouveaux essais, même file morte). Pratique pour développer et pour les tests. Mais les messages en
cours vivent dans la mémoire du processus : utilisez RabbitMQ pour les exercices ci-dessous.

## 8. Production sur Northflank

1. **RabbitMQ** : dans le tableau de bord du projet, section Addons, ajoutez un addon RabbitMQ.
   Vérifiez d'abord qu'il est inclus dans l'offre gratuite. Sinon, **CloudAMQP** propose une offre
   gratuite « Little Lemur », largement suffisante pour LE-GBA.
2. **URL** : récupérez l'URL de connexion **amqps** de l'addon (ou de CloudAMQP).
3. **Service worker** : créez un deuxième service à partir du **même dépôt** et du même `Dockerfile`
   que l'API, en remplaçant la commande de démarrage par :

   ```
   node src/worker.js
   ```

   Le worker n'a pas de page web : il n'a besoin d'aucun port public.
4. **Variables du worker** :
   - `RABBITMQ_URL` : l'URL amqps, en variable **secrète** ;
   - les mêmes valeurs que l'API pour `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
     les variables d'email (`EMAIL_PROVIDER`, `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`)
     et `TOTP_ENC_KEY`. Le plus simple : relier le worker au même Secret group que l'API.
   - En production, le worker refuse de démarrer sans `RABBITMQ_URL`.
5. **Vérifier** : les journaux du worker doivent indiquer la connexion à RabbitMQ. Faites une
   réservation de test et vérifiez que l'email arrive.

Si plusieurs instances du worker tournent, c'est sans danger : les relais ne publient jamais deux fois
le même événement et les consommateurs se partagent la file.

## 9. Exercices

Faites-les en local, RabbitMQ démarré et `RABBITMQ_URL` défini.

### Exercice 1 : rien n'est perdu quand le worker est arrêté

1. Arrêtez le worker (Ctrl+C dans son terminal). Laissez l'API tourner.
2. Créez une réservation depuis le site.
3. Dans MongoDB Atlas (Browse Collections), collection `outboxevents` : un document
   `type: "order.created"`, `status: "pending"`.
4. Relancez `npm run worker`.

**À observer** : en une à deux secondes, le document passe à `status: "published"` avec une date
`publishedAt`, et l'email arrive chez l'administrateur. L'événement a attendu sagement en base.

### Exercice 2 : nouveaux essais et file morte

1. Dans `.env`, remplacez `BREVO_API_KEY` par une valeur fausse. Relancez le worker.
2. Créez une réservation.
3. Dans l'interface de gestion, onglet des files, regardez `gba.email.retry.5000ms` puis les suivantes : un message y apparaît,
   disparaît (retour dans `gba.email`), revient…
4. Cliquez sur la file, puis **Get messages** pour voir le message et l'en-tête `x-attempt`.

**À observer** : 5 tentatives en tout, espacées de 5 s, 30 s, 2 min, puis 10 min (environ 13 minutes
au total). Ensuite le message arrive dans `gba.email.dead`, avec un en-tête `x-death` qui explique
pourquoi. Remettez la bonne clé à la fin.

### Exercice 3 : deux workers, aucun doublon

1. Ouvrez un troisième terminal et lancez un second `npm run worker`.
2. Dans l'interface, la file `gba.email` affiche 2 consommateurs.
3. Créez plusieurs réservations à la suite.

**À observer** : chaque email n'arrive qu'une seule fois. Les journaux montrent que les deux workers
se partagent le travail. Chaque événement de `outboxevents` n'a été publié qu'une fois.

### Exercice 4 : reconnexion automatique

1. Worker lancé, arrêtez RabbitMQ : `docker compose stop`.
2. Regardez les journaux du worker : il signale la perte de connexion et réessaie, sans s'arrêter.
3. Créez une réservation : l'événement reste `pending` dans `outboxevents` (le relais ne peut pas
   publier, il note l'erreur dans `lastError`).
4. Relancez : `docker compose start`.

**À observer** : le worker se reconnecte seul, redéclare la topologie, publie l'événement en attente,
et l'email part. Aucune intervention dans le code.

## 10. Que faire si…

### La file morte se remplit

1. Ouvrez `gba.email.dead`, **Get messages** (choisissez un mode qui remet les messages en file pour
   ne pas les perdre). L'en-tête `x-death` et les journaux du worker donnent la cause.
2. Causes fréquentes : clé Brevo invalide ou quota journalier atteint, adresse d'expédition non
   vérifiée, panne prolongée du fournisseur.
3. Corrigez la cause. Pour rejouer un message, publiez-le de nouveau depuis l'interface sur l'exchange
   `gba.events`, avec la même routing key (son `type`) et le même corps. Grâce à l'idempotence, un
   message déjà traité ne serait pas renvoyé. Puis purgez la file morte.

### Le worker ne démarre pas

- `RABBITMQ_URL` absente en production : le worker s'arrête volontairement. Ajoutez la variable.
- « ACCESS_REFUSED » : identifiants faux. En local, rappelez-vous qu'ils sont figés à la création du
  volume (voir partie 7). Mot de passe avec caractères spéciaux : encodez-le dans l'URL.
- « ECONNREFUSED » : RabbitMQ n'est pas démarré (`docker compose ps`) ou le port est faux.
- En production : `amqps://` obligatoire, vérifiez aussi `MONGO_URI` (le worker a besoin de la base).

### Les messages s'accumulent

- Dans `outboxevents`, beaucoup de `pending` : le relais ne tourne pas ou ne joint pas RabbitMQ.
  Regardez `lastError` et les journaux du worker.
- Dans `gba.email`, beaucoup de messages « Ready » et 0 consommateur : le worker est arrêté.
  Avec des consommateurs : le traitement est lent (fournisseur d'emails lent). Ajouter un worker aide.

## 11. Glossaire

| Terme             | Définition courte                                                                     |
| ----------------- | ------------------------------------------------------------------------------------- |
| AMQP              | Protocole utilisé par RabbitMQ. `amqps` = AMQP chiffré par TLS.                       |
| Ack / nack        | Accusé de traitement / refus d'un message.                                            |
| Bail (lease)      | Réservation temporaire d'un événement de l'outbox par un relais (30 s).               |
| Binding           | Règle reliant une file à un exchange pour une clé donnée.                             |
| Consommateur      | Programme qui lit une file et traite ses messages.                                    |
| DLX               | Dead letter exchange : exchange qui reçoit les messages refusés ou expirés.           |
| Durable           | File qui survit au redémarrage de RabbitMQ.                                           |
| Exchange          | Aiguilleur qui distribue les messages publiés vers les files.                         |
| File morte        | File où finissent les messages en échec définitif (`gba.email.dead`).                 |
| Idempotence       | Propriété d'un traitement qu'on peut refaire sans effet supplémentaire.               |
| Outbox            | Collection `outboxevents` : événements écrits avec la donnée métier, publiés ensuite. |
| Persistant        | Message écrit sur disque par RabbitMQ.                                                |
| Prefetch          | Nombre maximal de messages non acquittés confiés à un consommateur.                   |
| Producteur        | Programme qui publie des messages (ici le relais).                                    |
| Publisher confirm | Reçu de RabbitMQ confirmant qu'un message publié est bien enregistré.                 |
| Relais            | Boucle du worker qui publie les événements de l'outbox sur RabbitMQ.                  |
| Routing key       | Clé du message, comparée aux bindings (ici le type d'événement).                      |
| TTL               | Durée de vie d'un message ; sert ici à retarder les nouveaux essais.                  |
| Worker            | Processus séparé de l'API (`node src/worker.js`) : relais et consommateurs.           |
