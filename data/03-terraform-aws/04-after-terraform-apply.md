# After Terraform Apply: Check the Servers

What to check once `terraform apply` has finished, before setting up
Jenkins. It also covers monitoring, day-to-day tasks and tearing
everything down.

## The whole setup, in order

| Order | Step | Guide |
|---|---|---|
| 1 | Install Terraform and the AWS CLI | [01-install-terraform-aws-cli.md](01-install-terraform-aws-cli.md) |
| 2 | Create the certificate, check its record in **GoDaddy**, run the full `terraform apply`, and point the `questly` record in **GoDaddy** at the new load balancer | [05-custom-domain-and-https.md](05-custom-domain-and-https.md), Part 4, steps 1 to 6 |
| 3 | Check the servers | **This guide**, sections 1 to 3 |
| 4 | Connect the Jenkins master and agent | [Jenkins 1](../04-jenkins/01-connect-master-and-agent.md) |
| 5 | Add the credentials and email settings | [Jenkins 2](../04-jenkins/02-credentials-and-email.md) |
| 6 | Clone the repo on the agent and create the `.env` files | [Jenkins 3](../04-jenkins/03-agent-workspace-and-env-files.md) |
| 7 | Create the pipeline, run the first build, add the GitHub webhook | [Jenkins 4](../04-jenkins/04-pipeline-job-and-webhook.md) |
| 8 | Test the site over HTTPS | [05-custom-domain-and-https.md](05-custom-domain-and-https.md), sections 3.9 and 3.11 |

The domain `kumardevops.online` is registered at **GoDaddy**, and its DNS
is managed there, not in AWS. Terraform does not create any DNS record.

## Contents

