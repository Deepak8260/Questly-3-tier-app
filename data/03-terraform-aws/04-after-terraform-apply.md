# After Terraform Apply: Deploy Questly

What to do once `terraform apply` has finished, from two empty EC2
instances to the Questly app running behind the load balancer on
`https://questly.kumardevops.online`.

## Where this guide fits

| Order | Step | Guide |
|---|---|---|
| 1 | Install Terraform and the AWS CLI | [01-install-terraform-aws-cli.md](01-install-terraform-aws-cli.md) |
| 2 | Create the certificate, check its record in **GoDaddy**, run the full `terraform apply`, and point the `questly` record in **GoDaddy** at the new load balancer | [05-custom-domain-and-https.md](05-custom-domain-and-https.md), Part 4, steps 1 to 6 |
| 3 | Set up Jenkins, the repo, the `.env` files, and deploy | **This guide** |
| 4 | Test the site over HTTPS | [05-custom-domain-and-https.md](05-custom-domain-and-https.md), sections 3.9 and 3.11 |

The domain `kumardevops.online` is registered at **GoDaddy**, and its DNS
is managed there, not in AWS. Terraform does not create any DNS record.
Section 8.4 lists the two records you add by hand.

Every section is marked:

- **Compulsory**: you must do it, or the next steps will not work.
- **Optional (production recommended)**: everything works without it.

| # | Section | Where you run it | Status |
|---|---|---|---|
| 1 | Save the Terraform outputs | Laptop | Compulsory |
| 2 | Check the master | Laptop → master | Compulsory |
| 3 | Check the agent | Laptop → agent | Compulsory |
| 4 | Unlock Jenkins | Browser | Compulsory |
| 5 | Add Jenkins credentials | Browser | Compulsory |
| 6 | Connect the agent to Jenkins | Browser | Compulsory |
| 7 | Clone the repo into the Jenkins workspace | Agent | Compulsory |
| 8 | Create the `.env` files | Agent | Compulsory |
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

- **master**: has a public IP. Runs Jenkins.
- **agent**: has no public IP. You reach it only through the master.
  Jenkins runs the pipeline here, and the app runs here.

---

# Compulsory

## 1. Save the Terraform outputs

In PowerShell, from the project root. Keep this window open; the
variables are used in the next sections.

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
| `$MASTER` | `13.233.x.x` | SSH to the master, the Jenkins page |
| `$AGENT` | `10.0.10.x` | SSH to the agent, the Jenkins node's Host |
| `$APP_URL` | `https://questly.kumardevops.online` | `NEXT_PUBLIC_API_BASE_URL` in section 8, opening the app |
| `$ALB_DNS` | `questly-dev-alb-194847080.ap-south-1.elb.amazonaws.com` | The `questly` CNAME in GoDaddy (section 8.4) |

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

## 4. Unlock Jenkins

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

## 5. Add Jenkins credentials

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

## 6. Connect the agent to Jenkins

Go to **Manage Jenkins → Nodes → New Node**.

1. Node name: `flask-builder`. Choose **Permanent Agent**. Click **Create**.
2. Fill in:

| Field | Value |
|---|---|
| Number of executors | `1` |
| Remote root directory | `/home/ubuntu/pipeline-workspace` |
| Labels | `flask-builder` |
| Launch method | Launch agents via SSH |
| Host | the **Agent** IP from section 1 |
| Credentials | `agent-ssh-key` |
| Host Key Verification Strategy | Non verifying Verification Strategy |

3. Click **Save**, open the node, and check the log. It must end with
   `Agent successfully connected and online`.

The label must be `flask-builder`, because the Jenkinsfile asks for
`agent { label 'flask-builder' }`.

**Do not create the pipeline yet.** First put the code and the `.env`
files on the agent (sections 7 and 8).

## 7. Clone the repo into the Jenkins workspace

**Why this comes before the pipeline**

Jenkins runs every build inside one folder on the agent, called the
**workspace**. Its path is built from two names you choose:

```
<Remote root directory>/workspace/<pipeline name>
/home/ubuntu/pipeline-workspace/workspace/questly
        (section 6)                    (section 9)
```

The `.env` files hold passwords and keys, so they are not in git, and
Jenkins can never download them. They have to be placed in the workspace
by hand, once. Cloning the repo there first gives you the `frontend` and
`backend` folders to put them in.

On every build, `k8s/deploy.sh` looks for `backend/.env` and
`frontend/.env` in the workspace. When it finds them, it creates the
Kubernetes secrets from them by itself. So you never have to create
secrets by hand.

