# Build from the repo root: docker build -f server/Dockerfile .
# Debian (not Alpine): sharp and @napi-rs/canvas ship glibc prebuilt binaries.
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
COPY server server
RUN npm run build --prefix shared && npm run build --prefix server

FROM node:26-slim
ENV NODE_ENV=production HUSKY=0
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY front/package.json front/
COPY e2e/package.json e2e/
# root "prepare" runs husky, a dev dependency not installed here
# better-auth declares drizzle-kit/vitest/react-dom as optional peers: since they are in the lockfile
# (as dev deps), npm marks them "devOptional" and --omit=dev keeps them, so remove them by hand (~170MB)
RUN npm pkg delete scripts.prepare && npm ci --omit=dev -w server -w shared \
	&& rm -rf node_modules/drizzle-kit node_modules/vitest node_modules/@vitest node_modules/vite \
		node_modules/tsx node_modules/esbuild node_modules/@rolldown node_modules/@esbuild node_modules/lightningcss* node_modules/react-dom \
	&& npm cache clean --force
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY server/drizzle server/drizzle
USER node
WORKDIR /app/server
EXPOSE 3000
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/server.js"]