1. [What Terraform created](#what-terraform-created)
2. [1. Save the Terraform outputs](#1-save-the-terraform-outputs)
3. [2. Check the master](#2-check-the-master)
4. [3. Check the agent](#3-check-the-agent)
5. [4. Next: set up Jenkins](#4-next-set-up-jenkins)
6. [5. Grafana and Prometheus (optional)](#5-grafana-and-prometheus-optional)
7. [6. Session Manager instead of SSH (optional)](#6-session-manager-instead-of-ssh-optional)
8. [Day-to-day](#day-to-day)
9. [Destroy when you are done](#destroy-when-you-are-done)

---

## What Terraform created

```
Internet
   │
   ▼
┌──────────────── PUBLIC subnets ─────────────────────────┐
│  Load balancer (80 → redirect, 443)   master (Jenkins)  │
└────┬────────────────────────────────────┬───────────────┘
     │ /      → frontend                  │ SSH only
     │ /api/* → backend                   ▼
┌────▼──────────── PRIVATE subnet ────────────────────────┐
│  agent: kind cluster (frontend, backend,                │
│         Grafana, Prometheus). No public IP.             │
└─────────────────────────────────────────────────────────┘
```

| Server | Reach it | Installed by its boot script |
|---|---|---|
| **master** | Public IP. SSH and Jenkins from your IP; Jenkins also from GitHub's webhook ranges. | Java 21, Jenkins |
| **agent** | No public IP. Only through the master. | Java 21, Docker, Docker Compose, kind, kubectl |

The full diagram is the [cloud architecture](../00-architecture/04-cloud-architecture.svg). All six architecture diagrams are in [00-architecture](../00-architecture/README.md).

---

## 1. Save the Terraform outputs

**Status: compulsory.** **Where:** PowerShell, in the project root.

```powershell
$MASTER  = terraform -chdir=terraform output -raw master_public_ip
$AGENT   = terraform -chdir=terraform output -raw agent_private_ip
$APP_URL = terraform -chdir=terraform output -raw next_public_api_base_url
$ALB_DNS = terraform -chdir=terraform output -raw alb_dns_name

"Master  : $MASTER"
"Agent   : $AGENT"
"App URL : $APP_URL"
"ALB DNS : $ALB_DNS"
"Jenkins : http://${MASTER}:8080"
```

| Variable | Example | Used for |
|---|---|---|
| `$MASTER` | `13.233.x.x` | SSH to the master, the Jenkins page, the GitHub webhook URL |
| `$AGENT` | `10.0.10.x` | SSH to the agent, the Host of the Jenkins node |
| `$APP_URL` | `https://questly.kumardevops.online` | `NEXT_PUBLIC_API_BASE_URL`, opening the app |
| `$ALB_DNS` | `questly-dev-alb-194847080.ap-south-1.elb.amazonaws.com` | The `questly` CNAME record in GoDaddy |

Keep this window open. If you open a new one, run these lines again.

## 2. Check the master

**Status: compulsory.** Wait about 3 minutes after apply, then:

```powershell
ssh ubuntu@$MASTER
```

Type `yes` the first time it asks about the host key. On the master:

```bash
cloud-init status --wait        # waits until the boot script is done
systemctl is-active jenkins     # must print: active
exit
```

| Problem | Fix |
|---|---|
| `Connection timed out` | Your public IP changed. Update `admin_cidrs` in `terraform.tfvars` and apply again. See [03-ssh-into-servers.md](03-ssh-into-servers.md). |
| `Permission denied (publickey)` | Add `-i` with the private key that matches `ssh_public_key_path`. |
| Jenkins is not active | Read `sudo tail -50 /var/log/cloud-init-output.log`. |

## 3. Check the agent

**Status: compulsory.** The agent is private, so SSH jumps through the
master with `-J`:

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

On the agent:

```bash
cloud-init status --wait
docker ps                       # must work without sudo
kind version
kubectl version --client
java -version
exit
```

If `docker ps` says permission denied, log out and SSH in again.

## 4. Next: set up Jenkins

**Status: compulsory.** Follow the four Jenkins guides in order:

| Guide | What you do |
|---|---|
| [01-connect-master-and-agent.md](../04-jenkins/01-connect-master-and-agent.md) | Unlock Jenkins, check the plugins, create the agent's workspace folder, create an SSH key on the master and allow it on the agent, register and launch the `questly-agent` node |
| [02-credentials-and-email.md](../04-jenkins/02-credentials-and-email.md) | GitHub token, Gmail App Password, Extended E-mail Notification |
| [03-agent-workspace-and-env-files.md](../04-jenkins/03-agent-workspace-and-env-files.md) | Clone the repo into the Jenkins workspace, create `backend/.env` and `frontend/.env`, check the GoDaddy records |
| [04-pipeline-job-and-webhook.md](../04-jenkins/04-pipeline-job-and-webhook.md) | Create the `questly` job, run the first build, open the app, add the GitHub webhook |

---

## 5. Grafana and Prometheus (optional)

**Status: optional (production recommended).** Available after the first
Jenkins build.

They are not public. Open a tunnel through the master and leave the
window open:

```powershell
terraform -chdir=terraform output -raw monitoring_tunnel
```

Copy the command it prints and run it. Then open:

- Grafana: <http://localhost:30030> (user `admin`)
- Prometheus: <http://localhost:30090>

Get the Grafana password:

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT "kubectl get secret grafana-admin -n monitoring -o jsonpath='{.data.GF_SECURITY_ADMIN_PASSWORD}' | base64 -d"
```

Press `Ctrl+C` in the tunnel window to close it.

## 6. Session Manager instead of SSH (optional)

**Status: optional (production recommended).**

Both servers can be opened from the AWS Console without SSH, which helps
when your IP has changed: **EC2 → Instances → select the instance →
Connect → Session Manager → Connect**.

Session Manager logs in as `ssm-user`. Switch to the normal user with
`sudo su - ubuntu`.

---

## Day-to-day

| Task | How |
|---|---|
| Deploy new code | Build and push new `:latest` images to Docker Hub, then push to `main` (the webhook starts a build) or click **Build with Parameters**. |
| Change an env value | On the agent, edit `~/pipeline-workspace/workspace/questly/backend/.env` or `frontend/.env`, then run the Jenkins job. |
| Your public IP changed | Update `admin_cidrs` in `terraform.tfvars` and apply. |
| GitHub changed its webhook addresses | Update `webhook_cidrs` from `api.github.com/meta` and apply ([Jenkins 4](../04-jenkins/04-pipeline-job-and-webhook.md), step 7). |
| See the pods | On the agent: `kubectl get pods -A` |
| See backend logs | On the agent: `kubectl logs deploy/backend -n questly-ns` |

## Destroy when you are done

**Status: compulsory when you stop working.** The NAT gateway and the
load balancer cost money every hour. From the `terraform` folder:

```powershell
terraform plan -destroy -out=tfplan
terraform show tfplan
terraform apply tfplan
```

This deletes both servers, so Jenkins, its settings, the workspace, the
`.env` files on the agent and the cluster are all gone.

To build again, start from step 2 of [the whole setup](#the-whole-setup-in-order).
After the rebuild the master gets a new IP, so update the GitHub webhook
URL ([Jenkins 4](../04-jenkins/04-pipeline-job-and-webhook.md), "After a
rebuild").
