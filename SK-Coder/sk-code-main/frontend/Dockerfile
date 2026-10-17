FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN corepack enable && pnpm install --config.onlyBuiltDependencies=esbuild
COPY . .
ARG VITE_OWNER_DASHBOARD_HOST=""
ENV VITE_OWNER_DASHBOARD_HOST=$VITE_OWNER_DASHBOARD_HOST
RUN PORT=5173 BASE_PATH=/ pnpm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
