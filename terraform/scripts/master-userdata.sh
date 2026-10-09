#!/bin/bash

# -------------------------------------------------
# Jenkins Automated Installation Script
# Installs Java (OpenJDK 21) and Jenkins LTS
# Compatible with Debian / Ubuntu systems
# -------------------------------------------------

set -e

echo "========================================="
echo " Starting Jenkins Installation Setup "
echo "========================================="

# ------------------------------
# Step 1: Update Package Index
# ------------------------------
echo "[1/6] Updating system packages..."
sudo apt update -y

# ------------------------------
# Step 2: Install Java
# ------------------------------
echo "[2/6] Installing OpenJDK 21..."
sudo apt install -y fontconfig openjdk-21-jre

echo "Checking Java installation..."
java -version

# ------------------------------
# Step 3: Add Jenkins Repository Key
# ------------------------------
echo "[3/6] Adding Jenkins repository key..."

sudo mkdir -p /etc/apt/keyrings

sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key

# ------------------------------
# Step 4: Add Jenkins Repository
# ------------------------------
echo "[4/6] Adding Jenkins repository..."

echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] \
https://pkg.jenkins.io/debian-stable binary/" | \
sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

# ------------------------------
# Step 5: Install Jenkins
# ------------------------------
echo "[5/6] Installing Jenkins..."

sudo apt update -y
sudo apt install -y jenkins

# ------------------------------
# Step 6: Start Jenkins Service
# ------------------------------
echo "[6/6] Enabling and starting Jenkins..."

sudo systemctl enable jenkins
sudo systemctl start jenkins

echo ""
echo "========================================="
echo " Jenkins Installation Completed "
echo "========================================="

echo "Checking Jenkins service status..."
sudo systemctl status jenkins --no-pager

echo ""
echo "Access Jenkins at:"
echo "http://<your-server-ip>:8080"
echo ""

echo "Initial Admin Password:"
echo "--------------------------------"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
echo "--------------------------------"
