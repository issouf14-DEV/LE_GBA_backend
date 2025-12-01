# 🎨 Intégration Frontend - Exemples d'appels API

Ce fichier contient des exemples de code pour intégrer les fonctionnalités d'emails dans votre frontend React.

---

## 📦 1. Notification Admin après création de commande

### Scénario
Quand un client valide sa commande (après paiement), le frontend doit notifier l'admin par email.

### Code React

```jsx
// src/services/emailService.js
export const notifyAdminNewOrder = async (orderData, token) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/orders/notify-admin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderData._id,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone || 'Non fourni',
        vehicleMake: orderData.vehicle.make,
        vehicleModel: orderData.vehicle.model,
        vehicleYear: orderData.vehicle.year,
        pickupDate: orderData.pickupDate,
        returnDate: orderData.returnDate,
        totalPrice: orderData.totalPrice,
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi de la notification');
    }

    const result = await response.json();
    console.log('✅ Admin notifié par email:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur notification admin:', error);
    throw error;
  }
};
```

### Utilisation dans un composant

```jsx
// src/pages/CheckoutPage.jsx
import { notifyAdminNewOrder } from '../services/emailService';

const CheckoutPage = () => {
  const handlePaymentSuccess = async (orderData) => {
    try {
      // 1. Créer la commande dans la base de données
      const order = await createOrder(orderData);
      
      // 2. Envoyer la notification email à l'admin
      await notifyAdminNewOrder(order, userToken);
      
      // 3. Afficher un message de succès
      toast.success('Commande créée ! L\'admin a été notifié.');
      
      // 4. Rediriger vers la page de confirmation
      navigate('/order-confirmation', { state: { order } });
    } catch (error) {
      console.error('Erreur lors de la commande:', error);
      toast.error('Erreur lors de la notification de l\'admin');
    }
  };

  return (
    <div>
      {/* Votre interface de paiement */}
      <StripeCheckout onSuccess={handlePaymentSuccess} />
    </div>
  );
};
```

---

## 👤 2. Confirmation au client (Admin Panel)

### Scénario
L'admin valide ou rejette une commande depuis le panel d'administration. Le client reçoit un email.

### Code React

```jsx
// src/services/emailService.js
export const sendOrderNotificationToCustomer = async (orderId, status, adminToken) => {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/orders/${orderId}/send-notification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }), // "approved" ou "rejected"
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi de la confirmation');
    }

    const result = await response.json();
    console.log(`✅ Client notifié (${status}):`, result);
    return result;
  } catch (error) {
    console.error('❌ Erreur notification client:', error);
    throw error;
  }
};
```

### Utilisation dans le panel Admin

