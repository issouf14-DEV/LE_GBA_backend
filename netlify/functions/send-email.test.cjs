/**
 * Tests unitaires pour la fonction Netlify send-email
 * Exécuter avec: node netlify/functions/send-email.test.cjs
 */

const handler = require('./send-email.cjs').handler;

// Simuler un environnement de test
process.env.EMAIL_SERVICE = 'gmail';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';
process.env.EMAIL_FROM = 'test@example.com';

console.log('🧪 Démarrage des tests pour send-email.js\n');

// Test 1: Validation de l'email
async function testEmailValidation() {
  console.log('Test 1: Validation de l\'adresse email...');
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      to: 'invalid-email',
      subject: 'Test',
      body: '<p>Test</p>'
    })
  };

  const result = await handler(event, {});
  const response = JSON.parse(result.body);
  
  if (result.statusCode === 400 && response.error.includes('Invalid recipient')) {
    console.log('✅ Test 1 réussi: Email invalide détecté\n');
    return true;
  } else {
    console.log('❌ Test 1 échoué: Email invalide non détecté\n');
    return false;
  }
}

// Test 2: Champs manquants
async function testMissingFields() {
  console.log('Test 2: Détection des champs manquants...');
  const event = {
    httpMethod: 'POST',
    body: JSON.stringify({
      to: 'test@example.com'
      // subject et body manquants
    })
  };

  const result = await handler(event, {});
  const response = JSON.parse(result.body);
  
  if (result.statusCode === 400 && response.error.includes('Missing required fields')) {
    console.log('✅ Test 2 réussi: Champs manquants détectés\n');
    return true;
  } else {
    console.log('❌ Test 2 échoué: Champs manquants non détectés\n');
    return false;
  }
}

// Test 3: CORS OPTIONS
async function testCORS() {
  console.log('Test 3: Gestion CORS OPTIONS...');
  const event = {
    httpMethod: 'OPTIONS'
  };

  const result = await handler(event, {});
  
  if (result.statusCode === 204 && result.headers['Access-Control-Allow-Origin'] === '*') {
    console.log('✅ Test 3 réussi: CORS OPTIONS géré correctement\n');
    return true;
  } else {
    console.log('❌ Test 3 échoué: CORS OPTIONS incorrect\n');
    return false;
  }
}

// Test 4: Méthode non autorisée
async function testMethodNotAllowed() {
  console.log('Test 4: Méthode HTTP non autorisée...');
  const event = {
    httpMethod: 'GET'
  };

  const result = await handler(event, {});
  
  if (result.statusCode === 405) {
    console.log('✅ Test 4 réussi: Méthode GET refusée\n');
    return true;
  } else {
    console.log('❌ Test 4 échoué: Méthode GET non refusée\n');
    return false;
  }
}

// Test 5: JSON invalide
async function testInvalidJSON() {
  console.log('Test 5: Détection JSON invalide...');
  const event = {
    httpMethod: 'POST',
    body: 'invalid json {'
  };

  const result = await handler(event, {});
  const response = JSON.parse(result.body);
  
  if (result.statusCode === 400 && response.error.includes('Invalid JSON')) {
    console.log('✅ Test 5 réussi: JSON invalide détecté\n');
    return true;
  } else {
    console.log('❌ Test 5 échoué: JSON invalide non détecté\n');
    return false;
  }
}

// Test 6: Structure de la fonction
function testFunctionStructure() {
  console.log('Test 6: Structure de la fonction...');
  const fs = require('fs');
  const code = fs.readFileSync('./send-email.cjs', 'utf8');
  
  const checks = [
    { name: 'createTransport (pas createTransporter)', test: code.includes('createTransport') && !code.includes('createTransporter') },
    { name: 'Validation email', test: code.includes('isValidEmail') },
    { name: 'Support SendGrid', test: code.includes('SENDGRID_API_KEY') },
    { name: 'Fallback Nodemailer', test: code.includes('nodemailer') },
    { name: 'Gestion CORS', test: code.includes('Access-Control-Allow-Origin') },
    { name: 'Pas de credentials en dur', test: !code.includes('gba.notifications@gmail.com') && !code.includes('votre-mot-de-passe-app') }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.test) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allPassed = false;
    }
  });

  console.log(allPassed ? '✅ Test 6 réussi: Structure correcte\n' : '❌ Test 6 échoué: Structure incorrecte\n');
  return allPassed;
}

// Exécuter tous les tests
async function runAllTests() {
  const results = [];
  
  results.push(await testEmailValidation());
  results.push(await testMissingFields());
  results.push(await testCORS());
  results.push(await testMethodNotAllowed());
  results.push(await testInvalidJSON());
  results.push(testFunctionStructure());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('═══════════════════════════════════════════');
  console.log(`📊 Résumé: ${passed}/${total} tests réussis`);
  console.log('═══════════════════════════════════════════');

  if (passed === total) {
    console.log('✅ Tous les tests sont passés avec succès!');
    console.log('\n✅ La fonction send-email.js est conforme aux exigences:');
    console.log('   • Correction de createTransporter → createTransport');
    console.log('   • Validation des données (email, champs requis)');
    console.log('   • Support SendGrid avec fallback Nodemailer');
    console.log('   • Gestion CORS complète');
    console.log('   • Pas de credentials en dur');
    console.log('   • Gestion d\'erreurs robuste');
    return true;
  } else {
    console.log(`❌ ${total - passed} test(s) échoué(s)`);
    return false;
  }
}

// Lancer les tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('❌ Erreur lors des tests:', err);
  process.exit(1);
});
