import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";
import { apiLimiter } from "./middlewares/rateLimits.js";
import { corsPolicy, jsonBody, requireAjax, requireProxy } from "./middlewares/security.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";

const app = express();

// Derrière Vercel et Northflank : nécessaire pour connaître la vraie IP (limites de requêtes)
app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(helmet());
app.use(corsPolicy);
if (env.NODE_ENV !== "test") app.use(morgan(env.NODE_ENV === "production" ? "tiny" : "dev"));

app.use(cookieParser());

// Appelé directement par l'hébergeur (Northflank) pour vérifier que le service répond
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Ordre volontaire : proxy, limites et anti-CSRF AVANT toute lecture du corps de la requête
app.use("/api", requireProxy, apiLimiter, requireAjax);
// Corps JSON limité à 100 Ko ; les photos de véhicules (3 Mo) sont lues dans leurs routes,
// seulement après vérification du rôle admin
const smallJson = jsonBody("100kb");
app.use("/api/auth", smallJson, authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/orders", smallJson, orderRoutes);
app.use("/api/admin", smallJson, adminRoutes);
app.use("/api/team", smallJson, teamRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
