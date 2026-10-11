# kind and kubectl Commands (Questly)

Every command you need to look at, fix and manage the Questly cluster.
The names below are the real ones from this project.

| Thing | Name in this project |
|---|---|
| kind cluster | `questly` |
| App namespace | `questly-ns` |
| Monitoring namespace | `monitoring` |
| App deployments | `backend`, `frontend` |
| Monitoring deployments | `prometheus`, `grafana`, `loki`, `alloy` |
| Monitoring daemonset | `node-exporter` |
| App secrets | `questly-backend-secrets`, `questly-frontend-secrets` |
| Grafana secret | `grafana-admin` |

**Where to run them:** on the machine that runs the cluster. On AWS that
is the **agent**, logged in as `ubuntu`. Run them from the
`Questly-3-tier-app` folder when a command uses a file path such as
`k8s/...`.

**Two tools:**

| Tool | What it manages |
|---|---|
| `kind` | The cluster itself: create it, delete it, list it. |
| `kubectl` | Everything inside the cluster: pods, services, secrets, logs. |

**Safe or not:** each section says whether its commands only look
(**read-only**) or change something (**changes the cluster**).

`-n` is the short form of `--namespace`. Both work the same.

---

## A. kind: the cluster itself

**1. List all kind clusters** (read-only)

```bash
kind get clusters
```

**2. Create the Questly cluster** (changes the cluster)

```bash
kind create cluster --name questly --config k8s/kind-config.yml
```

**3. List the nodes of the cluster** (read-only)

```bash
kind get nodes --name questly
```

**4. Delete the cluster** (changes the cluster: removes everything in it, including secrets)

```bash
kind delete cluster --name questly
```

**5. Check the kind version** (read-only)

```bash
kind version
```

**6. See the cluster as Docker containers** (read-only)

```bash
docker ps
```

Each kind node is one container: `questly-control-plane` and `questly-worker`.

**7. Fix "connection refused" from kubectl by reloading the cluster login** (changes your kubeconfig file only)

```bash
kind export kubeconfig --name questly
```

**8. Load a local Docker image into the cluster** (changes the cluster)

```bash
kind load docker-image kumar3472/questly-backend:latest --name questly
```

Only needed for an image that is not on Docker Hub.

**9. Save all cluster logs to a folder** (read-only)

```bash
kind export logs ./kind-logs --name questly
```

---

## B. Cluster and nodes

All read-only.

**10. Check that kubectl can reach the cluster**

```bash
kubectl cluster-info
```

**11. List the nodes**

```bash
kubectl get nodes
```

Both must show `Ready`.

**12. List the nodes with IPs and versions**

```bash
kubectl get nodes -o wide
```

**13. See full details of one node**

```bash
kubectl describe node questly-worker
```

**14. Check the kubectl and cluster versions**

```bash
kubectl version
```

**15. See which cluster kubectl is pointing at**

```bash
kubectl config current-context
```

It should print `kind-questly`.

---

## C. Namespaces

**16. List all namespaces** (read-only)

```bash
kubectl get namespaces
```

**17. Create the app namespace** (changes the cluster)

```bash
kubectl apply -f k8s/namespace.yml
```

**18. Make `questly-ns` the default, so you can leave out `-n questly-ns`** (changes your kubeconfig file only)

```bash
kubectl config set-context --current --namespace=questly-ns
```

---

## D. Pods

All read-only except 26.

**19. Check pods in a namespace**

```bash
kubectl get pods --namespace questly-ns
```

**20. Check the monitoring pods**

```bash
kubectl get pods --namespace monitoring
```

**21. Check pods in every namespace**

```bash
kubectl get pods --all-namespaces
```

Short form: `kubectl get pods -A`

**22. Show pods with their IP and node**

```bash
kubectl get pods -n questly-ns -o wide
```

**23. Watch pods change live** (press `Ctrl+C` to stop)

```bash
kubectl get pods -n questly-ns --watch
```

**24. Show only the backend pods**

```bash
kubectl get pods -n questly-ns -l app=backend
```

**25. See why a pod is not starting**

```bash
kubectl describe pod <pod-name> -n questly-ns
```

Read the **Events** section at the bottom. Get `<pod-name>` from command 19.

**26. Delete a pod so a fresh one is created** (changes the cluster)

```bash
kubectl delete pod <pod-name> -n questly-ns
```

The deployment starts a replacement automatically.

**What the pod status means:**

| Status | Meaning | What to do |
|---|---|---|
| `Running` | Working. | Nothing. |
| `ContainerCreating` | Starting. | Wait. |
| `Pending` | Not placed on a node yet. | Command 25. |
| `ImagePullBackOff` | Cannot download the image. | Check the image name and internet access. |
| `CrashLoopBackOff` | The app starts and crashes repeatedly. | Commands 27 and 30. |
| `CreateContainerConfigError` | A secret or config it needs is missing. | Command 49. |

