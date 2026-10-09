#!/bin/bash

# ==========================================

# KIND + kubectl Installation Script on AWS EC2

# Ubuntu + docker.io + Docker Compose v2 + Java

# ==========================================



set -e

# User data runs without a terminal: never stop at an apt prompt
export DEBIAN_FRONTEND=noninteractive



echo "========================================="

echo " Updating Packages"

echo "========================================="



sudo apt update -y

sudo apt upgrade -y



echo "========================================="

echo " Installing Java"

echo "========================================="



sudo apt install -y fontconfig openjdk-21-jre

echo "Checking Java installation..."
java -version



echo "========================================="

echo " Installing Docker + Docker Compose v2"

echo "========================================="



sudo apt install -y docker.io docker-compose-v2 curl



echo "========================================="

echo " Starting Docker Service"

echo "========================================="



sudo systemctl start docker

sudo systemctl enable docker



echo "========================================="

echo " Adding User to Docker Group"

echo "========================================="



# User data runs as root, so $USER is not the login user - name it
sudo usermod -aG docker ubuntu



echo "========================================="

echo " Installing KIND"

echo "========================================="



curl -Lo kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64



chmod +x kind



# Move KIND binary to system PATH

sudo mv kind /usr/local/bin/



echo "========================================="

echo " Installing kubectl"

echo "========================================="



curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"



chmod +x kubectl



# Move kubectl binary to system PATH

sudo mv kubectl /usr/local/bin/



echo "========================================="

echo " Verifying Installations"

echo "========================================="



docker --version

docker compose version

kind --version

kubectl version --client



echo "========================================="

echo " KIND and kubectl Installation Completed"

echo "========================================="



echo ""

echo "If docker permission issue occurs, run:"

echo "newgrp docker"

echo ""
