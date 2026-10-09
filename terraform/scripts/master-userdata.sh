#!/bin/bash
# Master: Jenkins controller. Log: /var/log/cloud-init-output.log
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y fontconfig openjdk-21-jre git curl

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
  -o /etc/apt/keyrings/jenkins-keyring.asc
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list

apt-get update -y
apt-get install -y jenkins
systemctl enable --now jenkins