---

## E. Logs

All read-only.

**27. See the backend logs**

```bash
kubectl logs deployment/backend -n questly-ns
```

**28. See the frontend logs**

```bash
kubectl logs deployment/frontend -n questly-ns
```

**29. Follow logs live** (press `Ctrl+C` to stop)

```bash
kubectl logs -f deployment/backend -n questly-ns
```

**30. See logs from before the last crash**

```bash
kubectl logs <pod-name> -n questly-ns --previous
```

**31. See only the last 50 lines**

```bash
kubectl logs deployment/backend -n questly-ns --tail=50
```

**32. See logs from the last 10 minutes**

```bash
kubectl logs deployment/backend -n questly-ns --since=10m
```

**33. See logs of a monitoring tool**

```bash
kubectl logs deployment/grafana -n monitoring
```

---

## F. Deployments

**34. List deployments** (read-only)

```bash
kubectl get deployments -n questly-ns
```

`READY 1/1` means it is working.

**35. See full details of a deployment** (read-only)

```bash
kubectl describe deployment backend -n questly-ns
```

**36. Deploy the backend and the frontend** (changes the cluster)

```bash
kubectl apply -f k8s/backend.yml
kubectl apply -f k8s/frontend.yml
```

**37. Restart a deployment to pull the newest image or reload a secret** (changes the cluster)

```bash
kubectl rollout restart deployment/backend -n questly-ns
kubectl rollout restart deployment/frontend -n questly-ns
```

**38. Wait until a rollout finishes** (read-only)

```bash
kubectl rollout status deployment/backend -n questly-ns
```

**39. See rollout history** (read-only)

```bash
kubectl rollout history deployment/backend -n questly-ns
```

**40. Go back to the previous version** (changes the cluster)

```bash
kubectl rollout undo deployment/backend -n questly-ns
```

**41. Change the number of copies** (changes the cluster)

```bash
kubectl scale deployment/backend --replicas=2 -n questly-ns
```

**42. See which image a deployment uses** (read-only)

```bash
kubectl get deployment backend -n questly-ns -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
```

---

## G. Services and ports

**43. List services** (read-only)

```bash
kubectl get services -n questly-ns
```

Short form: `kubectl get svc -n questly-ns`

**44. List the monitoring services** (read-only)

```bash
kubectl get svc -n monitoring
```

**45. See which pods a service sends traffic to** (read-only)

```bash
kubectl get endpoints -n questly-ns
```

An empty `ENDPOINTS` column means no healthy pod is behind the service.

**46. Test the app from the machine running the cluster** (read-only)

```bash
curl -I http://localhost:30080
curl http://localhost:30081/health
```

**The ports in this project:**

| Service | Port inside the pod | Port on the machine (NodePort) |
|---|---|---|
| frontend | 3000 | 30080 |
| backend | 3001 | 30081 |
| grafana | 3000 | 30030 |
| prometheus | 9090 | 30090 |

**47. Open a service on a local port without a NodePort** (read-only; press `Ctrl+C` to stop)

```bash
kubectl port-forward svc/backend 8081:3001 -n questly-ns
```

---

## H. Secrets

**48. List secrets** (read-only)

```bash
kubectl get secrets -n questly-ns
```

**49. See which keys a secret contains, without the values** (read-only)

```bash
kubectl describe secret questly-backend-secrets -n questly-ns
```

**50. Read one value from a secret** (read-only, but prints a secret on screen)

```bash
kubectl get secret questly-frontend-secrets -n questly-ns -o jsonpath='{.data.NEXT_PUBLIC_API_BASE_URL}' | base64 -d; echo
```

**51. Create the app secrets from the `.env` files** (changes the cluster)

```bash
kubectl create secret generic questly-backend-secrets  --from-env-file=/tmp/backend.env  -n questly-ns
kubectl create secret generic questly-frontend-secrets --from-env-file=/tmp/frontend.env -n questly-ns
```

**52. Replace a secret after changing a value** (changes the cluster)

```bash
kubectl delete secret questly-frontend-secrets -n questly-ns
kubectl create secret generic questly-frontend-secrets --from-env-file=/tmp/frontend.env -n questly-ns
kubectl rollout restart deployment/frontend -n questly-ns
```

A pod reads its secret only when it starts, so the restart is needed.

**53. Get the Grafana admin password** (read-only, but prints a secret on screen)

```bash
kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.GF_SECURITY_ADMIN_PASSWORD}' | base64 -d; echo
```

---

## I. Go inside a pod

**54. Open a shell inside the backend pod** (type `exit` to leave)

