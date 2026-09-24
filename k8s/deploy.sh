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

if [ -f "$K8S_DIR/../backend/.env" ]; then
    echo "Generating backend secret from backend/.env..."

    kubectl create secret generic questly-backend-secrets \
        --from-env-file="$K8S_DIR/../backend/.env" \
        --namespace="$NAMESPACE" \
        --dry-run=client \
        -o yaml > "$K8S_DIR/backend-secrets.yml"

    kubectl apply -f "$K8S_DIR/backend-secrets.yml"

    echo "Backend secret created."
else
    # No .env (e.g. Jenkins) - use the secret already stored in the cluster
    kubectl get secret questly-backend-secrets -n "$NAMESPACE" >/dev/null 2>&1 || {
        echo "ERROR: backend/.env not found and secret 'questly-backend-secrets' does not exist in '$NAMESPACE'."
        exit 1
    }
    echo "Backend secret already exists in cluster - using it."
fi

if [ -f "$K8S_DIR/../frontend/.env" ]; then
    echo "Generating frontend secret from frontend/.env..."

    kubectl create secret generic questly-frontend-secrets \
        --from-env-file="$K8S_DIR/../frontend/.env" \
        --namespace="$NAMESPACE" \
        --dry-run=client \
        -o yaml > "$K8S_DIR/frontend-secrets.yml"

    kubectl apply -f "$K8S_DIR/frontend-secrets.yml"

    echo "Frontend secret created."
else
    # No .env (e.g. Jenkins) - use the secret already stored in the cluster
    kubectl get secret questly-frontend-secrets -n "$NAMESPACE" >/dev/null 2>&1 || {
        echo "ERROR: frontend/.env not found and secret 'questly-frontend-secrets' does not exist in '$NAMESPACE'."
        exit 1
    }
    echo "Frontend secret already exists in cluster - using it."
fi

# 6. Deploy applications
echo ""
echo "[6/7] Deploying backend..."

kubectl apply -f "$K8S_DIR/backend.yml"

echo ""
echo "Deploying frontend..."

kubectl apply -f "$K8S_DIR/frontend.yml"

# Manifests use the :latest tag with imagePullPolicy: Always, so
# 'kubectl apply' alone does not replace running pods when only the
# image on Docker Hub changed. Restart forces new pods, which pull the
# newest image and reload the secrets created above.
echo ""
echo "Restarting deployments to pull the latest images..."

kubectl rollout restart deployment/backend deployment/frontend \
    -n "$NAMESPACE"

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