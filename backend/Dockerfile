FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 8787
CMD ["node", "src/server.js"]
