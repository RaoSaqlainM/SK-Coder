# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:22-bookworm-slim

# Install essential language runtimes and build tools (packages available in Debian bookworm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    r-base \
    perl \
    tcl \
    gawk \
    groovy \
    swi-prolog \
    gforth \
    nim \
    gdc \
    gnucobol4 \
    gnat \
    nasm \
    ruby \
    php-cli \
    default-jdk \
    golang \
    rustc \
    cargo \
    lua5.4 \
    libssl-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Julia depot path to avoid home directory issues
ENV JULIA_DEPOT_PATH=/tmp/julia_depot

# Create workspace directory
WORKDIR /app

# Copy build artifacts
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
