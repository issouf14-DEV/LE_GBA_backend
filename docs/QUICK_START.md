# 🚀 Démarrage Rapide - Configuration Emails

## ⚡ Configuration en 5 minutes

### 1️⃣ Obtenir un mot de passe d'application Gmail

1. Allez sur : https://myaccount.google.com/apppasswords
2. Si demandé, activez d'abord la validation en 2 étapes
3. Choisissez "Autre (nom personnalisé)" → Tapez "GBA Backend"
4. Cliquez **Générer**
5. **Copiez** le mot de passe (16 caractères, supprimez les espaces)

### 2️⃣ Configurer le fichier `.env`

Ouvrez `.env` et modifiez ces lignes :

```env
# Email Configuration
EMAIL_USER=votre-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop

# Admin Email (reçoit les notifications)
ADMIN_EMAIL=admin@gba.com
```

### 3️⃣ Lancer le serveur

```bash
npm install
npm run dev
```

Vous devriez voir :
```
Server running on port 5000
MongoDB connecté
```

### 4️⃣ Tester l'envoi d'un email

**Option A : Avec Postman/Thunder Client**
- Importez `postman_collection.json`
- Modifiez le token et l'orderId
- Envoyez la requête

**Option B : Avec cURL**
```bash
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
```

### 5️⃣ Vérifier l'email

Consultez la boîte mail configurée dans `ADMIN_EMAIL` !

---

## 🎯 Déploiement sur Render

### Configuration rapide

1. **Dashboard Render** → Votre service → **Environment**

2. **Ajouter les variables** :

| Variable | Valeur |
|----------|--------|
| `EMAIL_USER` | `votre-email@gmail.com` |
| `EMAIL_APP_PASSWORD` | `abcdefghijklmnop` |

3. **Save Changes** → Le service redémarre automatiquement

4. **Tester** avec l'URL de production :
   ```bash
   curl -X POST https://gba-backend.onrender.com/api/orders/notify-admin ...
   ```

---

## 📋 Checklist

### Configuration locale
- [ ] Mot de passe d'application Gmail obtenu
- [ ] `.env` configuré avec `EMAIL_USER` et `EMAIL_APP_PASSWORD`
- [ ] `ADMIN_EMAIL` configuré
- [ ] Serveur lancé (`npm run dev`)
- [ ] Email de test envoyé et reçu

### Configuration Render
- [ ] Variables `EMAIL_USER` et `EMAIL_APP_PASSWORD` ajoutées
- [ ] Service redéployé
- [ ] Email de test depuis production envoyé et reçu

---

## 📚 Documentation complète

- **Guide complet** : `EMAIL_CONFIGURATION.md`
- **Guide Render** : `RENDER_EMAIL_SETUP.md`
- **Résumé** : `EMAIL_SUMMARY.md`

---

## 🆘 Problèmes ?

### Erreur : "Invalid credentials"
→ Régénérez un mot de passe d'application Gmail

### Les emails n'arrivent pas
→ Vérifiez les **Spams**

### Erreur de connexion
→ Vérifiez que la validation en 2 étapes est activée

**Plus d'aide** → Voir `RENDER_EMAIL_SETUP.md` section "Dépannage"

---

**C'est tout ! 🎉 Vos emails sont maintenant configurés.**
