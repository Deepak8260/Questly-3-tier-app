# Questly – Architecture Diagrams

Six diagrams, from the inside out: the app itself, its containers, the
Kubernetes cluster they run in, the AWS infrastructure around it, the
pipeline that deploys it, and the monitoring that watches it.

Every name, port and value in them comes from the code in this repository.

## Contents

1. [Application architecture](#1-application-architecture)
2. [Container architecture](#2-container-architecture)
3. [Kubernetes architecture](#3-kubernetes-architecture)
4. [Cloud architecture](#4-cloud-architecture)
5. [CI/CD pipeline architecture](#5-cicd-pipeline-architecture)
6. [Monitoring architecture](#6-monitoring-architecture)
7. [How the six fit together](#how-the-six-fit-together)

---

## 1. Application architecture

![Application architecture](01-application-architecture.svg)

**What it shows:** the three tiers of Questly and who talks to whom.

| Tier | What | Code |
|---|---|---|
| Presentation | Next.js 16 pages in the browser, rendered by the Next.js server | `frontend/` |
| Application | Express 5 API: quiz generation with Gemini, saving scores | `backend/` |
| Data | Supabase: auth, Postgres tables, realtime, an Edge Function | `database/supabase/` |

**Read it like this:**

- **The browser talks to three places:**
  - the Next.js server, for pages;
  - the backend, for `POST /api/quiz/generate` and `/save-attempt`;
  - Supabase directly, for login, most data and live battles.
- **Two kinds of Supabase key:**
  - The browser uses the public **anon** key. Row Level Security limits what it can do.
  - Only the backend holds the **service_role** key and the Gemini key.
- **The backend's `GET /health`** is what the load balancer checks on AWS.

**Related:** [Jenkins 3: every `.env` value](../04-jenkins/03-agent-workspace-and-env-files.md)

---

## 2. Container architecture

![Container architecture](02-container-architecture.svg)

**What it shows:** how each image is built, and the whole stack running on
a laptop with Docker Compose.

**Read it like this:**

- **Part A, building:** each Dockerfile has two stages.
  - **Stage 1** (`node:22-slim`) installs and builds.
  - **Stage 2** (`distroless/nodejs22`) copies only what is needed to run.
  - The images are pushed to Docker Hub as `kumar3472/questly-frontend` and `kumar3472/questly-backend`.
- **No secrets in the images:** `.env` is never copied in.
  - The frontend writes `public/__ENV.js` from its environment when the container starts.
  - The backend reads `process.env`.
- **Part B, running locally:** `docker-compose.yml` starts 9 containers on the `qnet` network: the app, Redis, and the monitoring tools. The last box lists the `localhost` addresses.

**Related:** [Docker guides](../README.md#1-docker)

---

## 3. Kubernetes architecture

![Kubernetes architecture](03-kubernetes-architecture.svg)

**What it shows:** the kind cluster `questly` on the agent EC2: its two
nodes, the two namespaces, and everything in them.

**Read it like this:**

- **kind runs Kubernetes inside Docker:** each node is a Docker container on the agent.
- **Namespace `questly-ns`:**
  - the frontend and backend Deployments;
  - their NodePort Services, on 30080 and 30081;
  - the two secrets built from the `.env` files.
- **Namespace `monitoring`:**
  - Prometheus, Grafana, Loki and Alloy;
  - node-exporter on every node.
- **One request, step by step (right-hand column):**
  load balancer → agent port 30080 → Docker → control-plane node → kube-proxy → Service → pod.

**Related:** [kind and kubectl commands](../02-kubernetes/01-kind-kubectl-commands.md)

---

## 4. Cloud architecture

![Cloud architecture](04-cloud-architecture.svg)

**What it shows:** everything Terraform creates on AWS, and what you add by
hand.

**Read it like this:**

- **Network layout:** one VPC across two availability zones.
  - **Public subnets** hold the load balancer, the NAT gateway and the master.
  - **The private subnet** holds the agent, which has no public IP.
- **Users** reach the app through the load balancer over HTTPS, using the GoDaddy CNAME and the ACM certificate.
- **You** reach the master over SSH and Jenkins (port 8080) from your own IP only.
- **The agent** reaches the internet only outward, through the NAT gateway.
- **The right-hand panels:** IAM, the SSH key pair, and all 20 security group rules, including GitHub's webhook ranges.

**Related:** [Terraform resource inventory](../03-terraform-aws/02-questly-terraform-resource-inventory-and-creation-flow.md),
[Custom domain and HTTPS](../03-terraform-aws/05-custom-domain-and-https.md)

---

## 5. CI/CD pipeline architecture

![CI/CD pipeline architecture](05-cicd-pipeline-architecture.svg)

**What it shows:** what happens from `git push` to a running app.

**Read it like this:**

1. **Push to `main`:** GitHub sends a webhook to Jenkins on the master. GitHub's addresses are allowed by `webhook_cidrs`.
2. **Hand-off:** the master gives the build to the agent `questly-agent` over SSH.
3. **The agent runs the `Jenkinsfile`:**
   - checks out the code;
   - runs `k8s/deploy.sh` (8 steps): the cluster, secrets from the `.env` files, the app, monitoring.
4. **Email:** Jenkins sends "Build Success" or "Build Failed" through Gmail.

**What the pipeline does not do:** it does not build images. New images are built and pushed to Docker Hub from the laptop, and the pipeline pulls `:latest`.

**Related:** [Jenkins guides](../README.md#4-jenkins-cicd)

---

## 6. Monitoring architecture

![Monitoring architecture](06-monitoring-architecture.svg)

**What it shows:** how logs and metrics are collected in the cluster, and
how you open Grafana and Prometheus.

**Read it like this:**

- **Logs:** Alloy reads every pod's output and pushes it to Loki.
- **Metrics:** Prometheus scrapes every 15 seconds:
  - node-exporter on each node, for machine metrics;
  - each kubelet's cAdvisor, for container metrics.
- **Grafana** reads both, through its Prometheus and Loki data sources.
- **Opening them:** neither is public. You open them through an SSH tunnel via the master (`terraform output -raw monitoring_tunnel`).
- **Not collected:** app-level metrics. The app has no `/metrics` endpoint, so its logs in Loki are the main signal.

**Related:** [After Terraform apply, section 5](../03-terraform-aws/04-after-terraform-apply.md#5-grafana-and-prometheus-optional)

---

## How the six fit together

```
1 Application    what the code does: browser, Next.js, Express, Supabase, Gemini
      │ packaged as
2 Containers     two Docker images on Docker Hub
      │ run in
3 Kubernetes     the kind cluster on the agent, with the monitoring stack
      │ hosted on
4 Cloud          AWS: VPC, load balancer, master and agent, HTTPS
      │ updated by
5 CI/CD          git push → Jenkins master → agent → deploy.sh
      │ watched by
6 Monitoring     Prometheus, Loki, Alloy and Grafana in the cluster
```
