# Image de production pour le clone de Kahoot (Quiz Party).
FROM node:20-alpine

WORKDIR /app

# Dépendances (couche mise en cache tant que package*.json ne change pas).
COPY package*.json ./
RUN npm ci --omit=dev

# Code applicatif.
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Petit healthcheck sur l'endpoint dédié.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
