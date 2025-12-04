# 🚨 CORRECTION URGENTE - Problème CORS

**Date:** 4 décembre 2025  
**Problème:** Frontend Railway bloqué par CORS  
**Solution:** 2 minutes de configuration

---

## ❌ ERREUR ACTUELLE

Le frontend Railway (`https://legba-frontend-production.up.railway.app`) ne peut pas communiquer avec le backend Render à cause de CORS.

**Erreur console :**
```
Access to XMLHttpRequest at 'https://le-gba-backend.onrender.com/api/...' 
from origin 'https://legba-frontend-production.up.railway.app' 
has been blocked by CORS policy
```

---

## ✅ SOLUTION RAPIDE (2 MINUTES)

### Étape 1 : Aller sur Render Dashboard

1. **Ouvrir** : https://dashboard.render.com/
2. **Sélectionner** : `le-gba-backend`
3. **Cliquer** : **Environment** (dans le menu de gauche)

### Étape 2 : Ajouter/Modifier la variable FRONTEND_URL

**Chercher la variable `FRONTEND_URL`**

**Si elle existe :**
- Cliquer sur l'icône crayon ✏️ pour modifier
- Remplacer la valeur par : `https://legba-frontend-production.up.railway.app`
- Cliquer **Save Changes**

**Si elle n'existe pas :**
- Cliquer **Add Environment Variable**
- Key : `FRONTEND_URL`
- Value : `https://legba-frontend-production.up.railway.app`
- Cliquer **Save**

### Étape 3 : Attendre le redéploiement

- Render redéploie automatiquement (1-2 minutes)
- Surveiller les logs : Dashboard → Logs
- Attendre le message : `✅ Server running on port 10000`

---

## 🔍 VÉRIFICATION

### Le code backend est déjà prêt ✅

**Fichier `src/app.js` (ligne 24-28) :**

```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || "*",  // ✅ Lit la variable d'environnement
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

✅ **Le code lit déjà `FRONTEND_URL`**  
✅ **Aucune modification de code nécessaire**  
✅ **Il suffit d'ajouter la variable sur Render**

---

## 🧪 TESTER APRÈS CORRECTION

### Test 1 : Via la console du navigateur

1. Ouvrir le frontend : `https://legba-frontend-production.up.railway.app`
2. Ouvrir la console (F12)
3. Essayer une action (connexion, voir véhicules, etc.)
4. ✅ Plus d'erreur CORS

### Test 2 : Via les logs Render

1. Dashboard Render → Logs
2. Chercher les requêtes entrantes
3. Vous devriez voir :
   ```
   GET /api/vehicles 200
   POST /api/auth/login 200
   ```

---

## 📊 CONFIGURATION COMPLÈTE

Après correction, voici les variables Render nécessaires :

| Variable | Valeur | Statut |
|----------|--------|--------|
| `FRONTEND_URL` | `https://legba-frontend-production.up.railway.app` | ⚠️ À ajouter/modifier |
| `SENDGRID_API_KEY` | `SG.xxxxx` | ✅ Déjà configuré |
| `SENDGRID_FROM_EMAIL` | `votre-email@gmail.com` | ✅ Déjà configuré |
| `MONGO_URI` | `mongodb+srv://...` | ✅ Déjà configuré |
| `JWT_SECRET` | `...` | ✅ Déjà configuré |
| `STRIPE_SECRET_KEY` | `sk_...` | ✅ Déjà configuré |

---

## 🎯 RÉSULTAT ATTENDU

**Après la correction :**

✅ Frontend Railway → Backend Render : **Fonctionne**  
✅ Requêtes API : **Succès**  
✅ CORS : **Résolu**  
✅ Site : **Opérationnel**

---

## 🚨 SI ÇA NE FONCTIONNE TOUJOURS PAS

### Option alternative : Autoriser plusieurs origines

Si vous voulez autoriser plusieurs domaines (local + Railway + autre) :

**Modifier `src/app.js` ligne 24-28 :**

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://legba-frontend-production.up.railway.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

Puis :
```bash
git add src/app.js
git commit -m "fix: support multiple CORS origins"
git push origin main
```

---

## ⏱️ TEMPS TOTAL

- **Configuration Render** : 30 secondes
- **Redéploiement automatique** : 1-2 minutes
- **Test** : 30 secondes

**Total : ~2-3 minutes** ⚡

---

## 📝 CHECKLIST

- [ ] Aller sur Render Dashboard
- [ ] Sélectionner service `le-gba-backend`
- [ ] Aller dans Environment
- [ ] Ajouter/modifier `FRONTEND_URL = https://legba-frontend-production.up.railway.app`
- [ ] Sauvegarder
- [ ] Attendre redéploiement (1-2 min)
- [ ] Tester le frontend Railway
- [ ] ✅ CORS résolu

---

**Urgent : Le site sera fonctionnel dès que `FRONTEND_URL` sera configuré sur Render !** 🚀

---

**Créé le :** 4 décembre 2025  
**Priorité :** 🚨 URGENT  
**Temps estimé :** 2-3 minutes  
**Impact :** Débloquer le site en production
