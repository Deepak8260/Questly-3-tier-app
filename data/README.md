# Questly – Documentation

Notes on how Questly (a 3-tier app: Next.js frontend, Express backend,
Supabase database) was containerized, run on Kubernetes, deployed to AWS
with Terraform, and automated with Jenkins.

The folders are numbered in the order the project was built, and the files
inside each folder are numbered in the order to read them.

```
data/
├── 01-docker/          Dockerfiles, runtime config, image size
├── 02-kubernetes/      kind cluster and kubectl commands
├── 03-terraform-aws/   AWS infrastructure, SSH, server checks, domain and HTTPS
└── 04-jenkins/         Master-agent setup, credentials, email, .env files, pipeline, webhook
```

## Where to start

| If you want to... | Go to |
|---|---|
| Deploy everything on AWS from scratch | [Full AWS setup, in order](#full-aws-setup-in-order) |
| Understand how the images are built | [1. Docker](#1-docker) |
| Run the app on a local cluster | [2. Kubernetes](#2-kubernetes) |
| Understand what Terraform creates | [Terraform resource inventory](03-terraform-aws/02-questly-terraform-resource-inventory-and-creation-flow.md) |
| Set up Jenkins on existing servers | [4. Jenkins CI/CD](#4-jenkins-cicd) |
| Find a frontend or backend `.env` value | [Jenkins 3: `.env` files](04-jenkins/03-agent-workspace-and-env-files.md) |
| Work with the domain at GoDaddy, or HTTPS | [Custom domain and HTTPS](03-terraform-aws/05-custom-domain-and-https.md) |

## Full AWS setup, in order

| Step | What you do | Guide |
|---|---|---|
| 1 | Install Terraform and the AWS CLI on your laptop | [Terraform 1](03-terraform-aws/01-install-terraform-aws-cli.md) |
| 2 | Create the certificate, check its GoDaddy record, run `terraform apply`, point the GoDaddy `questly` record at the load balancer | [Terraform 5](03-terraform-aws/05-custom-domain-and-https.md), Part 4, steps 1 to 6 |
| 3 | Check both servers | [Terraform 4](03-terraform-aws/04-after-terraform-apply.md), sections 1 to 3 |
| 4 | Connect the Jenkins master and agent | [Jenkins 1](04-jenkins/01-connect-master-and-agent.md) |
| 5 | Add the GitHub and Gmail credentials and the email settings | [Jenkins 2](04-jenkins/02-credentials-and-email.md) |
| 6 | Clone the repo on the agent and create the `.env` files | [Jenkins 3](04-jenkins/03-agent-workspace-and-env-files.md) |
| 7 | Create the pipeline, run the first build, add the GitHub webhook | [Jenkins 4](04-jenkins/04-pipeline-job-and-webhook.md) |
| 8 | Test the site over HTTPS | [Terraform 5](03-terraform-aws/05-custom-domain-and-https.md), sections 3.9 and 3.11 |

If SSH fails at any point, see [SSH into the master and agent](03-terraform-aws/03-ssh-into-servers.md).

## 1. Docker

| # | Guide | What it covers |
|---|---|---|
| 1 | [Dockerization flow](01-docker/01-dockerization-flow.md) | How the Dockerfiles changed from version 1 (copy everything, single stage) to the final version. |
| 2 | [Dockerfiles line by line](01-docker/02-dockerfiles-line-by-line.md) | Every line of each Dockerfile explained, version by version. |
| 3 | [Runtime config Q&A](01-docker/03-runtime-config-qa.md) | Moving environment variables from build time to runtime (`docker-entrypoint.js`, `__ENV.js`, `env.ts`), build args vs run command. |
| 4 | [Dockerizing any application](01-docker/04-dockerizing-any-application.md) | General method for writing a Dockerfile for any app, not only Questly. |
| 5 | [Image size optimization](01-docker/05-image-size-optimization.md) | Reducing the Next.js image from 1.7 GB to 311 MB. |

## 2. Kubernetes

| # | Guide | What it covers |
|---|---|---|
| 1 | [kind and kubectl commands](02-kubernetes/01-kind-kubectl-commands.md) | Command reference for the kind cluster: the cluster itself, nodes and the workloads running on it. |

## 3. Terraform / AWS

| # | Guide | What it covers |
|---|---|---|
| 1 | [Install Terraform and AWS CLI](03-terraform-aws/01-install-terraform-aws-cli.md) | Setting up Terraform and the AWS CLI on Windows. |
| 2 | [Terraform resource inventory and creation flow](03-terraform-aws/02-questly-terraform-resource-inventory-and-creation-flow.md) | Every AWS resource the code creates, the order Terraform creates them in, and each one explained step by step. |
| 3 | [SSH into the master and agent](03-terraform-aws/03-ssh-into-servers.md) | Connecting to the servers and what decides whether SSH works. |
| 4 | [After Terraform apply](03-terraform-aws/04-after-terraform-apply.md) | Checking both servers, the full setup order, monitoring, day-to-day tasks and destroying. |
| 5 | [Custom domain and HTTPS](03-terraform-aws/05-custom-domain-and-https.md) | The GoDaddy DNS records, the ACM certificate, the HTTP-to-HTTPS redirect, and the short checklist for every rebuild. |

The architecture diagram is [questly-aws-architecture.svg](03-terraform-aws/questly-aws-architecture.svg).

## 4. Jenkins CI/CD

Follow these in order. Each guide assumes the ones before it are done.

| # | Guide | What it covers |
|---|---|---|
| 1 | [Connect the master and agent](04-jenkins/01-connect-master-and-agent.md) | Unlock Jenkins, plugins, the agent's workspace folder, an SSH key from master to agent, registering and launching the `flask-builder` node. |
| 2 | [Credentials and email](04-jenkins/02-credentials-and-email.md) | GitHub token, Gmail App Password, Extended E-mail Notification, who receives the mails. |
| 3 | [Agent workspace and `.env` files](04-jenkins/03-agent-workspace-and-env-files.md) | Cloning the repo into the Jenkins workspace, every frontend and backend `.env` value, `NEXT_PUBLIC_API_BASE_URL` from laptop to HTTPS, the GoDaddy records. |
| 4 | [Pipeline job and webhook](04-jenkins/04-pipeline-job-and-webhook.md) | Creating the `questly` job, the first build, the GitHub webhook, how the full flow works, the verification checklist. |

The pipeline itself is in [Jenkinsfile](../Jenkinsfile).

## 5. Monitoring

Not written yet. On AWS, Prometheus, Loki, Alloy and Grafana run in the
kind cluster ([k8s/monitoring](../k8s/monitoring)); how to open them is in
[Terraform 4](03-terraform-aws/04-after-terraform-apply.md), section 5.
For Docker Compose, the configuration is in [prometheus.yml](../prometheus.yml),
[loki-config.yml](../loki-config.yml) and [alloy-config.alloy](../alloy-config.alloy).