Jenkins later reuses this folder. Its checkout updates the code and
leaves the `.env` files alone, because git ignores them.

**On the agent:**

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

```bash
mkdir -p ~/pipeline-workspace/workspace
cd ~/pipeline-workspace/workspace
git clone https://github.com/Deepak8260/Questly-3-tier-app.git questly
cd questly
ls
```

`ls` must show `backend`, `frontend`, `k8s`, `Jenkinsfile` and the other
project files.

| Part | Why |
|---|---|
| `mkdir -p ~/pipeline-workspace/workspace` | Creates the folder Jenkins uses for workspaces. `-p` does nothing if it already exists. |
| `git clone ... questly` | The last word names the folder. It **must** be `questly`, the same as the pipeline name in section 9. Without it the folder would be called `Questly-3-tier-app` and Jenkins would not find your `.env` files. |

Stay in this folder for section 8.

## 8. Create the `.env` files

Still on the agent, in `~/pipeline-workspace/workspace/questly`.

### 8.1 Create the two files from the templates

The repo contains a template for each file, `.env.example`. Copy them
and fill in the values:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env

nano backend/.env
nano frontend/.env
```

In `nano`: change the values, press `Ctrl+O` then `Enter` to save, and
`Ctrl+X` to exit. The values to use are in 8.2 and 8.3.

**Alternative: copy the files from your laptop.** From the project root
in PowerShell:

```powershell
scp -o "ProxyJump=ubuntu@$MASTER" backend\.env  "ubuntu@${AGENT}:pipeline-workspace/workspace/questly/backend/.env"
scp -o "ProxyJump=ubuntu@$MASTER" frontend\.env "ubuntu@${AGENT}:pipeline-workspace/workspace/questly/frontend/.env"
```

Then on the agent, remove the Windows line endings, which would corrupt
the values on Linux, and set the API address from 8.3. On your laptop the
file says `localhost`, which only works on your laptop.

```bash
sed -i 's/\r$//' backend/.env frontend/.env
sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online|' frontend/.env
```

### 8.2 `backend/.env`

```
PORT=3001
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
GEMINI_API_KEY=<Gemini API key>
```

| Key | What it is | Where to get it | Changes between laptop and AWS? |
|---|---|---|---|
| `PORT` | Port the backend listens on inside its container | Always `3001` | No |
| `SUPABASE_URL` | Address of your Supabase project | Supabase dashboard → Project Settings → API → **Project URL** | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access key for the database. **Secret: backend only, never in the frontend.** | Same page → **service_role** key | No |
| `GEMINI_API_KEY` | Key for generating quizzes | Google AI Studio → **Get API key** | No |

If your own file also has `SUPABASE_ANON_KEY`, you can leave it in. The
backend code does not read it.

### 8.3 `frontend/.env`

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online
```

| Key | What it is | Where to get it | Changes between laptop and AWS? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Address of your Supabase project | Same **Project URL** as the backend | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for logging in from the browser. Safe to expose. | Supabase dashboard → Project Settings → API → **anon public** key | No |
| `NEXT_PUBLIC_API_BASE_URL` | The address the **browser** uses to call the backend | See the table below | **Yes** |

**`NEXT_PUBLIC_API_BASE_URL` is the only value that changes.** The
browser sends quiz requests to `<this value>/api/quiz/generate`, and the
load balancer sends `/api/*` to the backend. So it must be an address the
browser can open, without `/api` at the end.

| Where the app runs | Value | Example |
|---|---|---|
| Your laptop (`npm run dev` or Docker) | `http://localhost:3001` | `http://localhost:3001` |
| AWS, HTTP-only code, before the domain is set up | `http://` + the load balancer DNS name | `http://questly-dev-alb-194847080.ap-south-1.elb.amazonaws.com` |
| AWS, HTTP-only code, after the GoDaddy `questly` record exists | `http://` + your domain | `http://questly.kumardevops.online` |
| **AWS, current code (HTTPS)** | `https://` + your domain, the same as `$APP_URL` in section 1 | `https://questly.kumardevops.online` |

The two HTTP rows are for the older HTTP-only Terraform code
([05-custom-domain-and-https.md](05-custom-domain-and-https.md), section
0 and Parts 1 to 2). **With the current code, use the HTTPS domain from
the start**, because:

- **The `http://` load balancer link no longer serves the app.** Port 80
  only redirects to `https://<load balancer name>`.
- **That `https://` address fails too.** The certificate is for
  `questly.kumardevops.online`, not for the load balancer's name, so the
  browser refuses it with `ERR_CERT_COMMON_NAME_INVALID`.
