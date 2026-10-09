#!/bin/bash
# Agent: Jenkins agent running kind.
# Installs Java, Docker + Compose v2, kind and kubectl.
# Rendered by Terraform templatefile(). Log: /var/log/cloud-init-output.log
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
# Java is required for the Jenkins agent process launched over SSH
apt-get install -y git curl ${java_package}

# Docker engine + Compose v2 plugin (`docker compose`)
apt-get install -y docker.io ${docker_compose_package}
systemctl enable --now docker

# Equivalent of `usermod -aG docker` + `newgrp docker`: newgrp only
# affects an interactive shell, so it cannot be run here. The group is
# applied on every new login, and the ubuntu user / Jenkins only log in
# after this script finishes, so docker works without sudo for them.
usermod -aG docker ${ssh_user}

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
install -d -o ${ssh_user} -g ${ssh_user} /home/${ssh_user}/jenkins

# Record installed versions in the cloud-init log, and prove the user
# can talk to Docker without sudo (fails the script if it cannot)
java -version
docker --version
docker compose version
kind version
kubectl version --client
sudo -iu ${ssh_user} docker info --format '{{.ServerVersion}}'

%{ if ssh_port != 22 ~}
# Move sshd to the port Terraform opened in the security groups
# (Ubuntu 24.04 starts sshd through ssh.socket)
install -d /etc/systemd/system/ssh.socket.d
cat > /etc/systemd/system/ssh.socket.d/port.conf <<SOCKET
[Socket]
ListenStream=
ListenStream=${ssh_port}
SOCKET
systemctl daemon-reload
systemctl stop ssh.service || true
systemctl restart ssh.socket
%{ endif ~}