```bash
kubectl exec -it deployment/backend -n questly-ns -- sh
```

**55. Run one command inside a pod**

```bash
kubectl exec deployment/backend -n questly-ns -- env
```

This prints the pod's environment variables, including secret values.

**56. Check that the frontend pod can reach the backend**

```bash
kubectl exec deployment/frontend -n questly-ns -- wget -qO- http://backend:3001/health
```

It should print `{"status":"ok"}`. If it says `wget: not found`, the
image does not include `wget`; use command 46 instead.

**57. Copy a file out of a pod**

```bash
kubectl cp questly-ns/<pod-name>:<path-inside-the-pod> ./<local-file-name>
```

Find the path first with command 54 and `ls`. The image must include
`tar` for this to work.

---

## J. Events and resource usage

All read-only.

**58. See recent events, oldest first**

```bash
kubectl get events -n questly-ns --sort-by=.lastTimestamp
```

This is the first place to look when something is not starting.

**59. See events in every namespace**

```bash
kubectl get events -A --sort-by=.lastTimestamp
```

**60. See everything in a namespace at once**

```bash
kubectl get all -n questly-ns
```

**61. See CPU and memory per pod**

```bash
kubectl top pods -n questly-ns
```

This needs the metrics-server add-on, which this project does not
install. Without it the command prints `Metrics API not available`. Use
`docker stats` on the machine, or Grafana, to see usage.

**62. See CPU and memory of the kind nodes through Docker**

```bash
docker stats --no-stream
```

---

## K. Monitoring stack

**63. Deploy the whole monitoring stack** (changes the cluster)

```bash
kubectl apply -f k8s/monitoring/
```

**64. Check the monitoring pods and services** (read-only)

```bash
kubectl get pods,svc -n monitoring
```

**65. Check the node-exporter daemonset** (read-only)

```bash
kubectl get daemonset node-exporter -n monitoring
```

**66. Check the storage claims** (read-only)

```bash
kubectl get pvc -n monitoring
```

All three (`prometheus-data`, `grafana-data`, `loki-data`) must show `Bound`.

**67. Restart the monitoring tools after a config change** (changes the cluster)

```bash
kubectl rollout restart deployment/prometheus deployment/loki deployment/alloy deployment/grafana -n monitoring
```

**68. See a config map** (read-only)

```bash
kubectl get configmap prometheus-config -n monitoring -o yaml
```

---

## L. Deploy and clean up

All of these change the cluster.

**69. Deploy everything with the project script**

```bash
bash k8s/deploy.sh
```

It creates the cluster if it is missing, then the namespace, secrets, app
and monitoring stack.

**70. Remove the app but keep the cluster**

```bash
kubectl delete -f k8s/frontend.yml -f k8s/backend.yml
```

**71. Remove the monitoring stack but keep the cluster**

```bash
kubectl delete -f k8s/monitoring/
```

**72. Delete a whole namespace and everything in it**

```bash
kubectl delete namespace questly-ns
```

This also deletes the secrets in it.

**73. Delete the cluster completely**

```bash
kind delete cluster --name questly
```

---

## M. Output formats and help

All read-only.

**74. Show any resource as YAML**

```bash
kubectl get deployment backend -n questly-ns -o yaml
```

**75. Show the labels of pods**

```bash
kubectl get pods -n questly-ns --show-labels
```

**76. Explain what a field means**

```bash
kubectl explain deployment.spec.replicas
```

**77. List every kind of resource the cluster knows**

```bash
kubectl api-resources
```

**78. Check a file for errors without applying it**

```bash
kubectl apply -f k8s/backend.yml --dry-run=client
```

**79. See what would change before applying a file**

```bash
kubectl diff -f k8s/backend.yml
```

---

## Quick troubleshooting

| Problem | Commands to run, in order |
|---|---|
| A pod is not `Running` | 19, then 25, then 27, then 58 |
| The app keeps crashing | 30, then 49 |
| The page does not open | 19, then 43, then 45, then 46 |
| The frontend cannot reach the backend | 50, then 56 |
| A new image is not being used | 37, then 38, then 42 |
| I changed an env value | 52 |
| `kubectl` says connection refused | 1, then 6, then 7 |
| Nothing works at all | 11, then 21, then 59 |

## The ten you will use most

```bash
kubectl get pods -n questly-ns
kubectl get pods -A
kubectl describe pod <pod-name> -n questly-ns
kubectl logs -f deployment/backend -n questly-ns
kubectl get svc -n questly-ns
kubectl get events -n questly-ns --sort-by=.lastTimestamp
kubectl rollout restart deployment/backend -n questly-ns
kubectl rollout status deployment/backend -n questly-ns
kubectl exec -it deployment/backend -n questly-ns -- sh
kind get clusters
```
