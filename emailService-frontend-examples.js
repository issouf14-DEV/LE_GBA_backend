// ============================================
// 📧 SERVICE API EMAIL - COPIER/COLLER
// ============================================

const API_URL = 'https://le-gba-backend.onrender.com/api';

// Fonction utilitaire pour gérer les réponses
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Erreur lors de la requête');
  }
  return data;
};

// ============================================
// 1️⃣ INSCRIPTION (Email de bienvenue automatique)
// ============================================

export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
const handleRegister = async (e) => {
  e.preventDefault();
  try {
    const result = await registerUser({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123'
    });
    
    console.log('✅ Inscription réussie:', result);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result));
    
    alert('Inscription réussie ! Un email de bienvenue a été envoyé.');
    window.location.href = '/dashboard';
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
};
*/

// ============================================
// 2️⃣ CONNEXION
// ============================================

export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const result = await loginUser({
      email: 'john@example.com',
      password: 'password123'
    });
    
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result));
    
    window.location.href = '/dashboard';
  } catch (error) {
    alert('Email ou mot de passe incorrect');
  }
};
*/

// ============================================
// 3️⃣ NOTIFICATION ADMIN (Nouvelle commande)
// ============================================

export const notifyAdminNewOrder = async (orderData, token) => {
  try {
    const response = await fetch(`${API_URL}/orders/notify-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur notification admin:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
const handleCreateOrder = async (orderDetails) => {
  try {
    // 1. Créer la commande
    const order = await createOrder(orderDetails);
    
    // 2. Notifier l'admin
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    await notifyAdminNewOrder({
      customerName: user.name,
      customerEmail: user.email,
      vehicleMake: orderDetails.vehicle.make,
      vehicleModel: orderDetails.vehicle.model,
      vehicleYear: orderDetails.vehicle.year,
      pickupDate: orderDetails.pickupDate,
      returnDate: orderDetails.returnDate,
      totalPrice: orderDetails.totalPrice
    }, token);
    
    console.log('✅ Admin notifié par email');
    alert('Commande créée ! L\'administrateur a été notifié.');
    
  } catch (error) {
    console.error('Erreur:', error);
  }
};
*/

// ============================================
// 4️⃣ CONFIRMATION CLIENT (Admin uniquement)
// ============================================

export const sendOrderConfirmation = async (orderId, status, adminToken) => {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status }), // "approved" ou "rejected"
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur confirmation:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
// Approuver une commande
const handleApprove = async (orderId) => {
  try {
    const adminToken = localStorage.getItem('token');
    await sendOrderConfirmation(orderId, 'approved', adminToken);
    
    alert('Commande approuvée et client notifié !');
    fetchOrders(); // Rafraîchir la liste
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
};

// Rejeter une commande
const handleReject = async (orderId) => {
  try {
    const adminToken = localStorage.getItem('token');
    await sendOrderConfirmation(orderId, 'rejected', adminToken);
    
    alert('Commande rejetée et client notifié.');
    fetchOrders();
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
};
*/

// ============================================
// 5️⃣ RAPPEL DE PAIEMENT (Admin uniquement)
// ============================================

export const sendPaymentReminder = async (orderId, adminToken) => {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}/send-payment-reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur rappel paiement:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
const handleSendReminder = async (orderId) => {
  try {
    const adminToken = localStorage.getItem('token');
    await sendPaymentReminder(orderId, adminToken);
    
    alert('Rappel de paiement envoyé au client !');
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
};
*/

// ============================================
// 6️⃣ RÉCAPITULATIF DE LOCATION (Admin uniquement)
// ============================================

export const sendRentalSummary = async (orderId, summaryData, adminToken) => {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}/send-rental-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(summaryData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('❌ Erreur récapitulatif:', error);
    throw error;
  }
};

// Exemple d'utilisation:
/*
const handleSendSummary = async (orderId) => {
  try {
    const adminToken = localStorage.getItem('token');
    
    const summaryData = {
      startDate: '2025-12-10',
      endDate: '2025-12-20',
      startKm: 10000,
      endKm: 10500,
      fuelLevelStart: 'Plein',
      fuelLevelEnd: '3/4',
      vehicleCondition: 'Bon état',
      additionalCharges: 50,
      additionalChargesReason: 'Nettoyage intérieur'
    };
    
    await sendRentalSummary(orderId, summaryData, adminToken);
    
    alert('Récapitulatif envoyé au client !');
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
};
*/

// ============================================
// 🧪 TEST RAPIDE DANS LA CONSOLE
// ============================================

/*
// Copier-coller dans la console du navigateur (F12):

// Test 1: Health check
fetch('https://le-gba-backend.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend actif:', d));

// Test 2: Inscription
fetch('https://le-gba-backend.onrender.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test User',
    email: 'test-' + Math.random() + '@example.com',
    password: 'test123456'
  })
})
.then(r => r.json())
.then(d => {
  console.log('✅ Inscription OK:', d);
  console.log('✉️ Email de bienvenue envoyé automatiquement');
  console.log('📝 Token:', d.token);
});

// Test 3: Notification admin (remplacer YOUR_TOKEN par un vrai token)
const token = 'YOUR_TOKEN'; // Récupérer depuis localStorage ou après login
fetch('https://le-gba-backend.onrender.com/api/orders/notify-admin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    vehicleMake: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleYear: '2023',
    pickupDate: '2025-12-10',
    returnDate: '2025-12-20',
    totalPrice: 500
  })
})
.then(r => r.json())
.then(d => console.log('✅ Admin notifié:', d));
*/

// ============================================
// 🐛 DÉBOGAGE - ERREURS COURANTES
// ============================================

/*
1. Erreur 401 (Non autorisé):
   - Vérifier que le token est valide
   - Vérifier le format: "Bearer TOKEN" (avec espace)
   
2. Erreur 403 (Accès refusé):
   - L'utilisateur n'est pas admin
   - Vérifier user.role === 'admin'
   
3. Erreur 404 (Route non trouvée):
   - Vérifier l'URL: /api/orders/notify-admin (avec /api)
   
4. Erreur CORS:
   - Déjà configuré sur le backend (access-control-allow-origin: *)
   - Vérifier que vous utilisez HTTPS en production
*/
