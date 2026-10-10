# SSH into the Master and Agent

Follow this every time you run `terraform apply`, so SSH works on the
first try.

Run every command in **PowerShell** on your laptop, from the
`terraform` folder, unless a step says otherwise.

Every section is marked:

- **Compulsory**: you must do it, or SSH will not work.
- **Optional (production recommended)**: everything works without it.

| # | Section | When | Status |
|---|---|---|---|
| 1 | Check your SSH key (do not create a new one) | Before apply | Compulsory |
| 2 | Check your laptop's public IP | Before apply | Compulsory |
| 3 | Update `admin_cidrs` in `terraform.tfvars` | Before apply | Compulsory if the IP changed |
| 4 | Plan and apply | - | Compulsory |
| 5 | Get the server IPs | After apply | Compulsory |
| 6 | SSH into the master | After apply | Compulsory |
| 7 | SSH into the agent | After apply | Compulsory |
| 8 | Fix: connection timed out | When it happens | - |
| 9 | Fix: permission denied (publickey) | When it happens | - |
| 10 | Fix: other SSH errors | When it happens | - |
| 11 | Allow an IP range | Any time | Optional |
| 12 | Short names with an SSH config file | Any time | Optional |

## Two things decide whether SSH works

| Check | What must match | Error if it does not |
|---|---|---|
| **Firewall** | Your laptop's public IP must be the one in `admin_cidrs`. | `Connection timed out` |
| **Key** | The key on your laptop must be the one the server was created with. | `Permission denied (publickey)` |

Both problems happened in this project on 10 October 2026. Sections 1
to 3 prevent them.

---

# Compulsory

## 1. Check your SSH key (do not create a new one)

```powershell
dir $env:USERPROFILE\.ssh\id_ed25519*
```

You should see two files:

| File | What it is |
|---|---|
| `id_ed25519` | Private key. Stays on your laptop. |
| `id_ed25519.pub` | Public key. Terraform copies it to the servers. |

**If both files exist, do nothing. Do not run `ssh-keygen`.**

Running `ssh-keygen` again overwrites the key. Servers that are already
running still hold the old key, and you are locked out of them
(section 9). If `ssh-keygen` ever asks `Overwrite (y/n)?`, answer `n`.

Only if the files are missing, create them once:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519
```

## 2. Check your laptop's public IP

```powershell
curl.exe -s https://checkip.amazonaws.com
```

It prints one IP, for example `223.185.135.233`. This is the address AWS
sees when your laptop connects. It is not the `192.168.x.x` address of
your Wi-Fi.

Your internet provider changes this IP from time to time, often when the
router or mobile hotspot reconnects. So check it every time.

## 3. Update admin_cidrs in terraform.tfvars

See what Terraform currently allows:

```powershell
Select-String admin_cidrs terraform.tfvars
```

Compare it with the IP from section 2.

| Result | What to do |
|---|---|
| Same IP | Nothing. Go to section 4. |
| Different IP | Edit line 19 of `terraform/terraform.tfvars`. |

Put your IP inside the quotes and add `/32` at the end:

```hcl
admin_cidrs       = ["223.185.135.233/32"]
```

`/32` means "exactly this one IP". Only the IPs in this list can reach
SSH (port 22) and Jenkins (port 8080) on the master.

## 4. Plan and apply

```powershell
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
```

Read the last line of the plan before applying.

| Situation | Expected last line |
|---|---|
| First apply, nothing exists yet | `Plan: 43 to add, 0 to change, 0 to destroy.` |
| Servers exist, only your IP changed | `Plan: 2 to add, 0 to change, 2 to destroy.` |
| Servers exist, nothing changed | `No changes.` |

The "2 to add, 2 to destroy" case swaps the old SSH rule and Jenkins rule
for new ones. The servers are not touched.

If the plan wants to destroy or replace anything you did not expect,
stop and find out why before applying.

After a first apply, wait about 3 minutes. The servers are still
installing Jenkins and Docker.

## 5. Get the server IPs

The IPs change every time the servers are created again, so always read
them from Terraform:

```powershell
$MASTER = terraform output -raw master_public_ip
$AGENT  = terraform output -raw agent_private_ip

