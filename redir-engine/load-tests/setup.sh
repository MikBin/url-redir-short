#!/bin/bash
set -e

K6_VERSION="v0.51.0"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
    ARCH="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH="arm64"
fi

if [ -f "./k6" ]; then
    echo "k6 binary already exists."
    ./k6 version
    exit 0
fi

echo "Downloading k6 $K6_VERSION for $OS/$ARCH..."

if [ "$OS" = "linux" ]; then
    URL="https://github.com/grafana/k6/releases/download/$K6_VERSION/k6-$K6_VERSION-linux-$ARCH.tar.gz"
    curl -L $URL -o k6.tar.gz
    tar -xzf k6.tar.gz
    mv k6-$K6_VERSION-linux-$ARCH/k6 .
    rm -rf k6.tar.gz k6-$K6_VERSION-linux-$ARCH
elif [ "$OS" = "darwin" ]; then
    URL="https://github.com/grafana/k6/releases/download/$K6_VERSION/k6-$K6_VERSION-macos-$ARCH.zip"
    curl -L $URL -o k6.zip
    unzip k6.zip
    # The zip structure might differ slightly, usually it is a single binary or folder
    if [ -d "k6-$K6_VERSION-macos-$ARCH" ]; then
        mv k6-$K6_VERSION-macos-$ARCH/k6 .
        rm -rf k6-$K6_VERSION-macos-$ARCH
    fi
    rm k6.zip
else
    echo "Unsupported OS: $OS"
    exit 1
fi

chmod +x k6
echo "k6 installed successfully."
./k6 version
