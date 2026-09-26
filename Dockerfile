# Mythverse: imagem de produção. Banco: SQLite local (padrão) ou PostgreSQL via DATABASE_URL.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    TRUST_PROXY=1

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY src ./src
COPY assets/sprites ./assets/sprites
COPY assets/portraits ./assets/portraits
COPY assets/icons ./assets/icons
COPY assets/scenes ./assets/scenes
COPY assets/brand ./assets/brand
COPY assets/ui ./assets/ui
COPY legal ./legal
COPY admin ./admin
COPY index.html styles.css ./

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