"Master: $MASTER"
"Agent : $AGENT"
```

Both lines must print an IP. If one is blank, you are not in the
`terraform` folder.

The variables last as long as the PowerShell window stays open. In a new
window, run these lines again.

## 6. SSH into the master

```powershell
ssh ubuntu@$MASTER
```

`$MASTER` is just the master's public IP stored in a variable. You can
type the public IP directly and get the same result:

```powershell
ssh ubuntu@3.109.73.125
```

Replace `3.109.73.125` with your current master IP. Find it with
`terraform output -raw master_public_ip`, or in the AWS Console under
**EC2 → Instances → questly-dev-master → Public IPv4 address**.

Typing the IP works from any folder and any PowerShell window, with no
need to set `$MASTER` first. The IP changes when the master is created
again, so check it after every `terraform destroy` and `apply`.

The first time, SSH asks:

```
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` and press Enter. Pressing Enter without typing `yes` gives
`Host key verification failed`.

You do not need `-i`. SSH finds `id_ed25519` in `C:\Users\kumar\.ssh\`
by itself.

Type `exit` to leave.

## 7. SSH into the agent

The agent has no public IP. You reach it through the master with `-J`:

```powershell
ssh -J ubuntu@$MASTER ubuntu@$AGENT
```

Or with the IPs typed directly: the master's **public** IP after `-J`,
then the agent's **private** IP.

```powershell
ssh -J ubuntu@3.109.73.125 ubuntu@10.0.10.71
```

Find the agent's IP with `terraform output -raw agent_private_ip`.

Type `yes` when asked. Type `exit` to leave.

Copy a file to the agent the same way:

```powershell
scp -o "ProxyJump=ubuntu@$MASTER" ..\backend\.env "ubuntu@${AGENT}:/tmp/backend.env"
```

---

# Fixes

## 8. Fix: connection timed out

```
ssh: connect to host 3.109.73.125 port 22: Connection timed out
```

**Cause:** your laptop's public IP is not the one in `admin_cidrs`, so
the master's firewall drops the connection. Jenkins in the browser is
blocked for the same reason.

**Fix:** do sections 2, 3 and 4 again. The plan shows
`2 to add, 0 to change, 2 to destroy`. Then retry SSH.

To see what the firewall allows right now:

```powershell
aws ec2 describe-security-groups --filters Name=group-name,Values=questly-dev-master-sg --query "SecurityGroups[0].IpPermissions[].[FromPort,IpRanges[0].CidrIp]" --output text
```

## 9. Fix: permission denied (publickey)

```
ubuntu@3.109.73.125: Permission denied (publickey).
```

**Cause:** the key on your laptop is not the key the server was created
with. This happens when `ssh-keygen` was run again after the servers
were created.

AWS copies the public key into a server only on its first boot. A later
`terraform apply` updates AWS's stored copy (`questly-dev-key`) but does
not change servers that are already running.

Pick one fix.

### Fix A: add the new key through Session Manager

Keeps both servers and everything on them.

1. Print your current public key and copy the whole line:
   ```powershell
   Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
   ```
2. In the AWS Console, open **EC2 → Instances** and select
   `questly-dev-master`.
3. Click **Connect → Session Manager → Connect**. A terminal opens in
   the browser.
4. Run this, with your copied line between the quotes:
   ```bash
   echo 'PASTE-YOUR-PUBLIC-KEY-LINE-HERE' | sudo tee -a /home/ubuntu/.ssh/authorized_keys
   ```
5. Repeat steps 2 to 4 for `questly-dev-agent`.
6. Retry sections 6 and 7.

A public key is safe to paste. Never paste the private key
(`id_ed25519` without `.pub`) anywhere except the Jenkins credential.

### Fix B: recreate both servers

New servers get the current key on first boot. Everything on the old
servers is lost: Jenkins setup, the kind cluster and the secrets.

```powershell
terraform plan -replace="aws_instance.master" -replace="aws_instance.agent" -out=tfplan
terraform show tfplan
terraform apply tfplan
```

The plan should replace only the two instances and the two target group
attachments. Then do section 5 again, because the agent's private IP
changes. Wait about 3 minutes before logging in.

## 10. Fix: other SSH errors

| Error | Cause | Fix |
|---|---|---|
| `connect to host  port 22` with a blank host | `$MASTER` is empty. | Run section 5 again from the `terraform` folder. |
| `Host key verification failed` | You pressed Enter without typing `yes`. | Run the command again and type `yes`. |
| `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED` | A new server has the same IP as an old one. | Run `ssh-keygen -R <ip>`, then connect again. This only forgets the old server; it does not touch your key. |
| `Connection refused` | The server is still booting. | Wait a minute and retry. |
| Master works, agent times out | The agent is still booting, or `$AGENT` is an old IP. | Run section 5 again and retry. |

Check that both servers are running:

```powershell
aws ec2 describe-instances --filters Name=tag:Project,Values=questly Name=instance-state-name,Values=running --query "Reservations[].Instances[].[Tags[?Key=='Name']|[0].Value,PublicIpAddress,PrivateIpAddress]" --output table
```

---

# Optional (production recommended)

Everything above works without this part.

## 11. Allow an IP range

If your IP changes often, you can allow the whole block it moves within.
On 10 October 2026 your IP moved from `223.185.129.177` to
`223.185.135.233`. Both are inside this range:

```hcl
admin_cidrs       = ["223.185.128.0/21"]
```

It covers `223.185.128.0` to `223.185.135.255`.

| | Exact IP (`/32`) | Range (`/21`) |
|---|---|---|
| Locked out when your IP changes | Yes | Less often |
| Who can reach ports 22 and 8080 | Only you | You and other customers of your provider in that range |

SSH still needs your private key and Jenkins still needs a login, so the
range is acceptable for a learning setup. For real work, production
teams keep the exact IP, or use a VPN or Session Manager.

You can also list several exact IPs:

```hcl
admin_cidrs       = ["223.185.135.233/32", "203.0.113.10/32"]
```

## 12. Short names with an SSH config file

Create `C:\Users\kumar\.ssh\config` (no file extension):

```
Host questly-master
    HostName <master-public-ip>
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519

Host questly-agent
    HostName <agent-private-ip>
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    ProxyJump questly-master
```

Then:

```powershell
ssh questly-master
ssh questly-agent
```

Update both `HostName` lines whenever the servers are recreated.

---

## Quick checklist

Before `terraform apply`:

1. `dir $env:USERPROFILE\.ssh\id_ed25519*` shows two files. Do not run `ssh-keygen`.
2. `curl.exe -s https://checkip.amazonaws.com` shows your IP.
3. `admin_cidrs` in `terraform.tfvars` has that IP with `/32`.

After `terraform apply`:

4. `$MASTER = terraform output -raw master_public_ip`
5. `$AGENT  = terraform output -raw agent_private_ip`
6. `ssh ubuntu@$MASTER`
7. `ssh -J ubuntu@$MASTER ubuntu@$AGENT`

The same two commands with the IPs typed directly (replace them with
your current IPs):

```powershell
ssh ubuntu@3.109.73.125
ssh -J ubuntu@3.109.73.125 ubuntu@10.0.10.71
```
