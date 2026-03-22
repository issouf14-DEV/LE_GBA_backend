// src/controllers/orderController.js (version avec debug)
import Vehicle from "../models/Vehicle.js";
import Order from "../models/Order.js";
import { createPaymentIntent } from "../utils/payment.js";
import {
  sendNewOrderEmail,
  sendOrderConfirmation,
  sendPaymentReminderEmail,
  sendRentalSummaryEmail
} from "../services/emailService.js";
import { stripe } from "../config/stripe.js";

export const createOrder = async (req, res) => {
  try {
    const {
      vehicleId,
      quantity = 1,
      currency = "usd",
      paymentMethod,
    } = req.body;

    console.log("🚀 Création commande - Données reçues:", {
      vehicleId, quantity, currency, paymentMethod, userId: req.user._id
    });

    // Vérifie que le véhicule existe
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: "Véhicule introuvable" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "Méthode de paiement requise" });
    }

    // Calcule le prix total
    const totalPrice = vehicle.price * quantity;
    console.log("💰 Prix calculé:", { price: vehicle.price, quantity, totalPrice });

    // 1️⃣ Crée la commande en DB
    let order = await Order.create({
      user: req.user._id,
      vehicles: [{ vehicle: vehicleId, quantity }],
      totalPrice,
      paymentMethod,
      status: "en attente",
    });

    console.log("📦 Commande créée:", {
      orderId: order._id,
      status: order.status,
      totalPrice: order.totalPrice
    });

    // 2️⃣ Crée le PaymentIntent
    const paymentIntent = await createPaymentIntent(
      totalPrice * 100,
      currency,
      order._id.toString()
    );

    console.log("💳 PaymentIntent créé:", {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata
    });

    // 3️⃣ Mets à jour la commande
    order.paymentIntentId = paymentIntent.id;
    await order.save();

    console.log("✅ Commande mise à jour avec PaymentIntent:", order.paymentIntentId);

    // 4️⃣ Réponse au client
    res.status(201).json({
      message: "Commande créée avec succès",
      orderId: order._id,
      clientSecret: paymentIntent.client_secret,
      debug: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        orderId: order._id.toString()
      }
    });
  } catch (err) {
    console.error("❌ Erreur création commande:", err);
    res.status(400).json({ message: err.message });
  }
};

// Fonction utilitaire pour vérifier le statut d'une commande
export const checkOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("vehicles.vehicle");
    
    if (!order) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    // Vérifier aussi le statut sur Stripe si nécessaire
    if (order.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      
      console.log("🔍 Vérification Stripe:", {
        orderId,
        paymentIntentId: order.paymentIntentId,
        stripeStatus: paymentIntent.status,
        dbStatus: order.status
      });
    }

    res.json({
      order,
      debug: {
        createdAt: order.createdAt,
        paymentIntentId: order.paymentIntentId,
        currentStatus: order.status
      }
    });
  } catch (err) {
    console.error("❌ Erreur vérification commande:", err);
    res.status(500).json({ message: err.message });
  }
};

// Les autres fonctions restent identiques...
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate(
      "vehicles.vehicle"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find()
        .populate("user")
        .populate("vehicles.vehicle")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(),
    ]);

    res.json({
      orders,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order)
      return res.status(404).json({ message: "Commande introuvable" });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/orders/notify-admin
 * Envoie un email de notification à l'admin pour une nouvelle commande
 */
export const notifyAdmin = async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      pickupDate,
      returnDate,
      totalPrice,
    } = req.body;

    // Validation des données requises
    if (!orderId || !customerName || !customerEmail || !vehicleMake || !vehicleModel || !totalPrice) {
      return res.status(400).json({ 
        message: "Données manquantes pour l'envoi de l'email",
        required: ["orderId", "customerName", "customerEmail", "vehicleMake", "vehicleModel", "totalPrice"]
      });
    }

    // Envoi de l'email à l'admin
    const result = await sendNewOrderEmail({
      orderId,
      customerName,
      customerEmail,
      customerPhone: customerPhone || "Non fourni",
      vehicleMake,
      vehicleModel,
      vehicleYear: vehicleYear || "N/A",
      pickupDate,
      returnDate,
      totalPrice,
    });

    res.status(200).json({
      message: "Email de notification envoyé à l'administrateur",
      result,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi de la notification admin:", err);
    res.status(500).json({ 
      message: "Échec de l'envoi de l'email à l'administrateur",
      error: err.message 
    });
  }
};

/**
 * POST /api/orders/:id/send-notification
 * Envoie un email de confirmation au client (validation ou rejet)
 */
