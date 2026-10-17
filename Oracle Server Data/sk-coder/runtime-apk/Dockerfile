FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends apktool aapt apksigner zipalign unzip zip ca-certificates openjdk-17-jdk-headless && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/sh coder
USER coder
WORKDIR /job
