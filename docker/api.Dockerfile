# CogniMesh API (Node)
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
# Portal postinstall is not needed in the API image
ENV COGNIMESH_SKIP_PORTAL_INSTALL=1
RUN npm ci --omit=dev --ignore-scripts

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
