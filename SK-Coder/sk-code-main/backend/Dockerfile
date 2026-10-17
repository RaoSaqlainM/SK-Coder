# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:22-bookworm-slim

# Install language runtimes and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    ca-certificates \
    build-essential \
    # Python
    python3 \
    python3-pip \
    # R (statistics)
    r-base \
    # Julia
    julia \
    # Perl
    perl \
    # PowerShell
    powershell \
    # Tcl
    tcl \
    # AWK
    gawk \
    # Groovy (JVM)
    groovy \
    # Prolog
    swi-prolog \
    # Forth
    gforth \
    # Zig
    zig \
    # Nim
    nim \
    # Crystal
    crystal \
    # D language
    gdc \
    # Odin (if available in repo, otherwise skip)
    # COBOL
    gnucobol4 \
    # Ada
    gnat \
    # Assembly
    nasm \
    # Ruby
    ruby \
    # PHP
    php-cli \
    # Java (for JVM languages)
    default-jdk \
    # Go
    golang \
    # Rust
    rustc \
    cargo \
    # .NET
    dotnet-sdk-8.0 \
    # Lua
    lua5.4 \
    # OpenSSL and other essentials
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
