// src/routes/webhookRoutes.js
import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import Order from "../models/Order.js";

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});


router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ Erreur webhook:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          console.log("✅ Paiement réussi :", paymentIntent.id);
          console.log("📋 Métadonnées reçues:", paymentIntent.metadata);

          const orderId = paymentIntent.metadata?.orderId;

          if (!orderId) {
            console.log(
              "⚠️ Pas d'orderId dans les métadonnées - événement de test Stripe CLI"
            );

            // Pour les tests Stripe CLI, chercher la commande la plus récente "en attente"
            const recentOrder = await Order.findOne({
              status: "en attente",
            }).sort({ createdAt: -1 });

            if (recentOrder) {
              console.log(`🔄 Commande de test trouvée: ${recentOrder._id}`);

              // Mettre à jour la commande avec le PaymentIntent de test
              await Order.findByIdAndUpdate(recentOrder._id, {
                status: "payée",
                paymentIntentId: paymentIntent.id, // Ajouter l'ID du PaymentIntent
                paymentInfo: {
                  id: paymentIntent.id,
                  status: paymentIntent.status,
                  receiptUrl:
                    paymentIntent.charges?.data[0]?.receipt_url || null,
                },
              });

              console.log(
                `🟢 Commande ${recentOrder._id} marquée comme payée (test Stripe CLI)`
              );
            } else {
              console.log("❌ Aucune commande en attente trouvée pour le test");
            }
            break;
          }

          // Traitement normal avec orderId
          const order = await Order.findById(orderId);
          if (!order) {
            console.log(`❌ Commande ${orderId} introuvable`);
            break;
          }

          await Order.findByIdAndUpdate(orderId, {
            status: "payée",
            paymentInfo: {
              id: paymentIntent.id,
              status: paymentIntent.status,
              receiptUrl: paymentIntent.charges?.data[0]?.receipt_url || null,
            },
          });
          console.log(`🟢 Commande ${orderId} marquée comme payée`);
          break;
        }

        case "payment_intent.payment_failed": {
          const failedPayment = event.data.object;
          console.log("❌ Paiement échoué :", failedPayment.id);

          const orderId = failedPayment.metadata?.orderId;
          if (orderId) {
            await Order.findByIdAndUpdate(orderId, {
              status: "échouée",
              paymentInfo: {
                id: failedPayment.id,
                status: failedPayment.status,
              },
            });
            console.log(`🔴 Commande ${orderId} échouée`);
          }
          break;
        }

        default:
          console.log(`ℹ️ Événement Stripe reçu: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Erreur lors du traitement du webhook:", err.message);
      res.status(500).send("Erreur serveur");
    }
  }
);

export default router;
