# CogniMesh Portal — production static build + nginx
FROM node:20-alpine AS build
WORKDIR /app

COPY portal/package.json portal/package-lock.json ./
RUN npm ci

COPY portal/ ./
# Empty base → browser calls /api on same origin (nginx proxies to api service)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache curl
COPY docker/nginx-portal.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=20s \
  CMD curl -fsS http://localhost:80/ || exit 1
