# Jenkins 4: Pipeline Job, First Build and GitHub Webhook

Create the pipeline job, run the first build by hand, then connect
GitHub so every `git push` to `main` deploys automatically and emails you
the result.

| | |
|---|---|
| **Before this guide** | [03-agent-workspace-and-env-files.md](03-agent-workspace-and-env-files.md): the repo and both `.env` files are in `~/pipeline-workspace/workspace/questly` on the agent. |
| **After this guide** | Test HTTPS: [05-custom-domain-and-https.md](../03-terraform-aws/05-custom-domain-and-https.md), sections 3.9 and 3.11 |
| **Time** | About 20 minutes, including a first build of about 10 minutes |

## Contents

1. [Step 1: Create the pipeline job](#step-1-create-the-pipeline-job)
2. [Step 2: General settings](#step-2-general-settings)
3. [Step 3: Trigger settings](#step-3-trigger-settings)
4. [Step 4: Pipeline settings](#step-4-pipeline-settings)
5. [Step 5: Run the first build by hand](#step-5-run-the-first-build-by-hand)
6. [Step 6: Open the app](#step-6-open-the-app)
7. [Step 7: Make sure GitHub can reach Jenkins](#step-7-make-sure-github-can-reach-jenkins)
   - [7.1 Why GitHub needs to reach Jenkins](#71-why-github-needs-to-reach-jenkins)
   - [7.2 Find GitHub's webhook addresses](#72-find-githubs-webhook-addresses)
   - [7.3 How the code allows them](#73-how-the-code-allows-them)
   - [7.4 Apply the rules](#74-apply-the-rules)
   - [7.5 Check the rules in AWS](#75-check-the-rules-in-aws)
   - [7.6 When GitHub changes its addresses](#76-when-github-changes-its-addresses)
8. [Step 8: Add the webhook in GitHub](#step-8-add-the-webhook-in-github)
9. [Step 9: Test an automatic build](#step-9-test-an-automatic-build)
10. [How the complete flow works](#how-the-complete-flow-works)
11. [What the Jenkinsfile does](#what-the-jenkinsfile-does)
12. [After a rebuild](#after-a-rebuild)
13. [Final verification checklist](#final-verification-checklist)
14. [Troubleshooting](#troubleshooting)

---

## Step 1: Create the pipeline job

**Where:** the Jenkins dashboard.

1. Click **New Item**.
2. Name: `questly`.
3. Select **Pipeline**. Click **OK**.

The name must be `questly`, because the agent's workspace folder from
[guide 3](03-agent-workspace-and-env-files.md) is
`~/pipeline-workspace/workspace/questly`. Jenkins builds in a folder
named after the job.

You are now on the job's configuration page. Fill in the sections below
from top to bottom, and click **Save** only at the end of step 4.

## Step 2: General settings

| Field | Value |
|---|---|
| Description | `Deploys Questly to the kind cluster on the agent` |

Leave the other options in this section unticked. In particular, do not
tick **This project is parameterized**. The `Jenkinsfile` declares its
own `BRANCH` parameter, and Jenkins adds it after the first build.

## Step 3: Trigger settings

In the **Triggers** section (called **Build Triggers** in older
Jenkins), tick:

**GitHub hook trigger for GITScm polling**

This connects the GitHub webhook to this job. When GitHub tells Jenkins
"someone pushed to this repo", Jenkins starts every job that has this
box ticked and uses the same repository. Without it the webhook arrives,
but nothing starts.

## Step 4: Pipeline settings

In the **Pipeline** section, change **Definition** from `Pipeline script`
to **Pipeline script from SCM**. Jenkins then reads the `Jenkinsfile`
from GitHub on every build, so any change you push to it is used next
time.

| Field | Value |
|---|---|
| SCM | Git |
| Repository URL | `https://github.com/Deepak8260/Questly-3-tier-app.git` |
| Credentials | `github-token` |
| Branch Specifier | `*/main` |
| Script Path | `Jenkinsfile` |
| Lightweight checkout | leave ticked |

**Script Path** is the file's path inside the repo. The `Jenkinsfile` is
in the repo's root folder, so it is just `Jenkinsfile`.

Click **Save**.

## Step 5: Run the first build by hand

**Where:** the job's page.

The first build must be started by hand. Jenkins only registers a
pipeline job for webhooks after it has run once and read the
`Jenkinsfile`.

1. Click **Build Now**.
2. Under **Build History** on the left, click `#1`, then **Console
   Output**.

The first build takes about 10 minutes, because it creates the kind
cluster and downloads every image. A good run shows these lines, in this
order:

```
Running on questly-agent in /home/ubuntu/pipeline-workspace/workspace/questly
[Pipeline] { (Checkout Source Code)
[Pipeline] { (Deploy to kind)
[3/8] Creating kind cluster...
Creating cluster "questly" ...
Generating backend secret from backend/.env...
Generating frontend secret from frontend/.env...
QUESTLY IS RUNNING
Finished: SUCCESS
```

| Line | What it proves |
|---|---|
| `Running on questly-agent in .../workspace/questly` | The build runs on the agent, in the folder that holds your `.env` files. |
| `Creating cluster "questly"` | The first build creates the cluster. Later builds print `Cluster 'questly' already exists.` after the `[3/8]` line instead. |
| `Generating ... secret from ....env` | The `.env` files were found and turned into Kubernetes secrets. |
| `QUESTLY IS RUNNING` | The frontend, backend and monitoring are deployed and ready. |

Then check your inbox for the email **"Questly CI/CD | Build Success #1"**.

After this build, the button changes from **Build Now** to **Build with
Parameters**, with a `BRANCH` field that defaults to `main`.

## Step 6: Open the app

Open <https://questly.kumardevops.online>.

- The load balancer needs about a minute after the pods start before its
  health checks pass. A `502` or `503` during that minute is normal.
- If the site does not open at all, the GoDaddy `questly` record points
  at an old load balancer ([guide 3](03-agent-workspace-and-env-files.md),
  step 5).

Check the backend through the load balancer. In PowerShell:

```powershell
curl.exe -s -X POST "https://questly.kumardevops.online/api/quiz/generate" -H "Content-Type: application/json" -d "{}"
```

Any JSON reply, even an error about missing fields, proves the request
reached the backend.

## Step 7: Make sure GitHub can reach Jenkins

**Where:** the browser and your laptop, in the `terraform` folder.

This step explains why GitHub is blocked by default, how to find
GitHub's addresses, how the code allows them, and how to check the
result. If you only want the commands, go to 7.4.

### 7.1 Why GitHub needs to reach Jenkins

**What a webhook is.** You want "push code to GitHub → Jenkins starts a
build by itself". For that, GitHub must tell Jenkins that someone
pushed. It does so by sending a small message over the internet to the
Jenkins address:

```
GitHub's servers  ──── "new push!" ────►  http://<master-ip>:8080/github-webhook/
```

That message is the **webhook**. It is sent by **GitHub's servers**, not
by your laptop.

**The firewall on the master.** The master has a firewall, its security
group `questly-dev-master-sg`. It works like a guest list at a door:
only addresses on the list get in. Before the webhook was added, the
list for port 8080 held only your own IP (`admin_cidrs`):

| Who knocks on port 8080 | Without `webhook_cidrs` | With `webhook_cidrs` |
|---|---|---|
| You, from your laptop | ✅ Allowed (`admin_cidrs`) | ✅ Allowed (`admin_cidrs`) |
| GitHub's servers | ❌ Blocked: Jenkins never hears about a push | ✅ **Allowed** (`webhook_cidrs`) |
| Anyone else on the internet | ❌ Blocked | ❌ Blocked |

Port 22 (SSH) is not affected. Only you can SSH in, as before.

**Why only GitHub's addresses.** There were three ways to make the
webhook work:

| Choice | What it means | Risk |
|---|---|---|
| **Allow GitHub's addresses** (used here) | Add only GitHub's webhook ranges to the list | Low: only you and GitHub can reach Jenkins |
| Open 8080 to everyone (`0.0.0.0/0`) | Let anyone in the world in | High: anyone can reach the Jenkins login page |
| No webhook | Change nothing; click **Build Now** for every deploy | None, but no automatic builds |

### 7.2 Find GitHub's webhook addresses

GitHub has no settings page for these addresses. It publishes them at
one web address.

1. Open **<https://api.github.com/meta>** in the browser.
2. The page is plain text in JSON format, with sections such as
   `"hooks"`, `"web"`, `"api"` and `"git"`.
3. Press `Ctrl+F` and search for **`"hooks"`**.
4. The list right after it is what you need. On 20 October 2026 it was:

   ```json
   "hooks": [
     "9.234.106.48/28",
     "9.234.98.160/28",
     "9.234.98.176/28",
     "192.30.252.0/22",
     "185.199.108.0/22",
     "140.82.112.0/20",
     "143.55.64.0/20",
     "2a0a:a440::/29",
     "2606:50c0::/32"
   ],
   ```

5. Use only the entries **with dots**. These 7 are IPv4 ranges:

| # | Entry | Type | Use it? |
|---|---|---|---|
| 1 | `9.234.106.48/28` | IPv4 | ✅ |
| 2 | `9.234.98.160/28` | IPv4 | ✅ |
| 3 | `9.234.98.176/28` | IPv4 | ✅ |
| 4 | `192.30.252.0/22` | IPv4 | ✅ |
| 5 | `185.199.108.0/22` | IPv4 | ✅ |
| 6 | `140.82.112.0/20` | IPv4 | ✅ |
| 7 | `143.55.64.0/20` | IPv4 | ✅ |
| 8 | `2a0a:a440::/29` | IPv6 (has colons) | ❌ |
| 9 | `2606:50c0::/32` | IPv6 (has colons) | ❌ |

**Why skip the two IPv6 entries.** The master has only an IPv4 address,
so GitHub can only reach it over IPv4. The rule is also written for
IPv4 addresses only (`cidr_ipv4`).

**What `/22` or `/28` means.** Each entry is a **range** of addresses,
not one address. For example, `140.82.112.0/20` means every address from
`140.82.112.0` to `140.82.127.255`. GitHub sends webhooks from many
servers, so it publishes ranges.

**Making the page easier to read:**

| Browser | What to do |
|---|---|
| Firefox | Shows the page as a tidy tree. Click **Filter JSON** and type `hooks`. |
| Chrome or Edge | Tick **Pretty-print** at the top of the page, if shown, then use `Ctrl+F`. |

**Why `"hooks"` and not the other sections:**

| Section | Addresses GitHub uses for |
|---|---|
| **`hooks`** | **Sending webhooks**: the one Jenkins must allow |
| `web` | The github.com website |
| `api` | GitHub's API |
| `git` | `git clone` and `git push` |
| `actions` | GitHub Actions runners |

GitHub explains this page in
[About GitHub's IP addresses](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses).

**The same list from PowerShell,** IPv4 only:

```powershell
(Invoke-RestMethod https://api.github.com/meta).hooks | Where-Object { $_ -notmatch ':' }
```

### 7.3 How the code allows them

Three files work together. In short: `variables.tf` creates an empty
list, `terraform.tfvars` fills it with GitHub's ranges, and
`security.tf` turns each range into a firewall rule.

**1. `terraform/variables.tf`: the list is declared.**

```hcl
variable "webhook_cidrs" {
  type = list(string)                          # a list of address ranges

  validation {
    condition     = alltrue([for c in var.webhook_cidrs : can(cidrhost(c, 0)) && c != "0.0.0.0/0"])
    error_message = "webhook_cidrs must be valid CIDRs and must not contain 0.0.0.0/0."
  }
}
```

This only says that a list called `webhook_cidrs` exists. The
`validation` block is a safety lock. If anyone ever puts `0.0.0.0/0`
("everyone") or a mistyped range in it, Terraform refuses to run.
`admin_cidrs` has the same lock.

**2. `terraform/terraform.tfvars`: the values.**

```hcl
webhook_cidrs = [
  "9.234.106.48/28",
  "9.234.98.160/28",
  "9.234.98.176/28",
  "192.30.252.0/22",
  "185.199.108.0/22",
  "140.82.112.0/20",
  "143.55.64.0/20",
]
```

The 7 IPv4 ranges from 7.2, next to `admin_cidrs`.
`terraform.tfvars.example` has the same lines.

**3. `terraform/security.tf`: one firewall rule per range.**

```hcl
resource "aws_vpc_security_group_ingress_rule" "master_jenkins_webhook" {
  for_each = toset(var.webhook_cidrs)          # go through the 7 ranges

  security_group_id = aws_security_group.master.id   # on the master's firewall
  description       = "GitHub webhook to Jenkins"
  cidr_ipv4         = each.value               # allow this one range
  ip_protocol       = "tcp"
  from_port         = var.jenkins_port         # on port 8080 only
  to_port           = var.jenkins_port
}
```

It is a copy of the existing `master_jenkins` rule, with one difference:
it reads `webhook_cidrs` instead of `admin_cidrs`. `for_each` means "make
one rule for each item in the list". The list has 7 ranges, so Terraform
creates **7 rules**, all for port 8080 only.

### 7.4 Apply the rules

From the `terraform` folder:

```powershell
terraform plan -out=tfplan
```

| Plan says | Meaning | Next |
|---|---|---|
| `Plan: 7 to add, 0 to change, 0 to destroy.` | The 7 rules are not in AWS yet. All 7 lines are `master_jenkins_webhook`. | `terraform apply tfplan` |
| `No changes.` | The rules already exist. | Go to step 8. |
| Anything to change or destroy | Something else differs. | Stop and read the plan before applying. |

```powershell
terraform apply tfplan
```

Adding these rules does not touch the servers, Jenkins or the app.

### 7.5 Check the rules in AWS

Use any one of these.

**Terraform**, from the `terraform` folder:

```powershell
terraform state list | Select-String master_jenkins_webhook
```

It must print 7 lines, such as
`aws_vpc_security_group_ingress_rule.master_jenkins_webhook["140.82.112.0/20"]`.
No output means the apply has not been run.

**AWS CLI:**

```powershell
$SG = aws ec2 describe-security-groups --region ap-south-1 --filters "Name=group-name,Values=questly-dev-master-sg" --query "SecurityGroups[0].GroupId" --output text
aws ec2 describe-security-group-rules --region ap-south-1 --filters "Name=group-id,Values=$SG" --query "SecurityGroupRules[?!IsEgress].[FromPort,CidrIpv4,Description]" --output table
```

| Port | Address | Description |
|---|---|---|
| 22 | your IP | SSH from admin |
| 8080 | your IP | Jenkins UI from admin |
| 8080 | each of the 7 GitHub ranges | GitHub webhook to Jenkins |

**AWS Console:**

1. **EC2 → Instances** → select `questly-dev-master`.
2. **Security** tab → click the security group `questly-dev-master-sg`.
3. Open **Inbound rules**. The 7 rows with port **8080** and the
   description **GitHub webhook to Jenkins** are GitHub's ranges.

### 7.6 When GitHub changes its addresses

GitHub changes this list rarely. If the webhook starts failing one day:

1. Compare <https://api.github.com/meta> (`"hooks"`, IPv4 only) with
   `webhook_cidrs` in `terraform.tfvars`.
2. If they differ, update `webhook_cidrs`, and update
   `terraform.tfvars.example` to match.
3. Run `terraform plan -out=tfplan` and `terraform apply tfplan`. The
   plan adds rules for new ranges and removes rules for old ones.

## Step 8: Add the webhook in GitHub

**Where:** GitHub, in the browser.

1. Get the master's address. In PowerShell, from the project root:
   ```powershell
   $MASTER = terraform -chdir=terraform output -raw master_public_ip
   "http://${MASTER}:8080/github-webhook/"
   ```
2. Open the repo on GitHub → **Settings → Webhooks → Add webhook**.
3. Fill in:

| Field | Value |
|---|---|
| Payload URL | `http://<master-ip>:8080/github-webhook/`, from item 1 |
| Content type | `application/json` |
| Secret | leave empty |
| Which events | **Just the push event** |
| Active | ticked |

4. Click **Add webhook**.

The Payload URL must end with `/github-webhook/`, **including the last
`/`**. Without it, Jenkins answers with a redirect and the webhook
fails.

GitHub sends a test message, called a **ping**, straight away. Open the
webhook → **Recent Deliveries**. A green tick and `Response 200` mean
Jenkins received it.

## Step 9: Test an automatic build

**Where:** your laptop.

Make a small change, such as a word in a comment in the `Jenkinsfile`
or a guide, then:

```powershell
git add .
git commit -m "Test the Jenkins webhook"
git push origin main
```

Within a few seconds a new build appears in the job's **Build History**.
Its console starts with:

```
Started by GitHub push by Deepak8260
```

When it finishes you get the success or failure email.

---

## How the complete flow works

Once everything is set up, this happens on every `git push` to `main`:

1. **GitHub** receives the push and sends a webhook to
   `http://<master-ip>:8080/github-webhook/`.
2. **The master's security group** lets it in, because GitHub's address
   is in `webhook_cidrs`.
3. **Jenkins on the master** finds the job `questly`, whose trigger is
   ticked and whose repository matches.
4. **Jenkins** reads the `Jenkinsfile` from GitHub. It asks for the label
   `questly-agent`, so Jenkins hands the build to the agent over SSH.
5. **The agent** checks out the latest code into
   `~/pipeline-workspace/workspace/questly`. The `.env` files stay.
6. **The agent** runs `k8s/deploy.sh`:
   - creates the kind cluster if it does not exist,
   - turns `backend/.env` and `frontend/.env` into Kubernetes secrets,
   - applies the frontend and backend, and restarts them so they pull
     the newest `:latest` images from Docker Hub,
   - deploys Prometheus, Loki, Alloy and Grafana.
7. **The load balancer** sends visitors to the new pods once their
   health checks pass.
8. **Jenkins** emails the result: "Build Success" or "Build Failed".
9. **The master** never builds or runs anything itself. It only
   receives the webhook and coordinates the agent.

## What the Jenkinsfile does

The `Jenkinsfile` in the repo's root folder defines the whole pipeline:

| Part | What it does |
|---|---|
| `agent { label 'questly-agent' }` | Runs every stage on the agent, never on the master |
| `parameters { BRANCH }` | Which branch to deploy. Defaults to `main`. Webhook builds use the default. |
| `options` | Adds timestamps to the log, stops two builds running at once, and cancels a build after 20 minutes |
| Stage **Checkout Source Code** | Checks out the chosen branch with the `github-token` credential |
| Stage **Deploy to kind** | Runs `bash k8s/deploy.sh`, which does the actual deployment |
| `post { success }` | Sends the HTML "Build Success" email |
| `post { failure }` | Sends the HTML "Build Failed" email with a link to the console |
| `post { always }` | Prints the pods with `kubectl -n questly-ns get pods` |

The pipeline does **not** build Docker images. It deploys the
`:latest` images already on Docker Hub. To ship new code, build and push
new images first, then let the pipeline deploy them.

Changing the `Jenkinsfile` works like any other change: commit and push,
and the webhook starts a build with the new version.

## After a rebuild

`terraform destroy` and `apply` give you new servers. Jenkins, its
settings and the workspace are gone, and the master usually gets a **new
public IP**.

1. Repeat guides 1 to 3, then steps 1 to 6 here.
2. In GitHub → **Settings → Webhooks**, edit the webhook and put the new
   master IP in the Payload URL.
3. Check the GoDaddy `questly` record ([guide 3](03-agent-workspace-and-env-files.md), step 5).

---

## Final verification checklist

| What to check | Where |
|---|---|
| Agent is online | Manage Jenkins → Nodes → `questly-agent` has no red cross |
| `agent-ssh-key` exists | Manage Jenkins → Credentials → Global |
| `github-token` exists | Manage Jenkins → Credentials → Global |
| `gmail-smtp` exists | Manage Jenkins → Credentials → Global |
| Only the four SMTP fields are filled in | Manage Jenkins → System → Extended E-mail Notification |
| System Admin e-mail address is set | Manage Jenkins → System → Jenkins Location |
| `.env` files are in the workspace | Agent: `ls ~/pipeline-workspace/workspace/questly/{backend,frontend}/.env` |
| Job `questly` exists | Jenkins dashboard |
| Webhook trigger is ticked | Job → Configure → Triggers → GitHub hook trigger for GITScm polling |
| Job reads the `Jenkinsfile` from GitHub | Job → Configure → Pipeline → Definition is **Pipeline script from SCM** |
| First build passed | Job → `#1` → Console Output ends with `Finished: SUCCESS` |
| Build ran on the agent | Console Output: `Running on questly-agent` |
| GitHub's ranges are allowed | 7 `master_jenkins_webhook` rules exist (7.5), and `webhook_cidrs` matches the `"hooks"` IPv4 list at `api.github.com/meta` (7.2) |
| Webhook works | GitHub → Settings → Webhooks → Recent Deliveries: green tick, `200` |
| A push starts a build | Console Output: `Started by GitHub push` |
| Success email arrives | Your inbox, after a passing build |
| Failure email arrives | **Build with Parameters** with `BRANCH` set to `no-such-branch`. The checkout fails, and the "Build Failed" email arrives. Nothing is deployed. |
| App opens over HTTPS | <https://questly.kumardevops.online> |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build waits: "There are no nodes with the label `questly-agent`" or "offline" | The agent is not connected. | Manage Jenkins → Nodes → `questly-agent` → **Log**. See [guide 1](01-connect-master-and-agent.md), troubleshooting. |
| Console: `Running on questly-agent in .../workspace/<other name>` | The job name is not `questly`. | Rename the job to `questly`, or rename the folder on the agent to match. |
| Console: `backend/.env not found and secret ... does not exist` | The `.env` files are missing from the workspace. | [Guide 3](03-agent-workspace-and-env-files.md). |
| Console: `CredentialId "github-token" could not be found` | The credential ID is misspelled. | [Guide 2](02-credentials-and-email.md), step 2. |
| Build stops after 20 minutes with `Timeout has been exceeded` | The first build downloads many images, and the network is slow. | Run **Build with Parameters** again. The cluster and images from the first try are reused, so the second run is faster. |
| Webhook shows a red cross: `failed to connect to host` or `timed out` | GitHub's address is not allowed in the security group, or the rules were never applied. | Check the rules exist (7.5). Compare `webhook_cidrs` with `api.github.com/meta` (7.2, 7.6), then apply (7.4). |
| Webhook shows `302` | The Payload URL has no `/` at the end. | Use `http://<master-ip>:8080/github-webhook/`. |
| Webhook shows `404` | The GitHub plugin is not installed. | [Guide 1](01-connect-master-and-agent.md), step 2. |
| Webhook is green but no build starts | The trigger box is not ticked, or the job has never run. | Tick **GitHub hook trigger for GITScm polling** (step 3) and run one build by hand (step 5). |
| Webhook worked before a rebuild, now fails | The master has a new IP. | Update the Payload URL ("After a rebuild"). |
| Build passes but the site shows old content | Docker Hub still has the old `:latest` images. | Build and push new images, then run the job again. |
| `502` or `503` on the site | The pods are not ready, or health checks have not passed yet. | Agent: `kubectl get pods -n questly-ns`. Wait a minute after they are `Running`. |
| No email | See [guide 2](02-credentials-and-email.md), troubleshooting. | |
