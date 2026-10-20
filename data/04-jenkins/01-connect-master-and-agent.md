# Jenkins 1: Connect the Master and the Agent

Set up Jenkins on the master and connect the agent to it, so every
pipeline build runs on the agent.

| | |
|---|---|
| **Before this guide** | `terraform apply` is done and both servers pass the checks in [04-after-terraform-apply.md](../03-terraform-aws/04-after-terraform-apply.md), sections 1 to 3. |
| **After this guide** | [02-credentials-and-email.md](02-credentials-and-email.md) |
| **Time** | About 20 minutes |

## Contents

1. [How the master and agent work together](#how-the-master-and-agent-work-together)
2. [What Terraform already did for you](#what-terraform-already-did-for-you)
3. [Step 1: Unlock Jenkins and finish the setup wizard](#step-1-unlock-jenkins-and-finish-the-setup-wizard)
4. [Step 2: Check the plugins](#step-2-check-the-plugins)
5. [Step 3: Create the workspace folder on the agent](#step-3-create-the-workspace-folder-on-the-agent)
6. [Step 4: Create an SSH key on the master](#step-4-create-an-ssh-key-on-the-master)
7. [Step 5: Allow the master's key on the agent](#step-5-allow-the-masters-key-on-the-agent)
8. [Step 6: Register the agent in Jenkins](#step-6-register-the-agent-in-jenkins)
9. [Step 7: Launch the agent and check the connection](#step-7-launch-the-agent-and-check-the-connection)
10. [Checklist](#checklist)
11. [Troubleshooting](#troubleshooting)

---

## How the master and agent work together

| Server | Name in AWS | Role | What is installed |
|---|---|---|---|
| Master | `questly-dev-master` | Runs Jenkins. Receives the GitHub webhook and hands each build to the agent. Never builds or deploys anything itself. | Java 21, Jenkins |
| Agent | `questly-dev-agent` | Does all the work: checks out the code, creates the kind cluster, deploys the app. The app also runs here. | Java 21, Docker, Docker Compose, kind, kubectl |

```
GitHub ──webhook──► Master (Jenkins, port 8080)
                        │  SSH, port 22, inside the VPC
                        ▼
                    Agent (label flask-builder)
                        ├── checks out the code
                        ├── runs k8s/deploy.sh
                        └── app runs in the kind cluster
```

The master reaches the agent over SSH. Jenkins logs in to the agent with
an SSH key, starts a small Java program there, and sends it the work.
That is why the agent needs Java but not Jenkins.

## What Terraform already did for you

If you have followed a guide that builds Jenkins by hand, some of its
steps are not needed here. Terraform and the boot scripts did them.

| Manual step in other guides | In this project |
|---|---|
| Launch two EC2 instances | Done by Terraform (`compute.tf`). Both are `t3.medium`. |
| Install Java and Jenkins on the master | Done at first boot by `terraform/scripts/master-userdata.sh` |
| Install Java and Docker on the agent | Done at first boot by `terraform/scripts/agent-userdata.sh`, which also installs kind and kubectl |
| Run `newgrp docker` on the agent | Not needed. The script adds `ubuntu` to the `docker` group; a new SSH login picks it up. |
| Open port 8080 on the master | Done by Terraform, for your IP (`admin_cidrs`) and for GitHub's webhook ranges (`webhook_cidrs`). Not open to everyone. See [Jenkins 4, step 7](04-pipeline-job-and-webhook.md#step-7-make-sure-github-can-reach-jenkins). |
| Open port 22 on the agent | Done by Terraform, from the master only. The agent has no public IP. |
| Open port 465 for Gmail | Not needed. Sending email is outgoing traffic, and the master may send anything out. |

Everything below is still needed.

---

## Step 1: Unlock Jenkins and finish the setup wizard

**Where:** your laptop and the browser.

1. Get the master's IP. In PowerShell, from the project root:
   ```powershell
   $MASTER = terraform -chdir=terraform output -raw master_public_ip
   "Jenkins: http://${MASTER}:8080"
   ```
2. Open that address in the browser. Jenkins asks for an
   **Administrator password**.
3. Get it from the master:
   ```powershell
   ssh ubuntu@$MASTER "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
   ```
4. Paste it into the browser and click **Continue**.
5. Click **Install suggested plugins** and wait until every plugin shows
   a green tick.
6. Create the first admin user: username, password, full name and email.
   Click **Save and Continue**.
7. **Instance Configuration:** leave the Jenkins URL as shown,
   `http://<master-ip>:8080/`. Click **Save and Finish**.
8. Click **Start using Jenkins**.

You are on the Jenkins dashboard. Keep this tab open; the rest of the
Jenkins guides happen here.

## Step 2: Check the plugins

**Where:** the browser.

Go to **Manage Jenkins → Plugins → Installed plugins** and search for
each of these. Install any that is missing from **Available plugins**.

| Plugin | Why the pipeline needs it |
|---|---|
| **Pipeline** | Runs the `Jenkinsfile` |
| **Git** | Checks out the repo |
| **GitHub** | Lets the GitHub webhook start a build |
| **SSH Build Agents** | Connects the master to the agent over SSH |
| **Email Extension** | The `Jenkinsfile` sends mail with `emailext` |
| **Pipeline: Declarative** | The `Jenkinsfile` is written in declarative syntax |

If you installed anything, tick **Restart Jenkins when installation is
complete** and log in again.

## Step 3: Create the workspace folder on the agent

**Where:** an SSH session on the agent.

Jenkins needs a folder on the agent where it keeps its files and runs
the builds. This is the agent's **Remote root directory**.

From your laptop, jump through the master to the agent:

```powershell
$AGENT = terraform -chdir=terraform output -raw agent_private_ip
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

On the agent:

```bash
mkdir -p ~/pipeline-workspace
cd ~/pipeline-workspace
pwd
```

`pwd` must print `/home/ubuntu/pipeline-workspace`. You enter this exact
path in step 6.

Keep this agent session open for step 5.

## Step 4: Create an SSH key on the master

**Where:** an SSH session on the master. Open a **second** PowerShell
window for it.

Jenkins needs its own SSH key to log in to the agent. Create it on the
master, so your personal key never has to be given to Jenkins.

```powershell
$MASTER = terraform -chdir=terraform output -raw master_public_ip
ssh ubuntu@$MASTER
```

On the master:

```bash
ssh-keygen -t ed25519 -C "jenkins-master"
```

Press `Enter` at every question, so the file is saved in the default
place and has no passphrase. If it asks `Overwrite (y/n)?`, answer `n`;
a key already exists and you can use it.

This creates two files:

| File | What it is | Where it goes |
|---|---|---|
| `~/.ssh/id_ed25519` | **Private key**. Proves the master's identity. | Pasted into a Jenkins credential in step 6. Never shared anywhere else. |
| `~/.ssh/id_ed25519.pub` | **Public key**. Safe to share. | Added to the agent in step 5. |

Print the public key and copy the whole line:

```bash
cat ~/.ssh/id_ed25519.pub
```

It starts with `ssh-ed25519` and ends with `jenkins-master`.

## Step 5: Allow the master's key on the agent

**Where:** the agent session from step 3.

Add the copied line to the list of keys the agent accepts:

```bash
echo 'PASTE-THE-MASTER-PUBLIC-KEY-LINE-HERE' >> ~/.ssh/authorized_keys
cat ~/.ssh/authorized_keys
```

`cat` must show **two** lines:

| Line | Whose key | Why it is there |
|---|---|---|
| 1 | Your laptop's key (`questly-dev-key`) | Added by AWS at first boot. It is how you log in. **Do not delete it**, or you lock yourself out. |
| 2 | The master's key, ending in `jenkins-master` | Lets Jenkins log in to the agent. |

Use `>>`, never `>`. A single `>` replaces the file and removes your own
key.

**Test it from the master.** In the master session from step 4:

```bash
ssh ubuntu@<agent-private-ip> hostname
```

Use the agent IP from step 3. Type `yes` the first time it asks about
the host key. It must print the agent's host name without asking for a
password. If it does, Jenkins will be able to connect too.

Close both SSH sessions with `exit`.

## Step 6: Register the agent in Jenkins

**Where:** the browser.

1. Go to **Manage Jenkins → Nodes → New Node**.
2. Node name: `flask-builder`. Select **Permanent Agent**. Click
   **Create**.
3. Fill in the form:

| Field | Value | Why |
|---|---|---|
| Description | `Builds and runs Questly: kind cluster with frontend and backend` | For you |
| Number of executors | `1` | One build at a time |
| Remote root directory | `/home/ubuntu/pipeline-workspace` | The folder from step 3 |
| Labels | `flask-builder` | The `Jenkinsfile` asks for `agent { label 'flask-builder' }`. Must match exactly. |
| Usage | Use this node as much as possible | |
| Launch method | Launch agents via SSH | |
| Host | The agent's **private** IP from step 3, such as `10.0.10.x` | The agent has no public IP. The master reaches it inside the VPC. |

4. Next to **Credentials**, click **Add → Jenkins** and fill in:

| Field | Value |
|---|---|
| Kind | SSH Username with private key |
| ID | `agent-ssh-key` |
| Description | `Jenkins master key for logging in to the agent` |
| Username | `ubuntu` |
| Private Key | **Enter directly** → **Add** → paste the master's **private** key |

   Get the private key from the master and copy everything it prints,
   including the `-----BEGIN` and `-----END` lines:

   ```powershell
   ssh ubuntu@$MASTER "cat ~/.ssh/id_ed25519"
   ```

5. Click **Add**, then pick `agent-ssh-key` in the **Credentials** list.
6. **Host Key Verification Strategy:** `Non verifying Verification
   Strategy`.
7. Click **Save**.

## Step 7: Launch the agent and check the connection

1. Go to **Manage Jenkins → Nodes** and click `flask-builder`.
2. Click **Launch agent** if it is not already connecting.
3. Click **Log** on the left. After a few seconds the last line must be:

   ```
   Agent successfully connected and online
   ```

The node list now shows `flask-builder` without a red cross. Any
pipeline that asks for the label `flask-builder` runs on the agent.

---

## Checklist

| Check | Where |
|---|---|
| Jenkins opens and you can log in | `http://<master-ip>:8080` |
| The six plugins from step 2 are installed | Manage Jenkins → Plugins → Installed plugins |
| `/home/ubuntu/pipeline-workspace` exists on the agent | Agent: `ls -d ~/pipeline-workspace` |
| The agent has two lines in `~/.ssh/authorized_keys` | Agent: `cat ~/.ssh/authorized_keys` |
| The master can SSH to the agent | Master: `ssh ubuntu@<agent-private-ip> hostname` |
| `agent-ssh-key` credential exists | Manage Jenkins → Credentials |
| `flask-builder` is online | Manage Jenkins → Nodes |

**Next:** [02-credentials-and-email.md](02-credentials-and-email.md)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The Jenkins page does not open | Your public IP is no longer the one in `admin_cidrs`. | Update `admin_cidrs` in `terraform.tfvars` and apply. See [03-ssh-into-servers.md](../03-terraform-aws/03-ssh-into-servers.md). |
| The Jenkins page does not open, and your IP is right | Jenkins is not running yet, or the boot script failed. | Master: `cloud-init status --wait`, then `systemctl is-active jenkins`. |
| `initialAdminPassword: No such file` | Jenkins is still installing. | Wait a few minutes and try again. |
| Agent log: `Authentication failed` or `Permission denied (publickey)` | The master's public key is not on the agent, or the private key in Jenkins is not the matching one. | Repeat step 5, then check the test from the master. Paste the private key again in step 6, with the `BEGIN` and `END` lines. |
| Agent log: `Connection timed out` | Wrong Host. | Use the agent's **private** IP (`terraform output -raw agent_private_ip`), not a public IP. |
| Agent log: `java: command not found` | The agent's boot script did not finish. | Agent: `cloud-init status --wait`, then `java -version`. |
| Builds wait with "There are no nodes with the label `flask-builder`" | The label is missing or misspelled. | Node → Configure → Labels: exactly `flask-builder`. |
| You can no longer SSH to the agent from your laptop | Your own key was removed from `authorized_keys` (a `>` instead of `>>`). | Add it back through Session Manager: [03-ssh-into-servers.md](../03-terraform-aws/03-ssh-into-servers.md), Fix A. |
