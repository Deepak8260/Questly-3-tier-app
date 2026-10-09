#!/bin/bash
# Master: Jenkins controller.
# Rendered by Terraform templatefile(). Log: /var/log/cloud-init-output.log
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y fontconfig ${java_package} git curl

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
  -o /etc/apt/keyrings/jenkins-keyring.asc
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list

apt-get update -y
apt-get install -y jenkins

# Listen on the port Terraform opened in the security group
install -d /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/override.conf <<OVERRIDE
[Service]
Environment="JENKINS_PORT=${jenkins_port}"
OVERRIDE
systemctl daemon-reload
systemctl enable jenkins
systemctl restart jenkins

java -version
systemctl is-active jenkins

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
