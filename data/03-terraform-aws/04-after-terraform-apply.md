# After Terraform Apply: Deploy Questly

What to do once `terraform apply` has finished, from two empty EC2
instances to the Questly app running behind the load balancer.

Before this guide: [install-terraform-aws-cli.md](install-terraform-aws-cli.md).

Every section is marked:

- **Compulsory**: you must do it, or the next steps will not work.
- **Optional (production recommended)**: everything works without it.

| # | Section | Where you run it | Status |
|---|---|---|---|
| 1 | Save the Terraform outputs | Laptop | Compulsory |
| 2 | Check the master | Laptop → master | Compulsory |
| 3 | Check the agent | Laptop → agent | Compulsory |
| 4 | Copy the `.env` files to the agent | Laptop | Compulsory |
| 5 | Create the cluster and secrets | Agent | Compulsory |
| 6 | Unlock Jenkins | Browser | Compulsory |
| 7 | Add Jenkins credentials | Browser | Compulsory |
| 8 | Connect the agent to Jenkins | Browser | Compulsory |
| 9 | Create and run the pipeline | Browser | Compulsory |
| 10 | Open the app | Browser | Compulsory |
| 11 | Destroy when you are done | Laptop | Compulsory |
| 12 | Email notifications | Browser | Optional (production recommended) |
| 13 | Grafana and Prometheus | Laptop | Optional (production recommended) |
| 14 | Session Manager instead of SSH | Laptop | Optional (production recommended) |

## What Terraform created

```
Internet
   │
   ▼
┌──────────────── PUBLIC subnets ─────────────────┐
│  Load balancer (port 80)     master (Jenkins)   │
└────┬────────────────────────────┬───────────────┘
     │ /      → frontend          │ SSH only
     │ /api/* → backend           ▼
┌────▼──────────── PRIVATE subnets ───────────────┐
│  agent: kind cluster (frontend, backend,        │
│         Grafana, Prometheus). No public IP.     │
└─────────────────────────────────────────────────┘
```

- **master**: has a public IP. Runs Jenkins.
- **agent**: has no public IP. You reach it only through the master.
  Jenkins runs the pipeline here, and the app runs here.

---

# Compulsory

## 1. Save the Terraform outputs

In PowerShell, from the project root. Keep this window open; the
variables are used in sections 2 to 4.

```powershell
$MASTER = terraform -chdir=terraform output -raw master_public_ip
$AGENT  = terraform -chdir=terraform output -raw agent_private_ip
$ALB    = terraform -chdir=terraform output -raw next_public_api_base_url

"Master : $MASTER"
"Agent  : $AGENT"
"App URL: $ALB"
"Jenkins: http://${MASTER}:8080"
```

If you open a new PowerShell window later, run these lines again.

## 2. Check the master

Wait about 3 minutes after apply, then:

```powershell
ssh ubuntu@$MASTER
```

Type `yes` the first time it asks about the host key. On the master:

```bash
cloud-init status --wait        # waits until the install script is done
systemctl is-active jenkins     # must print: active
exit
```

| Problem | Fix |
|---|---|
| `Connection timed out` | Your public IP changed. Update `admin_cidrs` in `terraform.tfvars` and apply again. |
| `Permission denied (publickey)` | Add `-i` with the private key that matches `ssh_public_key_path`. |
| Jenkins is not active | Read `sudo tail -50 /var/log/cloud-init-output.log`. |

## 3. Check the agent

The agent is private, so SSH jumps through the master with `-J`:

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

## 4. Copy the .env files to the agent

The `.env` files are not in git, so the agent does not have them.
From the project root on your laptop:

```powershell
scp -o "ProxyJump=ubuntu@$MASTER" backend\.env  "ubuntu@${AGENT}:/tmp/backend.env"
scp -o "ProxyJump=ubuntu@$MASTER" frontend\.env "ubuntu@${AGENT}:/tmp/frontend.env"
```

Then fix two things in the copies on the agent:

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT "sed -i 's/\r$//' /tmp/backend.env /tmp/frontend.env"
ssh -J ubuntu@$MASTER ubuntu@$AGENT "sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=$ALB|' /tmp/frontend.env"
ssh -J ubuntu@$MASTER ubuntu@$AGENT "grep NEXT_PUBLIC_API_BASE_URL /tmp/frontend.env"
```

| Line | Why |
|---|---|
| First | Removes Windows line endings, which would corrupt the secret values on Linux. |
| Second | Points the browser at the load balancer. On your laptop this value is `localhost`. |
| Third | Prints the result. It must show the App URL from section 1. |

## 5. Create the cluster and secrets

One time only. Jenkins cannot do this part, because it never has the
`.env` files. SSH into the agent:

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

On the agent:

```bash
git clone https://github.com/Deepak8260/Questly-3-tier-app.git
cd Questly-3-tier-app

kind create cluster --name questly --config k8s/kind-config.yml
kubectl get nodes

kubectl apply -f k8s/namespace.yml
kubectl create secret generic questly-backend-secrets  --from-env-file=/tmp/backend.env  -n questly-ns
kubectl create secret generic questly-frontend-secrets --from-env-file=/tmp/frontend.env -n questly-ns
kubectl get secrets -n questly-ns

