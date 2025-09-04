import express from "express";
import morgan from "morgan";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

const app = express();

// ⚠️ Webhook Stripe doit être défini AVANT express.json()
app.use("/api/stripe", webhookRoutes);

// --- Middlewares globaux ---
app.use(express.json());
app.use(morgan("dev"));
app.use(cors());

// --- Routes principales ---
app.get("/", (req, res) => {
  res.json({ message: "Bienvenue sur l’API GBA 🚗" });
});

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);

// --- Middlewares d’erreurs ---
app.use(notFound);
app.use(errorHandler);

export default app;
