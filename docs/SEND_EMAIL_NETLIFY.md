# Fonction Netlify : send-email

Ce document explique comment configurer les variables d'environnement et tester la fonction Netlify `send-email` localement sur Windows PowerShell.

Prérequis :
- Node.js et `npm` installés
- `netlify-cli` pour les tests locaux (installez globalement ou utilisez `npx`)
- Si vous prévoyez d'utiliser SendGrid : une `SENDGRID_API_KEY` et `SENDGRID_FROM_EMAIL`.
- Si vous prévoyez d'utiliser SMTP (nodemailer) : `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` (ou `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`).

Important : ne commitez JAMAIS de secrets dans le dépôt. Utilisez les paramètres de variables d'environnement de votre fournisseur pour la production (Netlify, Render, etc.).

Configuration rapide PowerShell (session uniquement) :

```powershell
# Exemple pour SendGrid
$env:SENDGRID_API_KEY = 'votre_clé_api_sendgrid_ici'
$env:SENDGRID_FROM_EMAIL = 'no-reply@votredomaine.com'

# OU exemple pour SMTP (Gmail avec mot de passe d'application ou fournisseur SMTP)
$env:EMAIL_SERVICE = 'gmail'  # ou définir EMAIL_HOST/EMAIL_PORT
$env:EMAIL_USER = 'votre-email@exemple.com'
$env:EMAIL_PASS = 'votre-mot-de-passe-application'
$env:EMAIL_FROM = 'no-reply@votredomaine.com'

# Lancer Netlify dev (servira les fonctions sur http://localhost:8888/.netlify/functions/<nom>)
npx netlify-cli dev
```

Tester la fonction avec PowerShell (après avoir lancé `netlify dev`) :

```powershell
# $payload doit être une chaîne JSON. Exemple :
$payload = @{
  to = 'destinataire@exemple.com'
  subject = 'Email de test depuis la fonction Netlify locale'
  body = '<p>Bonjour depuis la fonction Netlify locale</p>'
} | ConvertTo-Json

# Utilisez Invoke-RestMethod pour appeler l'endpoint de fonction exposé par netlify dev
# Ajustez le port si netlify dev utilise un port différent.
# Remplacez le chemin si vous avez mappé les fonctions différemment.
# Exemple :
$uri = 'http://localhost:8888/.netlify/functions/send-email'
Invoke-RestMethod -Method Post -Uri $uri -Body $payload -ContentType 'application/json'
```

Si vous ne souhaitez pas exécuter `netlify-cli`, vous pouvez également POST directement vers l'URL de la fonction déployée une fois déployée sur Netlify, ou utiliser un petit wrapper express local pour des tests rapides.

Dépannage :
- Si vous utilisez SendGrid, assurez-vous que la clé API est correcte et que `SENDGRID_FROM_EMAIL` est un expéditeur vérifié (si requis par les paramètres SendGrid).
- Si vous utilisez Gmail, préférez les mots de passe d'application et activez des paramètres moins permissifs ; n'utilisez pas les mots de passe de compte réels.
- Si `@sendgrid/mail` n'est pas installé et que vous tentez d'utiliser SendGrid, vous verrez une erreur module-not-found localement ; installez avec `npm i @sendgrid/mail` pour les tests locaux.

Étapes suivantes (recommandées) :
- Ajoutez ces variables d'environnement dans le tableau de bord de votre fournisseur (Netlify/Render) plutôt que dans le shell local.
- Utilisez les webhooks SendGrid pour suivre les rebonds/délivrabilité.
- Déplacez les templates d'email vers des fichiers de templates appropriés ou un moteur de templates.
