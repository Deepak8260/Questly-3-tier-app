# Jenkins 3: Prepare the Agent Workspace and the `.env` Files

Clone the repo into the folder Jenkins builds in, and create the
frontend and backend `.env` files there. Do this **before** creating the
pipeline job.

| | |
|---|---|
| **Before this guide** | [02-credentials-and-email.md](02-credentials-and-email.md) |
| **After this guide** | [04-pipeline-job-and-webhook.md](04-pipeline-job-and-webhook.md) |
| **Time** | About 10 minutes, if you have your Supabase and Gemini keys ready |

## Contents

1. [Why this comes before the pipeline](#why-this-comes-before-the-pipeline)
2. [Step 1: Clone the repo into the Jenkins workspace](#step-1-clone-the-repo-into-the-jenkins-workspace)
3. [Step 2: Create the two `.env` files](#step-2-create-the-two-env-files)
4. [Step 3: Fill in `backend/.env`](#step-3-fill-in-backendenv)
5. [Step 4: Fill in `frontend/.env`](#step-4-fill-in-frontendenv)
6. [Step 5: Check the GoDaddy DNS records](#step-5-check-the-godaddy-dns-records)
7. [Step 6: Check the files](#step-6-check-the-files)
8. [Changing a value later](#changing-a-value-later)
9. [Troubleshooting](#troubleshooting)

---

## Why this comes before the pipeline

Jenkins runs every build of a job inside one folder on the agent, called
the job's **workspace**:

```
<Remote root directory>/workspace/<job name>
/home/ubuntu/pipeline-workspace/workspace/questly
        (guide 1, step 6)               (guide 4, step 1)
```

The `.env` files hold the Supabase and Gemini keys. They are git-ignored,
so they are not in the repo and Jenkins can never download them. They
must be placed in the workspace by hand, once.

Cloning the repo into the workspace first gives you the `frontend` and
`backend` folders to put them in. After that:

- **Every build:** `k8s/deploy.sh` finds `backend/.env` and
  `frontend/.env` in the workspace and turns them into the Kubernetes
  secrets `questly-backend-secrets` and `questly-frontend-secrets`. You
  never create secrets by hand.
- **Jenkins's own checkout:** it updates the code in this folder and
  leaves the `.env` files alone, because git ignores them.

## Step 1: Clone the repo into the Jenkins workspace

**Where:** an SSH session on the agent.

```powershell
$MASTER = terraform -chdir=terraform output -raw master_public_ip
$AGENT  = terraform -chdir=terraform output -raw agent_private_ip
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

On the agent:

```bash
mkdir -p ~/pipeline-workspace/workspace
cd ~/pipeline-workspace/workspace
git clone https://github.com/Deepak8260/Questly-3-tier-app.git questly
cd questly
ls
```

`ls` must show `backend`, `frontend`, `k8s`, `Jenkinsfile` and the
other project files.

| Part | Why |
|---|---|
| `mkdir -p ~/pipeline-workspace/workspace` | Creates the folder where Jenkins keeps job workspaces. `-p` does nothing if it already exists. |
| `git clone ... questly` | The last word names the folder. It **must** be `questly`, the same as the job name in guide 4. Without it the folder would be called `Questly-3-tier-app`, and Jenkins would build in a different, empty folder with no `.env` files. |

Stay in `~/pipeline-workspace/workspace/questly` for the next steps.

## Step 2: Create the two `.env` files

**Where:** the agent, in `~/pipeline-workspace/workspace/questly`.

The repo has a template for each file, called `.env.example`. Copy both
and open them:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env

nano backend/.env
nano frontend/.env
```

In `nano`, change the values from steps 3 and 4. Press `Ctrl+O` then
`Enter` to save, and `Ctrl+X` to exit.

**Alternative: copy the files from your laptop.** In PowerShell, from
the project root:

```powershell
scp -o "ProxyJump=ubuntu@$MASTER" backend\.env  "ubuntu@${AGENT}:pipeline-workspace/workspace/questly/backend/.env"
scp -o "ProxyJump=ubuntu@$MASTER" frontend\.env "ubuntu@${AGENT}:pipeline-workspace/workspace/questly/frontend/.env"
```

Then, on the agent, remove the Windows line endings and set the API
address. Windows line endings would corrupt the values on Linux. On your
laptop the address is `localhost`, which only works on your laptop.

```bash
sed -i 's/\r$//' backend/.env frontend/.env
sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online|' frontend/.env
```

## Step 3: Fill in `backend/.env`

```
PORT=3001
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
GEMINI_API_KEY=<Gemini API key>
```

| Key | What it is | Where to get it | Different on AWS than on the laptop? |
|---|---|---|---|
| `PORT` | Port the backend listens on inside its container | Always `3001` | No |
| `SUPABASE_URL` | Address of your Supabase project | Supabase dashboard → **Project Settings → API** → Project URL | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access database key. **Secret: backend only, never in the frontend.** | Same page → `service_role` key | No |
| `GEMINI_API_KEY` | Key for generating quizzes | Google AI Studio → **Get API key** | No |

If your own file also has `SUPABASE_ANON_KEY`, you can leave it. The
backend code does not read it.

## Step 4: Fill in `frontend/.env`

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online
```

| Key | What it is | Where to get it | Different on AWS than on the laptop? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Address of your Supabase project | The same Project URL as the backend | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key the browser uses to log in. Safe to expose. | Supabase dashboard → **Project Settings → API** → `anon` `public` key | No |
| `NEXT_PUBLIC_API_BASE_URL` | The address the **browser** uses to call the backend | The table below | **Yes** |

### `NEXT_PUBLIC_API_BASE_URL`: the only value that changes

The browser sends quiz requests to `<this value>/api/quiz/generate`. The
load balancer sends every `/api/*` request to the backend. So the value
must be an address the browser can open, without `/api` at the end.

| Where the app runs | Value | Example |
|---|---|---|
| Your laptop (`npm run dev` or Docker) | `http://localhost:3001` | `http://localhost:3001` |
| AWS, HTTP-only code, before the domain is set up | `http://` + the load balancer's DNS name | `http://questly-dev-alb-194847080.ap-south-1.elb.amazonaws.com` |
| AWS, HTTP-only code, after the GoDaddy `questly` record exists | `http://` + your domain | `http://questly.kumardevops.online` |
| **AWS, current code (HTTPS)** | `https://` + your domain. The same as `terraform output -raw next_public_api_base_url`. | `https://questly.kumardevops.online` |

The two HTTP rows belong to the older HTTP-only Terraform code
([05-custom-domain-and-https.md](../03-terraform-aws/05-custom-domain-and-https.md),
section 0, then Parts 1 and 2). **With the current code, use the HTTPS
domain from the start**, because:

- **The `http://` load balancer link no longer serves the app.** Port 80
  only redirects to `https://<load balancer name>`.
- **That `https://` address fails as well.** The certificate is for
  `questly.kumardevops.online`, not for the load balancer's name, so the
  browser shows `ERR_CERT_COMMON_NAME_INVALID`.
- **An `http://` value fails on an `https://` page.** The browser blocks
  the call as "Mixed Content".

Rules for the value:

| Rule | Wrong | Right |
|---|---|---|
| No `/` at the end | `https://questly.kumardevops.online/` | `https://questly.kumardevops.online` |
| No path | `https://questly.kumardevops.online/api` | `https://questly.kumardevops.online` |
| No port | `...amazonaws.com:30081` | `https://questly.kumardevops.online` |
| Not the agent's private IP | `http://10.0.10.x` | `https://questly.kumardevops.online` |

## Step 5: Check the GoDaddy DNS records

**Where:** GoDaddy, in the browser.

The domain `kumardevops.online` is registered at **GoDaddy**, and its DNS
is managed there, not in AWS. Terraform does not create any DNS record.
The HTTPS address only works if both of these exist in **GoDaddy → My
Products → `kumardevops.online` → DNS**:

| Record | Type | Name | Value | When it changes | How |
|---|---|---|---|---|---|
| App address | `CNAME` | `questly` | `terraform output -raw alb_dns_name`, without `http://` | **After every rebuild**, because the load balancer gets a new name | [05](../03-terraform-aws/05-custom-domain-and-https.md), section 2.2, or Part 4 step 6 |
| Certificate check | `CNAME` | the `name` from `terraform output acm_validation_record` | the `value` from the same output | Once. Check it after a rebuild; it is normally unchanged. | [05](../03-terraform-aws/05-custom-domain-and-https.md), section 3.6, or Part 4 step 3 |

Check the app record from your laptop:

```powershell
nslookup questly.kumardevops.online 8.8.8.8
```

The answer must show the load balancer's name.

## Step 6: Check the files

**Where:** the agent, in `~/pipeline-workspace/workspace/questly`.

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

**Next:** [04-pipeline-job-and-webhook.md](04-pipeline-job-and-webhook.md)

---

## Changing a value later

1. On the agent, edit the file in the workspace:
   ```bash
   nano ~/pipeline-workspace/workspace/questly/frontend/.env
   ```
2. Run the Jenkins job again. `k8s/deploy.sh` rebuilds both secrets from
   the files and restarts the pods.

Change the value only in the copy on the agent. Your laptop's `.env`
files stay as they are, so the app still runs locally.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: `backend/.env not found and secret 'questly-backend-secrets' does not exist` | The `.env` files are not in the folder Jenkins builds in. | The first line of the build's console shows the workspace path. It must be `.../workspace/questly`, and the files must be in its `backend` and `frontend` folders. |
| Quiz generation fails with "Mixed Content" in the browser console (`F12`) | `NEXT_PUBLIC_API_BASE_URL` starts with `http://`. | Use `https://questly.kumardevops.online` (step 4), then run the job again. |
| `ERR_CERT_COMMON_NAME_INVALID` in the console | The value is `https://` plus the load balancer's name. | Use your domain, not the load balancer's name (step 4). |
| Login works locally but fails on AWS | Supabase does not know the AWS address. | Supabase dashboard → **Authentication → URL Configuration**: add `https://questly.kumardevops.online` as the Site URL and as a Redirect URL. |
| Values look right but contain strange characters | Windows line endings from a copied file. | `sed -i 's/\r$//' backend/.env frontend/.env`, then run the job again. |
| `git clone` asks for a username | The repo is private. | Use `https://<token>@github.com/Deepak8260/Questly-3-tier-app.git` with the token from [guide 2](02-credentials-and-email.md). |
