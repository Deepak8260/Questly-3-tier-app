# Questly: A 3-Tier Next.js Application with End-to-End DevOps on AWS

**An AI quiz platform (Next.js, Express, Supabase), containerized with Docker, run on Kubernetes, provisioned on AWS with Terraform, and deployed by a Jenkins CI/CD pipeline on every push.**

<img src="data/assets/questly-hero.png" alt="Questly: AI quiz platform. Next.js, Express and Supabase, deployed with Docker, Kubernetes, Terraform, AWS and Jenkins." width="100%">

<br>

**[Architecture](#architecture)** &nbsp;·&nbsp;
**[Tech stack](#tech-stack)** &nbsp;·&nbsp;
**[Deploy it yourself](#deploy-it-yourself)** &nbsp;·&nbsp;
**[How a deployment works](#how-a-deployment-works)** &nbsp;·&nbsp;
**[Documentation](data/README.md)**

<br>

| 🧩 3-tier app | 🐳 Containers | ☸️ Kubernetes | ☁️ Infrastructure as code | 🔁 CI/CD |
|---|---|---|---|---|
| Next.js · Express · Supabase, with Gemini for AI | Two-stage, distroless images; settings read at start-up | kind cluster with the app and a full monitoring stack | 52 AWS resources from Terraform, HTTPS on a custom domain | `git push` → Jenkins → live, with an email for every build |

---

## Contents

- [What the project does](#what-the-project-does)
- [Architecture](#architecture)
  - [1. Application](#1-application) · [2. Containers](#2-containers) · [3. Kubernetes](#3-kubernetes) · [4. Cloud](#4-cloud) · [5. CI/CD pipeline](#5-cicd-pipeline) · [6. Monitoring](#6-monitoring)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Deploy it yourself](#deploy-it-yourself)
- [How a deployment works](#how-a-deployment-works)
- [Who can reach what](#who-can-reach-what)
- [Documentation](#documentation)

---

## What the project does

Questly generates quizzes with Google Gemini and stores users and results
in Supabase. The project's focus is the DevOps around it:

| Part | What was done |
|---|---|
| Docker | Small multi-stage images for the frontend and backend, with settings read at run time instead of build time |
| Kubernetes | A kind cluster on one EC2 server, with the app and a monitoring stack |
| Terraform | The whole AWS setup as code: VPC, subnets, NAT gateway, load balancer, HTTPS certificate, two EC2 servers |
| Jenkins | A master that receives GitHub webhooks and an agent that deploys, with email on every result |
| HTTPS | A custom domain from GoDaddy, an ACM certificate, and HTTP redirected to HTTPS |

## Architecture

Six diagrams, from the inside out. Each is explained in
[data/00-architecture](data/00-architecture/README.md).

### 1. Application

The three tiers: the browser, the Next.js frontend, the Express backend,
Supabase and Gemini, and which keys each one uses.

![Application architecture](data/00-architecture/01-application-architecture.svg)

### 2. Containers

How the two-stage Dockerfiles build small images, and how Docker Compose
runs the whole stack on a laptop.

![Container architecture](data/00-architecture/02-container-architecture.svg)

### 3. Kubernetes

The kind cluster on the agent: two nodes, the `questly-ns` and
`monitoring` namespaces, and the path of one request to a pod.

![Kubernetes architecture](data/00-architecture/03-kubernetes-architecture.svg)

### 4. Cloud

Everything Terraform creates on AWS: VPC, subnets, NAT gateway, load
balancer, certificate, the two servers and their firewall rules.

![Cloud architecture](data/00-architecture/04-cloud-architecture.svg)

### 5. CI/CD pipeline

From `git push` through the GitHub webhook, the Jenkins master and agent,
and `k8s/deploy.sh`, to the result email.

![CI/CD pipeline architecture](data/00-architecture/05-cicd-pipeline-architecture.svg)

### 6. Monitoring

How Alloy, Loki, Prometheus and Grafana collect logs and metrics, and how
to open them through an SSH tunnel.

![Monitoring architecture](data/00-architecture/06-monitoring-architecture.svg)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript |
| Database and auth | Supabase (Postgres) |
| AI | Google Gemini API |
| Containers | Docker, Docker Hub |
| Orchestration | kind (Kubernetes in Docker), kubectl |
| Infrastructure as code | Terraform, AWS provider 6.x, state in S3 |
| Cloud | AWS: VPC, EC2, ALB, ACM, NAT gateway, IAM, Session Manager |
| DNS | GoDaddy |
| CI/CD | Jenkins (master and agent), GitHub webhook, Gmail notifications |
| Monitoring | Prometheus, Grafana, Loki, Alloy, node-exporter |

## Repository structure

```
Questly-3-tier-app/
├── frontend/              Next.js app, Dockerfile, .env.example
├── backend/               Express API, Dockerfile, .env.example
├── database/supabase/     Supabase migrations and functions
├── k8s/                   kind config, app manifests, monitoring, deploy.sh
├── terraform/             All AWS infrastructure, server boot scripts
├── data/                  Step-by-step documentation and architecture diagrams (start here)
├── Jenkinsfile            The deployment pipeline
├── docker-compose.yml     Run the whole stack locally with Docker
└── kind-setup.sh          Install Docker, kind and kubectl on a server by hand
```

## Deploy it yourself

Follow these guides in order. Each one says what must be done before it,
and links to the next.

| Step | What you do | Guide |
|---|---|---|
| 1 | Install Terraform and the AWS CLI | [Install Terraform and AWS CLI](data/03-terraform-aws/01-install-terraform-aws-cli.md) |
| 2 | Create the certificate, run `terraform apply`, and set the DNS records at GoDaddy | [Custom domain and HTTPS](data/03-terraform-aws/05-custom-domain-and-https.md), Part 4 |
| 3 | Check both servers | [After Terraform apply](data/03-terraform-aws/04-after-terraform-apply.md) |
| 4 | Connect the Jenkins master and agent | [Jenkins 1](data/04-jenkins/01-connect-master-and-agent.md) |
| 5 | Add the credentials and email settings | [Jenkins 2](data/04-jenkins/02-credentials-and-email.md) |
| 6 | Clone the repo on the agent and create the `.env` files | [Jenkins 3](data/04-jenkins/03-agent-workspace-and-env-files.md) |
| 7 | Create the pipeline, run the first build, add the GitHub webhook | [Jenkins 4](data/04-jenkins/04-pipeline-job-and-webhook.md) |
| 8 | Test the site over HTTPS | [Custom domain and HTTPS](data/03-terraform-aws/05-custom-domain-and-https.md), sections 3.9 and 3.11 |

**What you need:** an AWS account, a domain at GoDaddy (or another DNS
provider), a Supabase project, a Gemini API key, a GitHub account and a
Gmail account.

**Cost:** the NAT gateway, the load balancer and two `t3.medium` servers
are charged by the hour. Destroy everything when you stop:
[After Terraform apply → Destroy](data/03-terraform-aws/04-after-terraform-apply.md#destroy-when-you-are-done).

## How a deployment works

1. You push to `main`. GitHub sends a webhook to Jenkins on the master.
2. Jenkins hands the build to the agent over SSH.
3. The agent checks out the code and runs `k8s/deploy.sh`.
4. `deploy.sh` creates the kind cluster if needed, turns the `.env` files
   into Kubernetes secrets, and restarts the frontend and backend with the
   latest images from Docker Hub.
5. The load balancer sends visitors to the new pods once they are healthy.
6. Jenkins emails you "Build Success" or "Build Failed".

Details: [Jenkins 4: How the complete flow works](data/04-jenkins/04-pipeline-job-and-webhook.md#how-the-complete-flow-works).

## Who can reach what

Every server sits behind a firewall (an AWS security group). Only the
traffic below is allowed in; everything else is blocked.

| Target | Port | Allowed from | Set in `terraform.tfvars` |
|---|---|---|---|
| Load balancer | 80, 443 | Anyone (port 80 only redirects to HTTPS) | `app_ingress_cidrs` |
| Master: SSH | 22 | Your IP only | `admin_cidrs` |
| Master: Jenkins | 8080 | Your IP | `admin_cidrs` |
| Master: Jenkins | 8080 | GitHub's 7 webhook IP ranges, so a push can start a build | `webhook_cidrs` |
| Agent: app | 30080, 30081 | The load balancer only | — |
| Agent: SSH, Grafana, Prometheus | 22, 30030, 30090 | The master only | — |

The agent has no public IP. Details and how to find GitHub's webhook IPs:

- [SSH into the master and agent](data/03-terraform-aws/03-ssh-into-servers.md): keeping `admin_cidrs` up to date
- [Jenkins 4, step 7](data/04-jenkins/04-pipeline-job-and-webhook.md#step-7-make-sure-github-can-reach-jenkins): why GitHub must reach Jenkins, finding its IPs at `api.github.com/meta`, and how the rules are made
- [Terraform resource inventory](data/03-terraform-aws/02-questly-terraform-resource-inventory-and-creation-flow.md): all 20 firewall rules, one by one

## Documentation

Everything is explained step by step in [`data/`](data/README.md):

- [Architecture](data/00-architecture/README.md): the six diagrams above, each explained
- [Docker](data/README.md#1-docker): Dockerfiles, runtime config, image size optimization
- [Kubernetes](data/README.md#2-kubernetes): kind cluster and kubectl commands
- [Terraform / AWS](data/README.md#3-terraform--aws): infrastructure, SSH, server checks, custom domain and HTTPS
- [Jenkins CI/CD](data/README.md#4-jenkins-cicd): master-agent setup, credentials, email, `.env` files, pipeline and webhook
