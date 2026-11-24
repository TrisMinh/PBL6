FROM node:24.22.0-alpine AS build
WORKDIR /app
ENV HUSKY=0
RUN npm install --global pnpm@10.34.7
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG APP_TARGET=customer
ARG API_MODE=mock
ARG OPERATOR_POWER_BI_EMBED_URL=
ARG CUSTOMER_WEB_ORIGIN=
ENV BLUE_APP_TARGET=${APP_TARGET}
ENV VITE_API_MODE=${API_MODE}
ENV VITE_OPERATOR_POWER_BI_EMBED_URL=${OPERATOR_POWER_BI_EMBED_URL}
ENV VITE_CUSTOMER_ORIGIN=${CUSTOMER_WEB_ORIGIN}
ENV VITE_API_BASE_URL=""
RUN node scripts/portal.mjs ${APP_TARGET} build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ARG APP_TARGET=customer
ARG API_MODE=mock
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/gateway-proxy.inc /etc/nginx/gateway-proxy.inc
COPY docker/nginx.mock.conf /tmp/nginx.mock.conf
RUN if [ "$API_MODE" = "mock" ]; then cp /tmp/nginx.mock.conf /etc/nginx/conf.d/default.conf; fi
COPY --from=build /app/build/${APP_TARGET}/client /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
