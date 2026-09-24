#!/bin/bash

set -e

CLUSTER_NAME="questly"
NAMESPACE="questly-ns"

K8S_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================="
echo "      QUESTLY KUBERNETES DEPLOYMENT"
echo "========================================="

# 1. Check required tools
echo ""
echo "[1/7] Checking required tools..."

command -v docker >/dev/null 2>&1 || {
    echo "ERROR: Docker is not installed."
    exit 1
}

command -v kubectl >/dev/null 2>&1 || {
    echo "ERROR: kubectl is not installed."
    exit 1
}

command -v kind >/dev/null 2>&1 || {
    echo "ERROR: kind is not installed."
    exit 1
}

echo "Docker  : OK"
echo "kubectl : OK"
echo "kind    : OK"

# 2. Check Docker
echo ""
echo "[2/7] Checking Docker..."

if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker Desktop is not running."
    exit 1
fi

echo "Docker Desktop is running."

# 3. Create kind cluster
echo ""
echo "[3/7] Creating kind cluster..."

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    echo "Cluster '$CLUSTER_NAME' already exists."
else
    kind create cluster \
        --name "$CLUSTER_NAME" \
        --config "$K8S_DIR/kind-config.yml"
fi

# 4. Verify cluster
echo ""
echo "[4/7] Verifying cluster..."

kubectl get nodes

# 5. Create namespace and secrets
echo ""
echo "[5/7] Creating namespace and secrets..."

kubectl apply -f "$K8S_DIR/namespace.yml"

echo "Generating backend secret from backend/.env..."

kubectl create secret generic questly-backend-secrets \
    --from-env-file="$K8S_DIR/../backend/.env" \
    --namespace="$NAMESPACE" \
    --dry-run=client \
    -o yaml > "$K8S_DIR/backend-secrets.yml"

kubectl apply -f "$K8S_DIR/backend-secrets.yml"

echo "Backend secret created."

echo "Generating frontend secret from frontend/.env..."

kubectl create secret generic questly-frontend-secrets \
    --from-env-file="$K8S_DIR/../frontend/.env" \
    --namespace="$NAMESPACE" \
    --dry-run=client \
    -o yaml > "$K8S_DIR/frontend-secrets.yml"

kubectl apply -f "$K8S_DIR/frontend-secrets.yml"

echo "Frontend secret created."

# 6. Deploy applications
echo ""
echo "[6/7] Deploying backend..."

kubectl apply -f "$K8S_DIR/backend.yml"

echo ""
echo "Deploying frontend..."

kubectl apply -f "$K8S_DIR/frontend.yml"

# 7. Wait for applications
echo ""
echo "[7/7] Waiting for deployments..."

kubectl rollout status deployment/backend \
    -n "$NAMESPACE" \
    --timeout=180s

kubectl rollout status deployment/frontend \
    -n "$NAMESPACE" \
    --timeout=180s

# Final status
echo ""
echo "========================================="
echo "          QUESTLY IS RUNNING"
echo "========================================="

echo ""
echo "Pods:"
kubectl get pods -n "$NAMESPACE"

echo ""
echo "Services:"
kubectl get svc -n "$NAMESPACE"

echo ""
echo "Deployments:"
kubectl get deployments -n "$NAMESPACE"

echo ""
echo "========================================="
echo "Frontend: http://localhost:30080"
echo "Backend : http://localhost:30081"
echo "========================================="