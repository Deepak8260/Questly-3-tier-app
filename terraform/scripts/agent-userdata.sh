#!/bin/bash
# Agent: Jenkins agent "flask-builder" running kind.
# Rendered by Terraform templatefile(). Log: /var/log/cloud-init-output.log
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
# Java is required for the Jenkins agent process launched over SSH
apt-get install -y docker.io git curl openjdk-21-jre-headless

systemctl enable --now docker
usermod -aG docker ubuntu

# kind
curl -fsSLo /usr/local/bin/kind \
  "https://kind.sigs.k8s.io/dl/${kind_version}/kind-linux-amd64"
chmod +x /usr/local/bin/kind

# kubectl
curl -fsSLo /usr/local/bin/kubectl \
  "https://dl.k8s.io/release/${kubectl_version}/bin/linux/amd64/kubectl"
chmod +x /usr/local/bin/kubectl

# Multi-node kind clusters exhaust the default inotify limits
cat > /etc/sysctl.d/99-kind.conf <<'EOF'
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512
EOF
sysctl --system

# Jenkins agent remote root directory
install -d -o ubuntu -g ubuntu /home/ubuntu/jenkins