```jsx
// src/pages/admin/OrderManagement.jsx
import { sendOrderNotificationToCustomer } from '../../services/emailService';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const adminToken = localStorage.getItem('adminToken');

  const handleApproveOrder = async (orderId) => {
    try {
      // 1. Mettre à jour le statut dans la base de données
      await fetch(`${process.env.REACT_APP_API_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      // 2. Envoyer l'email de confirmation au client
      await sendOrderNotificationToCustomer(orderId, 'approved', adminToken);

      // 3. Mettre à jour l'interface
      toast.success('Commande validée et client notifié par email !');
      fetchOrders(); // Recharger la liste
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la validation');
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      // 1. Mettre à jour le statut
      await fetch(`${process.env.REACT_APP_API_URL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      });

      // 2. Envoyer l'email de refus au client
      await sendOrderNotificationToCustomer(orderId, 'rejected', adminToken);

      // 3. Mettre à jour l'interface
      toast.info('Commande rejetée et client notifié par email.');
      fetchOrders();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du rejet');
    }
  };

  return (
    <div className="order-management">
      <h1>Gestion des Commandes</h1>
      
      {orders.map(order => (
        <div key={order._id} className="order-card">
          <h3>Commande #{order._id}</h3>
          <p>Client: {order.user.name} ({order.user.email})</p>
          <p>Véhicule: {order.vehicles[0].vehicle.make} {order.vehicles[0].vehicle.model}</p>
          <p>Prix: {order.totalPrice} €</p>
          <p>Statut: {order.status}</p>
          
          {order.status === 'en attente' && (
            <div className="actions">
              <button 
                onClick={() => handleApproveOrder(order._id)}
                className="btn-approve"
              >
                ✅ Valider et notifier
              </button>
              <button 
                onClick={() => handleRejectOrder(order._id)}
                className="btn-reject"
              >
                ❌ Rejeter et notifier
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## 🎯 3. Service complet centralisé

### Créer un service email réutilisable

```javascript
// src/services/api/emailService.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Notifie l'admin d'une nouvelle commande
 */
export const notifyAdminNewOrder = async (orderData, token) => {
  const response = await fetch(`${API_URL}/api/orders/notify-admin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderId: orderData._id,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone || 'Non fourni',
      vehicleMake: orderData.vehicle.make,
      vehicleModel: orderData.vehicle.model,
      vehicleYear: orderData.vehicle.year,
      pickupDate: orderData.pickupDate,
      returnDate: orderData.returnDate,
      totalPrice: orderData.totalPrice,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la notification admin');
  }

  return response.json();
};

/**
 * Envoie une confirmation/rejet au client
 */
export const sendCustomerNotification = async (orderId, status, adminToken) => {
  const response = await fetch(`${API_URL}/api/orders/${orderId}/send-notification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erreur lors de la notification client');
  }

  return response.json();
};
```

---

## 🔐 4. Gestion des erreurs et loading states

### Avec React Query

```jsx
import { useMutation } from '@tanstack/react-query';
import { notifyAdminNewOrder, sendCustomerNotification } from '../services/api/emailService';

const useNotifyAdmin = () => {
  return useMutation({
    mutationFn: ({ orderData, token }) => notifyAdminNewOrder(orderData, token),
    onSuccess: () => {
      toast.success('Admin notifié par email !');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
};

const useNotifyCustomer = () => {
  return useMutation({
    mutationFn: ({ orderId, status, token }) => 
      sendCustomerNotification(orderId, status, token),
    onSuccess: (data, variables) => {
      const message = variables.status === 'approved' 
        ? 'Client notifié de la validation !'
        : 'Client notifié du refus.';
      toast.success(message);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
};

// Utilisation
const CheckoutPage = () => {
  const notifyAdmin = useNotifyAdmin();

  const handleOrderCreated = (order) => {
    notifyAdmin.mutate({ 
      orderData: order, 
      token: userToken 
    });
  };

  return (
    <button 
      onClick={() => handleOrderCreated(order)}
      disabled={notifyAdmin.isPending}
    >
      {notifyAdmin.isPending ? 'Envoi...' : 'Créer la commande'}
    </button>
  );
};
```

---

## 📱 5. Feedback utilisateur avec Toast

### Installation
```bash
npm install react-hot-toast
```

### Configuration

```jsx
// src/App.jsx
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          success: {
            duration: 4000,
            style: {
              background: '#10B981',
              color: '#fff',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#EF4444',
              color: '#fff',
            },
          },
        }}
      />
      
      {/* Votre app */}
      <Routes>
        {/* ... */}
      </Routes>
    </>
  );
}
```

### Utilisation avec les emails

```jsx
import toast from 'react-hot-toast';

const handleOrderCreation = async () => {
  const toastId = toast.loading('Création de la commande...');
  
  try {
    const order = await createOrder(orderData);
    toast.success('Commande créée !', { id: toastId });
    
    // Notification admin en arrière-plan
    notifyAdminNewOrder(order, token).catch(err => {
      console.error('Erreur notification admin:', err);
      // On ne bloque pas l'utilisateur si l'email échoue
    });
    
    navigate('/confirmation');
  } catch (error) {
    toast.error('Erreur lors de la commande', { id: toastId });
  }
};
```

---

## 🧪 6. Tests avec Jest

```javascript
// src/services/__tests__/emailService.test.js
import { notifyAdminNewOrder } from '../emailService';

global.fetch = jest.fn();

describe('Email Service', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('should notify admin successfully', async () => {
    const mockOrder = {
      _id: '123',
      customerName: 'Test User',
      customerEmail: 'test@test.com',
      vehicle: { make: 'Toyota', model: 'Camry', year: 2023 },
      totalPrice: 350,
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await notifyAdminNewOrder(mockOrder, 'token123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders/notify-admin'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer token123',
        }),
      })
    );

    expect(result.success).toBe(true);
  });
});
```

---

## 📋 Checklist d'intégration

### Frontend
- [ ] Créer le service `emailService.js`
- [ ] Ajouter l'appel après création de commande
- [ ] Ajouter les boutons Valider/Rejeter dans le panel admin
- [ ] Gérer les erreurs et loading states
- [ ] Ajouter des toasts pour le feedback utilisateur
- [ ] Tester en local avec le backend

### Backend
- [ ] Variables d'environnement configurées (`.env`)
- [ ] Service email testé manuellement
- [ ] Déploiement sur Render avec variables configurées

---

## 🎨 Bonus : UI pour le panel Admin

```jsx
// Exemple de composant OrderCard
const OrderCard = ({ order, onApprove, onReject, isLoading }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">
            Commande #{order._id.slice(-6)}
          </h3>
          <p className="text-gray-600">
            {order.user.name} • {order.user.email}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {order.vehicles[0].vehicle.make} {order.vehicles[0].vehicle.model}
          </p>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-sm ${
          order.status === 'approved' ? 'bg-green-100 text-green-800' :
          order.status === 'rejected' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {order.status}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-2xl font-bold text-green-600">
          {order.totalPrice} €
        </p>
        
        {order.status === 'en attente' && (
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(order._id)}
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? '...' : '✅ Valider'}
            </button>
            <button
              onClick={() => onReject(order._id)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isLoading ? '...' : '❌ Rejeter'}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-4 text-blue-500 text-sm"
      >
        {showDetails ? 'Masquer' : 'Voir'} les détails
      </button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t">
          <p><strong>Téléphone:</strong> {order.user.phone || 'N/A'}</p>
          <p><strong>Date de récupération:</strong> {new Date(order.pickupDate).toLocaleDateString()}</p>
          <p><strong>Date de retour:</strong> {new Date(order.returnDate).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};
```

---

**Intégration terminée ! 🎉**

Vous avez maintenant tous les exemples pour intégrer les emails dans votre frontend React.
