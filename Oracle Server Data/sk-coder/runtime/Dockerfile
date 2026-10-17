FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS dotnet

FROM node:22-bookworm-slim
COPY --from=dotnet /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet
ENV DOTNET_ROOT=/usr/share/dotnet
ENV PATH="/usr/share/dotnet:${PATH}"
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-numpy openjdk-17-jdk-headless build-essential cmake maven gradle composer git curl ca-certificates golang-go rustc cargo php-cli ruby-full kotlin tmux libicu72 libssl3 zlib1g && rm -rf /var/lib/apt/lists/*
RUN npm install -g --no-audit --no-fund --force typescript tsx pnpm yarn vite && git config --system --add safe.directory /workspace && useradd --create-home --shell /bin/bash coder
ENV DOTNET_NOLOGO=1
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
COPY go-wrapper /usr/local/bin/go
RUN chmod 755 /usr/local/bin/go
USER coder
WORKDIR /workspace
