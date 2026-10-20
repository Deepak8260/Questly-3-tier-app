# Questly – Documentation

Notes on how Questly (a 3-tier app: Next.js frontend, backend API, database) was
containerized, run on Kubernetes and deployed to AWS with Terraform.

The folders are numbered in the order the project was built, and the files
inside each folder are numbered in the order to read them.

```
data/
├── 01-docker/          Dockerfiles, runtime config, image size
├── 02-kubernetes/      kind cluster and kubectl commands
└── 03-terraform-aws/   AWS infrastructure, SSH, deployment, domain and HTTPS
```

## Where to start

| If you want to... | Go to |
|---|---|
| Understand how the images are built | [1. Docker](#1-docker) |
| Run the app on a local cluster | [2. Kubernetes](#2-kubernetes) |
| Create the AWS infrastructure and deploy | [3. Terraform / AWS](#3-terraform--aws) |
| Put the app on your own domain with HTTPS | [Custom domain and HTTPS](03-terraform-aws/05-custom-domain-and-https.md) |

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

Follow these in order. Each guide assumes the ones before it are done.

| # | Guide | What it covers |
|---|---|---|
| 1 | [Install Terraform and AWS CLI](03-terraform-aws/01-install-terraform-aws-cli.md) | Setting up Terraform and the AWS CLI on Windows. |
| 2 | [Terraform resource inventory and creation flow](03-terraform-aws/02-questly-terraform-resource-inventory-and-creation-flow.md) | Every AWS resource the code creates, the order Terraform creates them in, and each one explained step by step. |
| 3 | [SSH into the master and agent](03-terraform-aws/03-ssh-into-servers.md) | Connecting to the servers and what decides whether SSH works. |
| 4 | [After Terraform apply](03-terraform-aws/04-after-terraform-apply.md) | Jenkins setup, cloning the repo on the agent, every frontend and backend `.env` value, and deploying. |
| 5 | [Custom domain and HTTPS](03-terraform-aws/05-custom-domain-and-https.md) | The GoDaddy DNS records, the ACM certificate, the HTTP-to-HTTPS redirect, and the short checklist for every rebuild. |

## 4. Jenkins CI/CD

Not written yet. The pipeline itself is in [Jenkinsfile](../Jenkinsfile).

## 5. Monitoring

Not written yet. The configuration is in [prometheus.yml](../prometheus.yml),
[loki-config.yml](../loki-config.yml) and [alloy-config.alloy](../alloy-config.alloy).
