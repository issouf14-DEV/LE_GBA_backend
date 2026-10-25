# Image de production de l'API LE-GBA (déployée sur Northflank)
# - dépendances de production uniquement, installées depuis package-lock.json
# - le serveur tourne avec l'utilisateur « node », sans droits administrateur
# - aucun secret dans l'image : tout est fourni par les variables d'environnement de Northflank

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

USER node
EXPOSE 8080

# Northflank vérifie aussi /health depuis son tableau de bord ; ceci couvre `docker run`
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

CMD ["node", "src/server.js"]
