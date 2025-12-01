# 🚀 Déploiement sur Render.com - Configuration Emails

## Variables d'environnement à ajouter sur Render

Après avoir déployé votre backend sur Render, vous devez configurer les variables d'environnement pour activer l'envoi d'emails.

### Étape 1 : Accéder aux variables d'environnement

1. Connectez-vous à [Render.com](https://render.com)
2. Sélectionnez votre service **gba-backend**
3. Cliquez sur **Environment** dans le menu de gauche

### Étape 2 : Ajouter les nouvelles variables

Le fichier `render.yaml` a déjà été mis à jour pour inclure ces variables. Vous devez maintenant leur donner des valeurs :

| Variable | Valeur à configurer | Description |
|----------|---------------------|-------------|
| `EMAIL_USER` | `votre-email@gmail.com` | Votre adresse Gmail qui enverra les emails |
| `EMAIL_APP_PASSWORD` | `abcdefghijklmnop` | Mot de passe d'application Gmail (16 caractères, sans espaces) |

> **Note** : La variable `ADMIN_EMAIL` existe déjà et sera utilisée pour recevoir les notifications.

### Étape 3 : Obtenir le mot de passe d'application Gmail

#### Prérequis
- Avoir un compte Gmail
- Activer la validation en deux étapes

#### Instructions

1. **Activer la validation en deux étapes** :
   - Allez sur : https://myaccount.google.com/security
   - Cherchez "Validation en deux étapes"
   - Cliquez sur **Activer** et suivez les instructions

2. **Créer un mot de passe d'application** :
   - Allez sur : https://myaccount.google.com/apppasswords
   - Vous devrez peut-être vous reconnecter
   - Dans "Sélectionner l'application", choisissez **Autre (nom personnalisé)**
   - Tapez : `GBA Backend Render`
   - Cliquez sur **Générer**
   - **COPIEZ le mot de passe à 16 caractères** (exemple : `abcd efgh ijkl mnop`)
   - ⚠️ **Enlevez les espaces** quand vous le collez : `abcdefghijklmnop`

3. **Ajouter les variables sur Render** :
   - Dans l'onglet **Environment** de votre service Render
   - Cliquez sur **Add Environment Variable**
   
   **Variable 1** :
   - Key : `EMAIL_USER`
   - Value : `votre-email@gmail.com` (votre vraie adresse Gmail)
   
   **Variable 2** :
   - Key : `EMAIL_APP_PASSWORD`
   - Value : `abcdefghijklmnop` (le mot de passe sans espaces)

4. **Enregistrer et redémarrer** :
   - Cliquez sur **Save Changes**
   - Render redémarrera automatiquement votre service (quelques minutes)

### Étape 4 : Vérifier le déploiement

Une fois le service redémarré, vérifiez les logs :

1. Dans votre service Render, allez dans **Logs**
2. Vous devriez voir :
   ```
   Server running on port 5000
   MongoDB connecté
   ```

### Étape 5 : Tester l'envoi d'emails

Testez avec cURL (remplacez les valeurs) :

```bash
curl -X POST https://gba-backend.onrender.com/api/orders/notify-admin \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST123",
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "+33 6 12 34 56 78",
    "vehicleMake": "Toyota",
    "vehicleModel": "Camry",
    "vehicleYear": "2023",
    "pickupDate": "2025-12-15T10:00:00Z",
    "returnDate": "2025-12-20T10:00:00Z",
    "totalPrice": 350
  }'
```

Vérifiez votre boîte mail (celle configurée dans `ADMIN_EMAIL`) pour voir l'email de test.

---

## 📋 Checklist de déploiement

- [ ] Validation en 2 étapes activée sur Gmail
- [ ] Mot de passe d'application Gmail créé
- [ ] Variable `EMAIL_USER` ajoutée sur Render
- [ ] Variable `EMAIL_APP_PASSWORD` ajoutée sur Render
- [ ] Service Render redémarré
- [ ] Logs vérifiés (pas d'erreur)
- [ ] Email de test envoyé et reçu

---

## 🔧 Variables d'environnement complètes

Voici toutes les variables que votre backend utilise maintenant :

```yaml
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
ADMIN_NAME=Admin GBA
ADMIN_EMAIL=admin@gba.com          # ← Recevra les notifications de commandes
ADMIN_PASSWORD=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://your-frontend.vercel.app
EMAIL_USER=your-email@gmail.com    # ← NOUVELLE
EMAIL_APP_PASSWORD=abcdefghijklmnop # ← NOUVELLE
```

---

## ⚠️ Dépannage

### Erreur : "Invalid login: 535-5.7.8 Username and Password not accepted"

**Cause** : Mot de passe d'application incorrect ou validation en 2 étapes non activée

**Solution** :
1. Vérifiez que la validation en 2 étapes est bien activée
2. Régénérez un nouveau mot de passe d'application
3. Vérifiez qu'il n'y a pas d'espaces dans `EMAIL_APP_PASSWORD`
4. Mettez à jour la variable sur Render

### Les emails n'arrivent pas

**Vérifications** :
1. Consultez les **Logs** de Render pour voir si l'email est envoyé
2. Cherchez dans les **Spams** de votre boîte mail
3. Vérifiez que `ADMIN_EMAIL` est correct
4. Testez avec un autre compte destinataire

### Erreur : "Connection timeout"

**Cause** : Render ne peut pas se connecter à Gmail

**Solution** :
1. Attendez quelques minutes (parfois temporaire)
2. Vérifiez que votre compte Gmail n'est pas bloqué
3. Essayez de vous connecter manuellement à Gmail depuis un navigateur

---

## 🔐 Sécurité

✅ **Bonnes pratiques** :
- Ne jamais commit le `.env` (déjà dans `.gitignore`)
- Utiliser des mots de passe d'application (pas le mot de passe principal)
- Configurer les variables sur Render (pas hardcodées)

❌ **À éviter** :
- Partager le mot de passe d'application
- L'afficher dans les logs ou le code
- L'envoyer par email ou chat non sécurisé

---

## 📊 Limites de Gmail

- **500 emails/jour** pour Gmail gratuit
- **2000 emails/jour** pour Google Workspace

Si vous dépassez ces limites, considérez des alternatives :
- **SendGrid** (100/jour gratuits)
- **Mailgun**
- **Amazon SES**

---

## 📚 Documentation

- [Guide de configuration email complet](./EMAIL_CONFIGURATION.md)
- [Documentation Render](https://render.com/docs)
- [Mots de passe d'application Gmail](https://support.google.com/accounts/answer/185833)

---

**Configuration terminée ! 🎉**

Votre backend peut maintenant envoyer des emails réels depuis Render.