export const sendCustomerNotification = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { status } = req.body; // "approved" ou "rejected"

    // Validation du statut
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ 
        message: "Statut invalide. Utilisez 'approved' ou 'rejected'",
      });
    }

    // Récupère la commande avec les détails du véhicule et de l'utilisateur
    const order = await Order.findById(orderId)
      .populate("user")
      .populate("vehicles.vehicle");

    if (!order) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    // Prépare les données pour l'email
    const vehicle = order.vehicles[0]?.vehicle;
    if (!vehicle) {
      return res.status(400).json({ message: "Aucun véhicule associé à cette commande" });
    }

    const orderData = {
      orderId: order._id,
      customerName: order.user.name || order.user.email,
      customerEmail: order.user.email,
      vehicleMake: vehicle.brand || "N/A",
      vehicleModel: vehicle.model || "N/A",
      vehicleYear: vehicle.year || "N/A",
      pickupDate: order.createdAt, // Adapter selon votre modèle
      returnDate: order.createdAt, // Adapter selon votre modèle
      totalPrice: order.totalPrice,
    };

    // Envoi de l'email au client
    const result = await sendOrderConfirmation(orderData, status);

    res.status(200).json({
      message: `Email de ${status === "approved" ? "confirmation" : "refus"} envoyé au client`,
      result,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi de la notification client:", err);
    res.status(500).json({ 
      message: "Échec de l'envoi de l'email au client",
      error: err.message 
    });
  }
};

/**
 * POST /api/orders/:id/send-payment-reminder
 * Envoie un rappel de paiement au client
 */
export const sendPaymentReminder = async (req, res) => {
  try {
    const { id: orderId } = req.params;

    // Récupère la commande avec les détails du véhicule et de l'utilisateur
    const order = await Order.findById(orderId)
      .populate("user")
      .populate("vehicles.vehicle");

    if (!order) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    // Vérifier que la commande nécessite un paiement
    if (order.status === "payée" || order.status === "complétée") {
      return res.status(400).json({ message: "Cette commande est déjà payée" });
    }

    // Prépare les données pour l'email
    const vehicle = order.vehicles[0]?.vehicle;
    if (!vehicle) {
      return res.status(400).json({ message: "Aucun véhicule associé à cette commande" });
    }

    const orderData = {
      orderId: order._id,
      customerName: order.user.name || order.user.email,
      customerEmail: order.user.email,
      vehicleMake: vehicle.brand || "N/A",
      vehicleModel: vehicle.model || "N/A",
      vehicleYear: vehicle.year || "N/A",
      totalPrice: order.totalPrice,
      dueDate: order.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours par défaut
      daysRemaining: order.dueDate 
        ? Math.ceil((new Date(order.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        : 7,
    };

    // Envoi de l'email de rappel
    const result = await sendPaymentReminderEmail(orderData);

    res.status(200).json({
      message: "Rappel de paiement envoyé au client",
      result,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi du rappel de paiement:", err);
    res.status(500).json({ 
      message: "Échec de l'envoi du rappel de paiement",
      error: err.message 
    });
  }
};

/**
 * POST /api/orders/:id/send-rental-summary
 * Envoie un récapitulatif de location au client après restitution
 */
export const sendRentalSummary = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { 
      startDate,
      endDate,
      startKm,
      endKm,
      fuelLevelStart,
      fuelLevelEnd,
      vehicleCondition = "Bon état",
      additionalCharges = 0,
      additionalChargesReason = ""
    } = req.body;

    // Récupère la commande avec les détails du véhicule et de l'utilisateur
    const order = await Order.findById(orderId)
      .populate("user")
      .populate("vehicles.vehicle");

    if (!order) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    // Prépare les données pour l'email
    const vehicle = order.vehicles[0]?.vehicle;
    if (!vehicle) {
      return res.status(400).json({ message: "Aucun véhicule associé à cette commande" });
    }

    const rentalData = {
      orderId: order._id,
      customerName: order.user.name || order.user.email,
      customerEmail: order.user.email,
      vehicleMake: vehicle.brand || "N/A",
      vehicleModel: vehicle.model || "N/A",
      vehicleYear: vehicle.year || "N/A",
      startDate: startDate || order.createdAt,
      endDate: endDate || new Date(),
      startKm: startKm || 0,
      endKm: endKm || 0,
      kmTraveled: (endKm || 0) - (startKm || 0),
      fuelLevelStart: fuelLevelStart || "Plein",
      fuelLevelEnd: fuelLevelEnd || "Plein",
      vehicleCondition,
      rentalPrice: order.totalPrice,
      additionalCharges,
      additionalChargesReason,
      totalPrice: order.totalPrice + additionalCharges,
    };

    // Envoi de l'email de récapitulatif
    const result = await sendRentalSummaryEmail(rentalData);

    res.status(200).json({
      message: "Récapitulatif de location envoyé au client",
      result,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi du récapitulatif de location:", err);
    res.status(500).json({ 
      message: "Échec de l'envoi du récapitulatif de location",
      error: err.message 
    });
  }
};