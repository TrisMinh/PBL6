FROM node:22-alpine AS build
WORKDIR /app
COPY workspace/src/infra/docker/web-package.json ./package.json
COPY workspace/src/packages ./src/packages
COPY workspace/src/apps/customer-web ./src/apps/customer-web
COPY workspace/src/apps/backoffice-web ./src/apps/backoffice-web
RUN npm install
ARG APP
RUN npm run build -w "@busticket/${APP}"

FROM nginx:1.27-alpine
ARG APP
COPY workspace/src/infra/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/apps/${APP}/dist /usr/share/nginx/html
EXPOSE 80