- **An `http://` value fails on an `https://` page.** The browser blocks
  it as "Mixed Content".

Rules for the value:

| Rule | Wrong | Right |
|---|---|---|
| No `/` at the end | `https://questly.kumardevops.online/` | `https://questly.kumardevops.online` |
| No path | `https://questly.kumardevops.online/api` | `https://questly.kumardevops.online` |
| No port | `...amazonaws.com:30081` | `https://questly.kumardevops.online` |
| Not the agent's private IP | `http://10.0.10.x` | `https://questly.kumardevops.online` |

### 8.4 The DNS records in GoDaddy

The app's address only works if both of these exist in **GoDaddy → My
Products → `kumardevops.online` → DNS**. Terraform creates neither.

| Record | Type | Name | Value | When to change it | How |
|---|---|---|---|---|---|
| App address | `CNAME` | `questly` | `$ALB_DNS` from section 1, without `http://` | **After every rebuild**, because the load balancer gets a new name | [05](05-custom-domain-and-https.md), section 2.2, or Part 4 step 6 |
| Certificate check | `CNAME` | the `name` from `terraform output acm_validation_record` | the `value` from the same output | Once. Check it after a rebuild; it is normally unchanged. | [05](05-custom-domain-and-https.md), section 3.6, or Part 4 step 3 |

Check the app record from your laptop:

```powershell
nslookup questly.kumardevops.online 8.8.8.8
```

The answer must show `$ALB_DNS`.

### 8.5 Check the files

On the agent, in `~/pipeline-workspace/workspace/questly`:

```bash
grep -c '=' backend/.env frontend/.env
grep NEXT_PUBLIC_API_BASE_URL frontend/.env
git status --short
```

| Line | Must show |
|---|---|
| 1 | `backend/.env:4` (or more) and `frontend/.env:3` |
| 2 | `NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online` |
| 3 | Nothing. Git ignores both `.env` files, so they can never be committed by mistake. |

```bash
exit
```

## 9. Create and run the pipeline

1. **New Item** → name `questly` → **Pipeline** → **OK**.
   The name must match the folder from section 7.
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
4. Open the build and click **Console Output**. A good first run shows,
   in this order:
   - `Building remotely on flask-builder ... in workspace /home/ubuntu/pipeline-workspace/workspace/questly`
   - `Creating kind cluster ...` (only on the first build; takes a few minutes)
   - `Generating backend secret from backend/.env...`
   - `Generating frontend secret from frontend/.env...`
   - `QUESTLY IS RUNNING`

The first build learns the `BRANCH` parameter. After that the button is
called **Build with Parameters**.

| Problem | Fix |
|---|---|
| Build waits for an executor | The agent is offline. Check section 6. |
| The workspace path in the first line is not `.../workspace/questly` | The pipeline name differs from the folder name. Rename the folder on the agent to the pipeline's name, or recreate the pipeline as `questly`. |
| `backend/.env not found and secret 'questly-backend-secrets' does not exist` | Section 8 was skipped, or the files are in a different folder. |
| `CredentialId "github-token" could not be found` | The ID in section 5 is misspelled. |
| `emailext` step fails | Install the Email Extension plugin (section 4). |

## 10. Open the app

Open the **App URL** from section 1, `https://questly.kumardevops.online`,
in your browser.

- The load balancer needs about a minute after the pods start before its
  health checks pass. A `502` or `503` during that minute is normal.
- If the site does not open at all, the GoDaddy `questly` record still
  points at an old load balancer (section 8.4).
- If login sends you to `localhost`, open the Supabase dashboard →
  **Authentication → URL Configuration** and add the App URL as the Site
  URL and as a Redirect URL.

Check the backend through the load balancer:

```powershell
curl.exe -s -X POST "$APP_URL/api/quiz/generate" -H "Content-Type: application/json" -d "{}"
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

This deletes both instances, so Jenkins, the workspace, the `.env` files
on the agent and the cluster are all gone. After the next
`terraform apply`, repeat this guide from section 1.

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
| Change an env value | On the agent: edit `~/pipeline-workspace/workspace/questly/frontend/.env` or `backend/.env`, then run the Jenkins job again. `deploy.sh` rebuilds the secrets and restarts the pods. |
| After a rebuild | Update the GoDaddy `questly` record (section 8.4), then repeat this guide from section 1. |
| See the pods | On the agent: `kubectl get pods -A` |
| See backend logs | On the agent: `kubectl logs deploy/backend -n questly-ns` |
