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

// Configuration CORS dynamique - Support ALL Railway origins + local
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  process.env.FRONTEND_URL
].filter(Boolean);

// Fonction pour vérifier si l'origine est autorisée
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  
  // Autoriser toutes les URLs Railway
  if (origin.includes('.railway.app')) {
    return true;
  }
  
  // Autoriser les origines dans la liste
  return allowedOrigins.includes(origin);
};

const corsOptions = {
  origin: (origin, callback) => {
    // Log pour debug
    console.log(`🔍 CORS request from: ${origin}`);
    
    if (isAllowedOrigin(origin)) {
      console.log(`✅ CORS allowed: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      console.log(`Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- Routes principales ---
app.get("/", (req, res) => {
  res.json({ 
    message: "Bienvenue sur l'API GBA 🚗",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      vehicles: "/api/vehicles",
      orders: "/api/orders",
      admin: "/api/admin",
      payments: "/api/payments"
    }
  });
});

// Health check pour Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
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
