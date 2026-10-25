import { defineConfig } from "vitest/config";

// Variables de test uniquement (aucun vrai secret) ; la base MongoDB tourne en mémoire
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    fileParallelism: false,
    // Hachage bcrypt (coût 12) lent sur une machine chargée
    testTimeout: 90_000,
    hookTimeout: 180_000,
    env: {
      NODE_ENV: "test",
      MONGO_URI: "mongodb://127.0.0.1:1/remplace-par-la-base-en-memoire",
      JWT_ACCESS_SECRET: "secret-de-test-acces-0123456789-abcdefghij",
      JWT_REFRESH_SECRET: "secret-de-test-renouvellement-0123456789-abc",
      FRONTEND_URL: "https://legba-zeta.vercel.app",
      TRUST_PROXY_HOPS: "0",
      ADMIN_EMAIL: "admin@test.local",
    },
  },
});
