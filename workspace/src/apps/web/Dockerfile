FROM node:24.22.0-alpine AS build
WORKDIR /app
ENV HUSKY=0
RUN npm install --global pnpm@10.34.7
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
# Vite replaces these values at build time. Browser requests use the same origin.
ENV VITE_API_MODE=live
ENV VITE_API_BASE_URL=""
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/client /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
