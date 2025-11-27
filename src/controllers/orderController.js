// src/controllers/orderController.js (version avec debug)
import Vehicle from "../models/Vehicle.js";
import Order from "../models/Order.js";
import { createPaymentIntent } from "../utils/payment.js";

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
      const stripe = require("../config/stripe.js").stripe;
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
    const orders = await Order.find()
      .populate("user")
      .populate("vehicles.vehicle");
    res.json(orders);
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