rm /tmp/backend.env /tmp/frontend.env
exit
```

`kubectl get nodes` must show two nodes with status `Ready`. It can take
a minute.

## 6. Unlock Jenkins

1. Get the unlock password:
   ```powershell
   ssh ubuntu@$MASTER "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
   ```
2. Open the Jenkins URL from section 1 in your browser and paste it.
3. Click **Install suggested plugins** and wait.
4. Create your admin user, then **Save and Finish**.
5. Go to **Manage Jenkins → Plugins → Available plugins**, search for
   **Email Extension**, tick it and click **Install**. The Jenkinsfile
   uses `emailext`, so the pipeline needs this plugin.

## 7. Add Jenkins credentials

Go to **Manage Jenkins → Credentials → System → Global credentials →
Add Credentials**. Add these two.

**a) GitHub token**

| Field | Value |
|---|---|
| Kind | Username with password |
| Username | `Deepak8260` |
| Password | a GitHub personal access token with the `repo` scope |
| ID | `github-token` (must match exactly) |

Create the token at GitHub → Settings → Developer settings → Personal
access tokens → Tokens (classic).

**b) SSH key for the agent**

| Field | Value |
|---|---|
| Kind | SSH Username with private key |
| ID | `agent-ssh-key` |
| Username | `ubuntu` |
| Private Key | **Enter directly** → **Add** → paste the key |

Print the private key on your laptop and copy all of it, including the
`BEGIN` and `END` lines:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519
```

## 8. Connect the agent to Jenkins

Go to **Manage Jenkins → Nodes → New Node**.

1. Node name: `flask-builder`. Choose **Permanent Agent**. Click **Create**.
2. Fill in:

| Field | Value |
|---|---|
| Number of executors | `1` |
| Remote root directory | `/home/ubuntu/jenkins` |
| Labels | `flask-builder` |
| Launch method | Launch agents via SSH |
| Host | the **Agent** IP from section 1 |
| Credentials | `agent-ssh-key` |
| Host Key Verification Strategy | Non verifying Verification Strategy |

3. Click **Save**, open the node, and check the log. It must end with
   `Agent successfully connected and online`.

The label must be `flask-builder`, because the Jenkinsfile asks for
`agent { label 'flask-builder' }`.

## 9. Create and run the pipeline

1. **New Item** → name `questly-deploy` → **Pipeline** → **OK**.
2. In the **Pipeline** section:

| Field | Value |
|---|---|
| Definition | Pipeline script from SCM |
| SCM | Git |
| Repository URL | `https://github.com/Deepak8260/Questly-3-tier-app.git` |
| Credentials | `github-token` |
| Branch Specifier | `*/main` |
| Script Path | `Jenkinsfile` |

3. Click **Save**, then **Build Now**.
4. Open the build and click **Console Output**. A good run shows:
   - `Cluster 'questly' already exists.`
   - `Backend secret already exists in cluster - using it.`
   - `QUESTLY IS RUNNING`

The first build learns the `BRANCH` parameter. After that the button is
called **Build with Parameters**.

| Problem | Fix |
|---|---|
| Build waits for an executor | The agent is offline. Check section 8. |
| `secret ... does not exist` | Section 5 was skipped or failed. |
| `CredentialId "github-token" could not be found` | The ID in section 7 is misspelled. |
| `emailext` step fails | Install the Email Extension plugin (section 6). |

## 10. Open the app

Open the **App URL** from section 1 in your browser.

- The load balancer needs about a minute after the pods start before its
  health checks pass. A `502` or `503` during that minute is normal.
- If login sends you to `localhost`, open the Supabase dashboard →
  **Authentication → URL Configuration** and add the App URL as the Site
  URL and as a Redirect URL.

Check the backend through the load balancer:

```powershell
curl.exe -s -X POST "$ALB/api/quiz/generate" -H "Content-Type: application/json" -d "{}"
```

Any JSON reply, even an error about missing fields, proves the request
reached the backend.

## 11. Destroy when you are done

The NAT gateway and load balancer cost money every hour. From the
`terraform` folder:

```powershell
terraform plan -destroy -out=tfplan
terraform show tfplan
terraform apply tfplan
```

This deletes both instances, so Jenkins and the cluster are gone. After
the next `terraform apply`, repeat this guide from section 1.

---

# Optional (production recommended)

Everything above works without this part.

## 12. Email notifications

The pipeline sends a success or failure email. Without this setup the
build still passes; only the email is skipped.

1. Turn on 2-Step Verification on the Gmail account, then create an App
   Password at <https://myaccount.google.com/apppasswords>.
2. In Jenkins, add a credential: **Username with password**, username =
   the Gmail address, password = the App Password, ID = `gmail-smtp`.
3. Go to **Manage Jenkins → System → Extended E-mail Notification**:

| Field | Value |
|---|---|
| SMTP server | `smtp.gmail.com` |
| SMTP Port | `465` |
| Credentials | `gmail-smtp` |
| Use SSL | ticked |

4. In **Jenkins Location** on the same page, set **System Admin e-mail
   address** to the same Gmail address. Click **Save**.

## 13. Grafana and Prometheus

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

## 14. Session Manager instead of SSH

Both instances can be opened from the AWS Console without SSH, which
helps when your IP has changed: **EC2 → Instances → select the instance
→ Connect → Session Manager → Connect**.

Session Manager logs in as `ssm-user`. Switch to the normal user with
`sudo su - ubuntu`.

---

## Day-to-day

| Task | How |
|---|---|
| Deploy a new version | Push new `:latest` images to Docker Hub, then run the Jenkins job again. |
| Change an env value | On the agent: `kubectl delete secret <name> -n questly-ns`, recreate it as in section 5, run the job again. |
| See the pods | On the agent: `kubectl get pods -A` |
| See backend logs | On the agent: `kubectl logs deploy/backend -n questly-ns` |
