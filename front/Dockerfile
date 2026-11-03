# Build from the repo root: docker build -f front/Dockerfile .
FROM node:26-slim AS build
ENV HUSKY=0
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY front/package.json front/
COPY e2e/package.json e2e/
RUN npm ci
COPY shared shared
COPY front front
# The API is served on the same origin under /api (Traefik strips the prefix before the server)
ENV VITE_API_BASE_URL=/api
# Shown in the footer; declared late so a new version doesn't invalidate the npm ci layer
ARG APP_VERSION
ARG BUILD_DATE
ENV VITE_APP_VERSION=$APP_VERSION VITE_BUILD_DATE=$BUILD_DATE
# front's tsc resolves @personal-tracker/shared types from shared/dist
RUN npm run build --prefix shared && npm run build --prefix front

FROM nginx:1.29-alpine
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/front/dist /usr/share/nginx/html
