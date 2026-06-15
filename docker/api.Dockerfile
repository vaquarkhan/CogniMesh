# CogniMesh API (Node)
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY lib ./lib
COPY services/api-gateway ./services/api-gateway
COPY services/pipeline-engine ./services/pipeline-engine
COPY services/pvdm-runtime ./services/pvdm-runtime
COPY schemas ./schemas
COPY rules ./rules

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "services/api-gateway/server.js"]
