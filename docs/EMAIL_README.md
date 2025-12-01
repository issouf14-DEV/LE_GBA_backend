# 📧 Service Email - GBA Backend

> **Configuration terminée !** Ce backend peut maintenant envoyer des emails réels avec Nodemailer + Gmail.

---

## ⚡ Démarrage Ultra-Rapide

### 1. Installer les dépendances
```bash
npm install
```

### 2. Configurer Gmail
1. Aller sur : https://myaccount.google.com/apppasswords
2. Créer un mot de passe d'application
3. Copier le mot de passe (16 caractères)

### 3. Configurer .env
```env
EMAIL_USER=votre-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
ADMIN_EMAIL=admin@gba.com
```

### 4. Lancer le serveur
```bash
npm run dev
```

### 5. Tester
```bash
# Importer postman_collection.json dans Postman
# OU utiliser cURL (voir QUICK_START.md)
```

---

## 📬 Fonctionnalités

### Email à l'Admin
Quand un client passe une commande, l'admin reçoit un email avec :
- Informations du client (nom, email, téléphone)
- Détails du véhicule
- Dates de location
- Prix total

**Route** : `POST /api/orders/notify-admin`

### Email au Client
Quand l'admin valide ou rejette une commande, le client reçoit :
- **Validation** : Message positif + prochaines étapes
- **Rejet** : Message d'excuse + alternatives

**Route** : `POST /api/orders/:id/send-notification`

---

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| [`QUICK_START.md`](./QUICK_START.md) | ⚡ Configuration en 5 minutes |
| [`EMAIL_CONFIGURATION.md`](./EMAIL_CONFIGURATION.md) | 📖 Guide complet |
| [`RENDER_EMAIL_SETUP.md`](./RENDER_EMAIL_SETUP.md) | 🚀 Déploiement Render |
| [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md) | 💻 Exemples React |
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | 🗂️ Index complet |

---

## 🎯 Architecture

```
Client passe commande
        ↓
Frontend appelle /api/orders/notify-admin
        ↓
Backend → emailService.sendNewOrderEmail()
        ↓
Nodemailer → Gmail SMTP
        ↓
Email reçu par l'admin
```

---

## 🔧 Configuration Locale vs Production

### Local (.env)
```env
NODE_ENV=development
EMAIL_USER=votre-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
```

### Render (Dashboard)
```
Environment Variables:
  EMAIL_USER = votre-email@gmail.com
  EMAIL_APP_PASSWORD = abcdefghijklmnop
```

---

## 🧪 Tests

### Avec Postman
```
1. Importer postman_collection.json
2. Configurer {{baseUrl}} = http://localhost:5000
3. Ajouter le token Bearer
4. Envoyer la requête
```

### Avec cURL
```bash
curl -X POST http://localhost:5000/api/orders/notify-admin \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST","customerName":"Test",...}'
```

---

## ⚠️ Limites

- **Gmail gratuit** : 500 emails/jour
- **Google Workspace** : 2000 emails/jour

**Alternatives pour volume élevé** :
- SendGrid (100/jour gratuits)
- Mailgun (5000/mois gratuits)
- Amazon SES (pay-as-you-go)

---

## 🆘 Dépannage Rapide

### "Invalid credentials"
→ Vérifier `EMAIL_USER` et `EMAIL_APP_PASSWORD`

### Emails n'arrivent pas
→ Vérifier les **Spams**

### Erreur 500
→ Consulter les logs backend

**Plus de détails** : [`RENDER_EMAIL_SETUP.md`](./RENDER_EMAIL_SETUP.md) (Section Dépannage)

---

## 📊 Statistiques

- **3 fonctions** principales
- **2 routes API** créées
- **2 variables** d'environnement
- **9 fichiers** de documentation
- **1 collection** Postman

---

## 🎨 Aperçu des Templates

### Email Admin
```
🚗 Nouvelle commande #123

Informations Client
- Nom: Jean Dupont
- Email: jean@example.com
- Téléphone: +33 6 12 34 56 78

Véhicule: Toyota Camry (2023)
Dates: 15/12/2025 → 20/12/2025
Prix: 350 €

⚠️ Veuillez valider ou rejeter cette commande
```

### Email Client (Validation)
```
✅ Commande confirmée #123

Bonjour Jean Dupont,

🎉 Votre commande a été validée !

Récapitulatif:
- Véhicule: Toyota Camry (2023)
- Récupération: 15 décembre 2025
- Retour: 20 décembre 2025
- Prix: 350 €

📋 Prochaines étapes:
✓ Préparez vos documents
✓ Présentez-vous à l'agence
```

---

## 🚀 Déploiement

### Sur Render.com

1. **Pousser le code**
   ```bash
   git push origin main
   ```

2. **Configurer les variables**
   ```
   Dashboard → Environment → Add Variable
   ```

3. **Redéployer**
   ```
   Render le fait automatiquement
   ```

4. **Tester**
   ```bash
   curl https://gba-backend.onrender.com/api/orders/notify-admin ...
   ```

**Guide complet** : [`RENDER_EMAIL_SETUP.md`](./RENDER_EMAIL_SETUP.md)

---

## 📞 Support

### Questions ?
1. Consultez [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md)
2. Cherchez dans la section Dépannage
3. Vérifiez les logs

### Ressources
- [Nodemailer](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Render Docs](https://render.com/docs)

---

## ✅ Checklist de Validation

- [ ] Nodemailer installé
- [ ] Variables d'environnement configurées
- [ ] Mot de passe d'application Gmail créé
- [ ] Serveur démarré sans erreur
- [ ] Email de test envoyé et reçu
- [ ] Documentation lue
- [ ] Déployé sur Render (optionnel)
- [ ] Frontend intégré (optionnel)

---

## 🎉 Félicitations !

Votre backend GBA peut maintenant envoyer des emails professionnels !

**Prochaine étape** : Intégrer dans le frontend (voir [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md))

---

**Made with ❤️ for GBA**

*Version 1.1.0 - Décembre 2025*
