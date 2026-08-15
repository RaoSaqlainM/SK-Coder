FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl git g++ gcc golang-go make openjdk-21-jdk python3 python3-pip rustc && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1000 coder && useradd --uid 1000 --gid 1000 --create-home --shell /bin/bash coder
RUN npm install -g pnpm@9.12.0
WORKDIR /workspace
USER coder
CMD ["bash"]
