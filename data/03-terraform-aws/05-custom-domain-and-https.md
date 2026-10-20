# Custom Domain and HTTPS for Questly

The full journey from "the app opens on the load balancer link" to
"the app opens on `https://questly.kumardevops.online` on every device".

It is written in the order it was done on 10 and 11 October 2026:

| Part | What you get at the end | Address that works |
|---|---|---|
| 1 | The app on the load balancer link, over HTTP | `http://questly-dev-alb-....elb.amazonaws.com` |
| 2 | The app on your own domain, over HTTP | `http://questly.kumardevops.online` |
| 3 | The app on your own domain, over HTTPS | `https://questly.kumardevops.online` |
| 4 | The short version for the next rebuild | `https://questly.kumardevops.online` |

**Before this guide:** the servers exist, you can SSH into them, and the
app is deployed on the agent. See
[01-install-terraform-aws-cli.md](01-install-terraform-aws-cli.md),
[03-ssh-into-servers.md](03-ssh-into-servers.md) and
[04-after-terraform-apply.md](04-after-terraform-apply.md).

Every section is marked:

- **Compulsory**: you must do it, or the next step will not work.
- **Optional (production recommended)**: everything works without it.

## Read this first: which parts to follow

The Terraform code changed during this work. Since commit `052d837`
("Add HTTPS to the ALB with an ACM certificate and HTTP-to-HTTPS
redirect") the load balancer is always built with HTTPS, and port 80
only redirects to HTTPS.

| You want to | Follow |
|---|---|
| Get the site back after `terraform destroy` and `apply`, as fast as possible | **Part 4** only |
| Repeat the whole practical step by step, HTTP first and then HTTPS | Section 0, then Parts 1, 2 and 3 |
| Understand why each step exists and how the code works | Read Parts 1 to 3 |

## The values used in this project

| Thing | Value |
|---|---|
| Domain bought at GoDaddy | `kumardevops.online` |
| Address chosen for the app | `questly.kumardevops.online` |
| Frontend setting | `NEXT_PUBLIC_API_BASE_URL` |
| Frontend secret in the cluster | `questly-frontend-secrets` in namespace `questly-ns` |
| Frontend env file on the agent | `~/pipeline-workspace/workspace/questly/frontend/.env` |
| Load balancer name (changes on every rebuild) | `terraform output -raw alb_dns_name` |

## Where each command is run

| Label in this guide | Where |
|---|---|
| **Laptop** | PowerShell, in the `terraform` folder |
| **Agent** | SSH session on the agent (`ssh -J ubuntu@<master-ip> ubuntu@<agent-ip>`) |
| **GoDaddy** | Browser: My Products → your domain → DNS |
| **AWS Console** | Browser |

## Before any Terraform command

Two checks save a failed run. Both are explained in
[03-ssh-into-servers.md](03-ssh-into-servers.md).

1. **Your public IP is still the one in `admin_cidrs`.**
   ```powershell
   curl.exe -s https://checkip.amazonaws.com
   Select-String admin_cidrs terraform.tfvars
   ```
2. **`terraform.tfvars` has no typing mistakes.**
   ```powershell
   terraform validate
   ```

---

## 0. Optional: go back to the HTTP-only code

Only needed if you want to practise Parts 1 and 2 again. With the
current code, port 80 redirects to HTTPS, so a plain HTTP stage does not
exist.

**Laptop**, from the project root:

```powershell
git status
git checkout ec5938b
```

`git status` must show a clean tree first. `ec5938b` is the last commit
before HTTPS was added. Your `terraform.tfvars` is not in git, so it
stays as it is. Terraform will print a warning about three unused values
(`app_domain_name`, `alb_https_port`, `alb_ssl_policy`); that is
harmless.

Do this only when nothing is built, that is, after `terraform destroy`.
If you plan with this older code while the HTTPS setup is live,
Terraform will want to remove the certificate and the HTTPS listener.

Then build the infrastructure and deploy the app as usual.

When you reach Part 3, come back to the current code:

```powershell
git checkout main
```

---

# Part 1: Run the site on the load balancer link (HTTP)

**Status: compulsory the first time. Skipped in Part 4.**

## 1.1 Understand what the frontend setting is for

The frontend runs in the visitor's **browser**. When someone clicks
"Generate quiz", the browser calls:

```
<NEXT_PUBLIC_API_BASE_URL>/api/quiz/generate
```

So `NEXT_PUBLIC_API_BASE_URL` must be an address the **browser** can
reach from the internet.

| Value | Works? | Why |
|---|---|---|
| `http://localhost:3001` | Only on your laptop | "localhost" means the visitor's own computer. |
| The agent's private IP (`10.0.10.x`) | No | Private addresses are only reachable inside the VPC. The agent has no public IP. |
| The load balancer link | **Yes** | It is the public way in. |

Two conditions make the load balancer link work. Both are already true
in this project.

**Condition 1: the load balancer sends `/api/*` to the backend.** In
`terraform/alb.tf`:

```hcl
resource "aws_lb_listener_rule" "api" {
  ...
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn   # agent port 30081
  }
  condition {
    path_pattern {
      values = [var.api_path_pattern]                    # "/api/*"
    }
  }
}
```

You will not find the text `/api/*` or `30081` in `alb.tf`. They are
variables, and the values are in `terraform/terraform.tfvars`:

| Line in `terraform.tfvars` | Used in `alb.tf` as |
|---|---|
| `api_path_pattern = "/api/*"` | `var.api_path_pattern` |
| `backend_node_port = 30081` | `var.backend_node_port` |
| `frontend_node_port = 30080` | `var.frontend_node_port` |

Everything that does not match `/api/*` goes to the frontend on port
30080. That is the listener's `default_action`.

**Condition 2: the frontend adds `/api/...` to the base address
itself.** This is in the frontend code, not in Terraform:

| File | Code |
|---|---|
| `frontend/lib/api.ts` | `export const API_BASE_URL = getPublicEnv("NEXT_PUBLIC_API_BASE_URL");` |
| `frontend/app/dashboard/generate/page.tsx` | ``fetch(`${API_BASE_URL}/api/quiz/generate`, ...)`` |
| `frontend/app/dashboard/battles/page.tsx` | ``fetch(`${API_BASE_URL}/api/quiz/generate`, ...)`` |
| `frontend/app/dashboard/quiz/QuizTake.tsx` | ``fetch(`${API_BASE_URL}/api/quiz/save-attempt`, ...)`` |

That is why the value must not end with `/` or `/api`.

How the two connect:

```
frontend env:   NEXT_PUBLIC_API_BASE_URL = http://<load-balancer>
frontend code:  adds  /api/quiz/generate
                        │
                        ▼
browser calls:  http://<load-balancer>/api/quiz/generate
                        │
                        ▼
alb.tf rule:    path matches /api/*  →  backend target group  →  agent:30081
```

## 1.2 Get the load balancer link and check the app is behind it

**Laptop:**

```powershell
terraform output -raw alb_dns_name
```

On the HTTP-only code from section 0 this output does not exist; use
`terraform output -raw next_public_api_base_url` and drop the `http://`.

Example result: `questly-dev-alb-542556956.ap-south-1.elb.amazonaws.com`

Check that the load balancer can reach the app:

```powershell
aws elbv2 describe-target-health --target-group-arn (aws elbv2 describe-target-groups --names questly-dev-frontend-tg --query "TargetGroups[0].TargetGroupArn" --output text) --query "TargetHealthDescriptions[].TargetHealth.State" --output text
```

| Output | Meaning |
|---|---|
| `healthy` | The frontend is running and reachable. Continue. |
| `unhealthy` | Nothing answers on port 30080. The app is not deployed on the agent yet; do [04-after-terraform-apply.md](04-after-terraform-apply.md) first. |

Replace `frontend-tg` with `backend-tg` to check the backend.

## 1.3 Put the link in the frontend env file

**Agent:**

```bash
cd ~/pipeline-workspace/workspace/questly/frontend
sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://<load-balancer-name>|' .env
grep NEXT_PUBLIC_API_BASE_URL .env
```

Replace `<load-balancer-name>` with the result of 1.2. The `grep` line
prints the result so you can check it.

The value must look exactly like this:

```
NEXT_PUBLIC_API_BASE_URL=http://questly-dev-alb-542556956.ap-south-1.elb.amazonaws.com
```

| Rule | Wrong | Right |
|---|---|---|
| `http://`, not `https://` | `https://questly-dev-alb-...` | `http://questly-dev-alb-...` |
| No port | `...amazonaws.com:30081` | `...amazonaws.com` |
| No path | `...amazonaws.com/api` | `...amazonaws.com` |
| No `/` at the end | `...amazonaws.com/` | `...amazonaws.com` |
| Not the agent's private IP | `http://10.0.10.234` | `http://questly-dev-alb-...` |

**Editing by hand instead of `sed`:**

| Editor | Steps |
|---|---|
| `nano .env` | Change the line. `Ctrl+O`, `Enter` to save. `Ctrl+X` to exit. |
| `vi .env` | Press `i` to edit. Change the line. Press `Esc`, type `:wq`, press `Enter`. |

**If the `.env` file is not on the agent yet,** copy it from your
laptop. **Laptop**, from the project root:

```powershell
scp -o "ProxyJump=ubuntu@<master-ip>" frontend\.env ubuntu@<agent-ip>:~/pipeline-workspace/workspace/questly/frontend/.env
```

Then on the **agent**, remove the Windows line endings, which would
corrupt the values on Linux:

```bash
sed -i 's/\r$//' ~/pipeline-workspace/workspace/questly/frontend/.env
```

Change the value only in the copy on the agent. Leave `frontend/.env` on
your laptop as it is, so the app still runs locally.

## 1.4 Load the file into the cluster

The running frontend does not read the `.env` file. It reads a
Kubernetes **secret**, and only when the pod starts. So after every
change to the file you must replace the secret and restart the frontend.

**Agent**, still inside the `frontend` folder:

```bash
kubectl delete secret questly-frontend-secrets -n questly-ns
kubectl create secret generic questly-frontend-secrets --from-env-file=.env -n questly-ns
kubectl rollout restart deployment/frontend -n questly-ns
kubectl rollout status deployment/frontend -n questly-ns
```

| Line | What it does |
|---|---|
| 1 | Removes the old secret. `not found` here is fine. |
| 2 | Builds a new secret from the file. Must print `created`. |
| 3 | Starts a new frontend pod, which reads the new secret. |
| 4 | Waits until the new pod is ready. |

**Run the four lines in this order, once.** Do not run the delete line
again after the create line has printed `created`; that removes the
secret you just made.

`--from-env-file=.env` is a path. `.env` means "the file in the folder I
am in". Do not write `/frontend/.env`: a path starting with `/` begins
at the top of the disk, and that file does not exist.

If line 2 fails, fix the path and run line 2 again straight away. While
the secret is missing, a frontend pod that restarts cannot start. The
pod that is already running keeps working.

**This block is used three times in this guide. It is called "the
reload block" from here on.**

Check what the cluster holds:

```bash
kubectl get secret questly-frontend-secrets -n questly-ns -o jsonpath='{.data.NEXT_PUBLIC_API_BASE_URL}' | base64 -d; echo
kubectl get pods -n questly-ns
```

No Docker rebuild is needed. The frontend reads this value when its
container starts, not when the image is built.

Running the Jenkins job does the same as the reload block:
`k8s/deploy.sh` rebuilds the secret from `frontend/.env` in the
workspace on every build and restarts the pods. So the file in the
workspace must always hold the correct value.

## 1.5 Open the site

Browser: `http://<load-balancer-name>`

| What you see | Meaning |
|---|---|
| The app | Working. |
| `502` or `503` | The pods are not ready, or the health check has not passed yet. Wait a minute. |
| The page loads but quiz generation fails | The frontend value is wrong. Press `F12`, open the Console tab and read the error. |

---

# Part 2: Map the domain in GoDaddy (HTTP)

**Status: 2.2 is compulsory after every rebuild. The rest is first-time only.**

## 2.1 Understand the DNS record

DNS turns a name into an address. You add one record that says "the name
`questly.kumardevops.online` is another name for the load balancer".
That kind of record is a **CNAME**.

| Question | Answer |
|---|---|
| Why a CNAME and not an A record? | An A record needs a fixed IP. A load balancer has a name, and its IPs change. |
| Why `questly.kumardevops.online` and not `kumardevops.online`? | GoDaddy does not allow a CNAME on the bare domain. A subdomain also leaves your other records untouched. |

## 2.2 Add the record

**GoDaddy** → My Products → `kumardevops.online` → **DNS** tab →
**DNS Records** → **Add New Record**:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `questly` |
| Value | the load balancer name from 1.2 |
| TTL | Custom → `600` seconds |

Click **Save**.

- **Name:** only `questly`. GoDaddy adds `.kumardevops.online` itself.
- **Value:** only the host name. No `http://`, no path such as
  `/dashboard/generate`.
- If a `questly` record already exists, click the pencil and change its
  value. Do not add a second one.

**Leave the other records on that page alone:**

| Existing record | What it is | Touch it? |
|---|---|---|
| `CNAME portfolio → cname.vercel-dns.com` | Your portfolio site on Vercel | No |
| `CNAME www → kumardevops.online` | Sends `www` to the bare domain | No |
| `NS`, `SOA`, `_domainconnect`, `_dmarc` | GoDaddy's own records | No |
| `A @ → 3.110.117.177` | An old server IP that is no longer in your AWS account | Optional; see the last section |

**The load balancer's name changes every time it is rebuilt**, so this
value must be updated after every `terraform destroy` and `apply`.

## 2.3 Check the record

Wait two or three minutes after saving. Then, **Laptop**:

```powershell
nslookup questly.kumardevops.online 8.8.8.8
```

It is working when the answer shows the load balancer name under
`Aliases` or `canonical name`. `8.8.8.8` asks Google's DNS directly.

You can also check from the agent with `nslookup questly.kumardevops.online`.

**Do not look the name up before the record is saved.** If you do, your
internet provider's DNS remembers the answer "this name does not exist"
for up to an hour. The record is then correct for the whole world except
your own laptop, and Chrome shows `DNS_PROBE_FINISHED_NXDOMAIN`.

If that happens, pick one:

| Option | Steps |
|---|---|
| Wait | It fixes itself within about an hour. |
| Chrome only | `chrome://settings/security` → turn on **Use secure DNS** → choose **Google (Public DNS)**. |
| Whole laptop | Settings → Network & internet → Wi-Fi → your network → **DNS server assignment** → Edit → Manual → IPv4 on → Preferred `8.8.8.8`, Alternate `1.1.1.1`. Then run `ipconfig /flushdns`. |

If Chrome still shows the error, open `chrome://net-internals/#dns` and
click **Clear host cache**.

## 2.4 Point the frontend at the domain

**Agent:**

```bash
cd ~/pipeline-workspace/workspace/questly/frontend
sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://questly.kumardevops.online|' .env
grep NEXT_PUBLIC_API_BASE_URL .env
```

Then run the reload block from 1.4.

## 2.5 Open the site, and see why HTTP is not enough

Browser: `http://questly.kumardevops.online` (type the `http://`).

What happened on 11 October 2026:

| Device | Result |
|---|---|
| Laptop, with `http://` typed in full | Worked |
| Laptop, Chrome changing it to `https://` | "This site can't be reached" |
| Phone and tablet | Did not open |

**Why:** modern browsers try `https://` first. The server was not
telling them to; the browser decides this itself. The load balancer was
not listening on HTTPS (port 443), so those attempts failed.

Prove that the server is fine and only the browser is switching:

```powershell
curl.exe -I http://questly.kumardevops.online
```

It prints `HTTP/1.1 200 OK`.

**To test over HTTP on the laptop anyway:**

1. `chrome://settings/security` → turn off **Always use secure connections**.
2. `chrome://net-internals/#hsts` → under **Delete domain security
   policies**, enter `kumardevops.online` and click **Delete**. Repeat
   for `questly.kumardevops.online`.
3. Type the full address including `http://`. If Chrome suggests an
   `https://` version from history, do not pick it.
4. Or use an Incognito window (`Ctrl+Shift+N`).

This only helps on your own laptop. Phones mostly cannot be told to use
HTTP, and neither can your visitors. That is why Part 3 is needed.

---

# Part 3: Add HTTPS

**Status: compulsory for a site real people use.**

## 3.1 Understand how HTTPS works here

HTTPS needs a **certificate**: a file that proves "this server really is
`questly.kumardevops.online`". The browser checks it before sending
anything.

```
Browser ══ HTTPS (encrypted) ══► Load balancer ── HTTP ──► agent (pods)
                                  holds the                 inside the
                                  certificate               private VPC
```

| Piece | Who provides it | What it does |
|---|---|---|
| Certificate | **AWS Certificate Manager (ACM)**, free | Proves the site's identity; lets traffic be encrypted. |
| Proof that you own the domain | **You**, with one DNS record in GoDaddy | ACM will not issue a certificate for a domain you cannot prove is yours. |
| HTTPS listener on port 443 | The load balancer | Accepts `https://` and uses the certificate. |
| Port 443 in the firewall | The load balancer's security group | Lets HTTPS traffic in. |
| Redirect on port 80 | The load balancer | Sends `http://` visitors to `https://`. |

The encryption ends at the load balancer. From there to the agent the
traffic is plain HTTP, which is fine because that part is inside your
private network. **Nothing changes on the agent, in Docker, in
Kubernetes or in the app's code.** The only app change is one env value
(3.10).

### How ACM checks that you own the domain

1. Terraform asks ACM for a certificate for `questly.kumardevops.online`.
2. ACM replies: "add this exact CNAME record to your DNS", with a random
   name and a random value.
3. You add that record in GoDaddy. Only the owner of the domain can.
4. ACM looks the record up. When it finds it, the certificate status
   changes from **Pending validation** to **Issued**.
5. Only an issued certificate can be attached to a load balancer.

This is called **DNS validation**. Keep the record in GoDaddy forever:
ACM checks it again each time it renews the certificate.

## 3.2 How the HTTPS code is written

The code is already in the repository (commit `052d837`), so there is
nothing to type. This section explains every piece, so you could write
it again yourself.

Five files changed:

| File | What was added or changed |
|---|---|
| `terraform/variables.tf` | 3 new variables |
| `terraform/terraform.tfvars` | 3 new values |
| `terraform/alb.tf` | 3 new resources, 2 changed resources |
| `terraform/security.tf` | 1 new firewall rule |
| `terraform/outputs.tf` | 1 changed local, 2 new outputs |

### Step A: three new variables

`terraform/variables.tf`:

```hcl
variable "alb_https_port" {
  description = "HTTPS port the ALB listens on."
  type        = number
}

variable "alb_ssl_policy" {
  description = "TLS security policy of the HTTPS listener."
  type        = string
}

variable "app_domain_name" {
  description = "Domain name of the app (e.g. questly.example.com). An ACM certificate is issued for it; its DNS must point at the ALB."
  type        = string
}
```

`terraform/terraform.tfvars` gives them values:

```hcl
alb_https_port  = 443
app_domain_name = "questly.kumardevops.online"
alb_ssl_policy  = "ELBSecurityPolicy-TLS13-1-2-2021-06"
```

| Variable | Meaning |
|---|---|
| `alb_https_port` | The port for HTTPS. `443` is the standard one. |
| `app_domain_name` | The name the certificate is issued for. It must be the exact address visitors type. |
| `alb_ssl_policy` | Which encryption versions the load balancer accepts. This AWS policy allows TLS 1.2 and 1.3 and refuses older, weaker ones. |

The same three lines, with placeholders, are in
`terraform.tfvars.example`.

### Step B: ask for the certificate

`terraform/alb.tf`, lines 74 to 84:

```hcl
resource "aws_acm_certificate" "app" {
  domain_name       = var.app_domain_name
  validation_method = "DNS"

  tags = { Name = "${local.name}-cert" }

  lifecycle {
    create_before_destroy = true
  }
}
```

| Line | Meaning |
|---|---|
| `domain_name = var.app_domain_name` | "I want a certificate for `questly.kumardevops.online`." |
| `validation_method = "DNS"` | "I will prove ownership with a DNS record." The other choice is email. |
| `tags` | Names it `questly-dev-cert` in the console. |
| `create_before_destroy = true` | If the certificate ever has to be replaced, make the new one first and delete the old one after. A listener must never be left without a certificate. |

After this resource is created, the certificate exists with status
**Pending validation**. ACM also returns the DNS record it wants. That
record is stored in the resource as `domain_validation_options`.

### Step C: wait for the certificate to be issued

`terraform/alb.tf`, lines 86 to 88:

```hcl
resource "aws_acm_certificate_validation" "app" {
  certificate_arn = aws_acm_certificate.app.arn
}
```

This resource creates nothing in AWS. It is a **waiting step**: Terraform
keeps asking ACM "is it issued yet?" and only marks this resource done
when the answer is yes.

It exists so that the HTTPS listener can point at it (step E). That
forces the right order: certificate issued first, listener second.

`arn` is the full AWS ID of a resource. `aws_acm_certificate.app.arn` is
the ID of the certificate from step B.

### Step D: change port 80 from "forward" to "redirect"

`terraform/alb.tf`, lines 94 to 108.

Before:

```hcl
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = var.alb_listener_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
```

After:

```hcl
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = var.alb_listener_port
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = tostring(var.alb_https_port)
      status_code = "HTTP_301"
    }
  }
}
```

| Line | Meaning |
|---|---|
| `type = "redirect"` | Do not serve the page on port 80. Tell the browser to go elsewhere. |
| `protocol = "HTTPS"` | Go to the same address, but with `https://`. |
| `port = tostring(var.alb_https_port)` | On port 443. This field wants text, and the variable is a number, so `tostring()` converts `443` to `"443"`. |
| `status_code = "HTTP_301"` | "Moved permanently". Browsers remember it and go straight to HTTPS next time. |

The host name and the path are kept. `http://questly.kumardevops.online/login`
becomes `https://questly.kumardevops.online/login`.

### Step E: add the HTTPS listener

`terraform/alb.tf`, lines 110 to 121:

```hcl
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = var.alb_https_port
  protocol          = "HTTPS"
  ssl_policy        = var.alb_ssl_policy
  certificate_arn   = aws_acm_certificate_validation.app.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
```

| Line | Meaning |
|---|---|
| `load_balancer_arn = aws_lb.app.arn` | Attach this listener to the existing load balancer. |
| `port = var.alb_https_port` | Listen on 443. |
| `protocol = "HTTPS"` | Speak HTTPS on that port. |
| `ssl_policy = var.alb_ssl_policy` | Which encryption versions to accept. |
| `certificate_arn = aws_acm_certificate_validation.app.certificate_arn` | Use the certificate. It points at the **waiting step** from step C, not at the certificate directly, so this listener cannot be created before the certificate is issued. |
| `default_action { forward → frontend }` | Anything not matched by a rule goes to the frontend, exactly as port 80 used to do. |

### Step F: move the `/api/*` rule to the HTTPS listener

`terraform/alb.tf`, lines 123 to 137. One line changed:

```hcl
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn      # was aws_lb_listener.http.arn
  priority     = var.api_rule_priority
  ...
}
```

Port 80 now only redirects, so a rule there would never be used. The
real traffic arrives on 443, so the "send `/api/*` to the backend" rule
must live on the HTTPS listener.

A rule cannot be moved between listeners. That is why the plan in round
2 shows this resource as "must be replaced": the old one is deleted and
a new one is created.

### Step G: open port 443 in the firewall

`terraform/security.tf`, lines 52 to 61:

```hcl
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each = toset(var.app_ingress_cidrs)

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from allowed clients"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = var.alb_https_port
  to_port           = var.alb_https_port
}
```

| Line | Meaning |
|---|---|
| `for_each = toset(var.app_ingress_cidrs)` | Make one rule per entry in `app_ingress_cidrs`. The value is `["0.0.0.0/0"]`, so one rule. |
| `security_group_id = aws_security_group.alb.id` | The rule belongs to the load balancer's security group. |
| `cidr_ipv4 = each.value` | Who is allowed: `0.0.0.0/0`, meaning everyone. |
| `from_port` / `to_port` | Port 443 only. |

It is a copy of the existing port 80 rule (`alb_http`) with a different
port. Without it the listener would exist but no traffic could reach it.
That is the "site can't be reached" timeout from 2.5.

The agent's security group does not change. The load balancer still
talks to the agent on ports 30080 and 30081.

### Step H: outputs

`terraform/outputs.tf`.

The app address is now built from the domain (line 6):

```hcl
app_url = var.alb_https_port == 443 ? "https://${var.app_domain_name}" : "https://${var.app_domain_name}:${var.alb_https_port}"
```

Read it as `CONDITION ? IF_TRUE : IF_FALSE`. The port is 443, so the
result is `https://questly.kumardevops.online`, with no `:443` at the
end. The outputs `app_url` and `next_public_api_base_url` both print it.

Two new outputs:

```hcl
output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "acm_validation_record" {
  value = {
    for o in aws_acm_certificate.app.domain_validation_options : o.domain_name => {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  }
}
```

| Output | Use |
|---|---|
| `alb_dns_name` | The value for the `questly` CNAME in GoDaddy (2.2). |
| `acm_validation_record` | The record ACM wants in GoDaddy (3.6). |

The second one reads as: "go through the validation records ACM gave
back (`domain_validation_options`), and for each one print its type,
name and value, labelled with the domain".

### How the pieces depend on each other

```
aws_acm_certificate.app              (B)  ask for the certificate
        │ .arn
        ▼
aws_acm_certificate_validation.app   (C)  wait until issued   ◄── needs the GoDaddy record
        │ .certificate_arn
        ▼
aws_lb_listener.https                (E)  HTTPS on port 443
        │ .arn
        ▼
aws_lb_listener_rule.api             (F)  /api/* → backend

aws_lb_listener.http                 (D)  port 80 → redirect       no dependency on the certificate
aws_vpc_security_group_ingress_rule.alb_https   (G)  open 443     no dependency on the certificate
```

Terraform builds things in the order of these arrows. D and G have no
arrow from the certificate, so Terraform would do them immediately,
before the certificate is issued. That is the reason for two rounds.

## 3.3 Why two rounds

If you applied everything at once, Terraform would switch port 80 to
"redirect to HTTPS" immediately (step D) and then wait at step C. Until
you added the GoDaddy record, every visitor would be sent to an HTTPS
address that does not work yet.

```
Round 1:  create only the certificate           →  Pending validation
You:      add the validation record in GoDaddy
AWS:      finds the record                      →  Issued
Round 2:  create everything else                →  HTTPS is on
```

## 3.4 Check the code before applying

**Laptop:**

```powershell
terraform fmt -check -recursive
terraform validate
```

`validate` must print `Success! The configuration is valid.`

A typing mistake in `terraform.tfvars` shows up here. Example from
11 October 2026:

```
Error: Missing newline after argument
  on terraform.tfvars line 41:
  41: health_check_interval   = 30=/=
```

Three stray characters after the `30`. The fix was to change the line
back to `health_check_interval   = 30`.

## 3.5 Round 1: create the certificate

**Laptop:**

```powershell
terraform plan -target="aws_acm_certificate.app" -out=tfplan
terraform show tfplan
terraform apply tfplan
terraform output acm_validation_record
```

`-target="aws_acm_certificate.app"` means "create only this one thing
and skip the rest". The plan must end with
`Plan: 1 to add, 0 to change, 0 to destroy.`

The last command prints the record ACM wants:

```
acm_validation_record = {
  "questly.kumardevops.online" = {
    "name"  = "_00332abc3fc34b9ff31a65c51fb021b6.questly.kumardevops.online."
    "type"  = "CNAME"
    "value" = "_669a60c1a6daf9abe410c319590e1178.wzccmgtwzk.acm-validations.aws."
  }
}
```

In the **AWS Console**, **Certificate Manager → List certificates** now
shows the certificate with **Status: Pending validation** and
**In use: No**. Both are expected at this point:

| Column | Why |
|---|---|
| Pending validation | ACM is waiting for the DNS record. |
| In use: No | Nothing uses the certificate yet. The listener comes in round 2. |

## 3.6 Add the validation record in GoDaddy

**GoDaddy** → DNS → **Add New Record**:

| Field | What to enter | Example from 11 October 2026 |
|---|---|---|
| Type | `CNAME` | `CNAME` |
| Name | the `name` from the output, **without** `.kumardevops.online.` at the end | `_00332abc3fc34b9ff31a65c51fb021b6.questly` |
| Value | the `value` from the output, without the final dot | `_669a60c1a6daf9abe410c319590e1178.wzccmgtwzk.acm-validations.aws` |
| TTL | Custom → `600` seconds | |

Click **Save**.

- **Cut `.kumardevops.online.` off the Name.** GoDaddy adds it. If you
  paste the full name, the record becomes
  `...questly.kumardevops.online.kumardevops.online` and the certificate
  stays pending forever.
- **Keep the underscore** at the start of the Name and the Value.
- **This is a second record.** Do not change the `questly` record from
  Part 2. You end up with two:

| Type | Name | Purpose |
|---|---|---|
| CNAME | `questly` | Sends visitors to the load balancer. |
| CNAME | `_00332abc...questly` | Proves to AWS that you own the domain. |

Use the values from your own `terraform output`, not the example.

## 3.7 Wait until the certificate is issued

**Laptop:** check that the record is visible:

```powershell
nslookup -type=CNAME _00332abc3fc34b9ff31a65c51fb021b6.questly.kumardevops.online 8.8.8.8
```

It should show `canonical name = ...acm-validations.aws`.

Then check the certificate:

```powershell
aws acm list-certificates --query "CertificateSummaryList[?DomainName=='questly.kumardevops.online'].Status" --output text
```

| Output | Meaning |
|---|---|
| `PENDING_VALIDATION` | ACM has not seen the record yet. Wait and run it again. |
| `ISSUED` | Ready. Go to 3.8. |

You can also refresh the Certificate Manager page in the console.

It usually takes 5 to 30 minutes after the record appears. **Do not
start round 2 before it says `ISSUED`.**

## 3.8 Round 2: turn HTTPS on

A certificate alone does nothing. Round 1 created only the certificate;
the listener, the firewall rule and the redirect do not exist yet. Round
2 creates them and attaches the certificate.

**Laptop.** The same three commands as usual, this time **without**
`-target`:

```powershell
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
```

The commands look like round 1. The difference is the first line:

| Round | First command | Last line of the plan |
|---|---|---|
| 1 | `terraform plan -target="aws_acm_certificate.app" -out=tfplan` | `Plan: 1 to add, 0 to change, 0 to destroy.` |
| 2 | `terraform plan -out=tfplan` | `Plan: 4 to add, 2 to change, 1 to destroy.` |

Without `-target`, Terraform looks at everything in the code and creates
whatever is still missing.

What round 2 does:

| | What | Step in 3.2 |
|---|---|---|
| 4 to add | The waiting step, the HTTPS listener, the port 443 firewall rule, the `/api/*` rule on the HTTPS listener | C, E, G, F |
| 2 to change | Port 80 (forward becomes redirect), the description of the port 80 firewall rule | D |
| 1 to destroy | The old `/api/*` rule on port 80 | F |

The servers are not touched. If the plan wants to replace an instance,
or shows `1 to add` or `No changes`, stop and find out why.

## 3.9 Check that HTTPS is on

**Laptop:**

```powershell
curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" http://questly.kumardevops.online/
curl.exe -s -o NUL -w "%{http_code}`n" https://questly.kumardevops.online/
```

| Command | Expected |
|---|---|
| First (HTTP) | `301 https://questly.kumardevops.online:443/` |
| Second (HTTPS) | `200` |

In Certificate Manager, **Status** is **Issued** and **In use** now says
**Yes**.

See the listeners that now exist:

```powershell
aws elbv2 describe-listeners --load-balancer-arn (aws elbv2 describe-load-balancers --names questly-dev-alb --query "LoadBalancers[0].LoadBalancerArn" --output text) --query "Listeners[].[Protocol,Port,DefaultActions[0].Type]" --output table
```

Expected: `HTTP 80 redirect` and `HTTPS 443 forward`.

## 3.10 Point the frontend at the HTTPS address

The page now loads over HTTPS, but the frontend still calls the API at
an `http://` address. A secure page is not allowed to call an insecure
address, so the browser blocks it. Quiz generation stops working and the
console (`F12`) shows:

```
Mixed Content: The page at 'https://questly.kumardevops.online/dashboard/generate'
was loaded over HTTPS, but requested an insecure resource
'http://questly-dev-alb-542556956.ap-south-1.elb.amazonaws.com/api/quiz/generate'.
This request has been blocked; the content must be served over HTTPS.
```

**Agent:**

```bash
cd ~/pipeline-workspace/workspace/questly/frontend
sed -i 's|^NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online|' .env
grep NEXT_PUBLIC_API_BASE_URL .env
```

The line must be exactly:

```
NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online
```

| Value | Result |
|---|---|
| `http://questly-dev-alb-...amazonaws.com` | Blocked: mixed content. |
| `http://questly.kumardevops.online` | Blocked: mixed content. |
| `https://questly-dev-alb-...amazonaws.com` | Blocked: the certificate is for `questly.kumardevops.online`, and the address does not match it (`ERR_CERT_COMMON_NAME_INVALID`). AWS does not issue certificates for `...elb.amazonaws.com` names, so this can never work. |
| `https://questly.kumardevops.online` | **Works.** |

Changing only `http` to `https` is not enough. The host must be your
domain as well.

Then run the reload block from 1.4 and confirm the value:

```bash
kubectl get secret questly-frontend-secrets -n questly-ns -o jsonpath='{.data.NEXT_PUBLIC_API_BASE_URL}' | base64 -d; echo
kubectl get pods -n questly-ns
```

The first must print `https://questly.kumardevops.online`. Both pods
must be `Running`.

The domain never changes when the load balancer is rebuilt, so this
value stays correct from now on.

## 3.11 Final test

1. Open `https://questly.kumardevops.online` on the laptop and press
   `Ctrl+Shift+R` to reload without the saved copy.
2. Log in and generate a quiz. Open the console with `F12`; there must
   be no "Mixed Content" error.
3. Open it on a phone and a tablet. Use mobile data on one of them to
   test from a different network.
4. Type `http://questly.kumardevops.online`. It should switch to
   `https://` by itself.

## 3.12 Commit the code

The HTTPS code is already committed as `052d837`. If you write it again
from scratch, commit it after 3.11 passes:

```powershell
git add terraform/
git commit -m "Add HTTPS to the ALB with an ACM certificate and HTTP-to-HTTPS redirect"
```

`terraform.tfvars` is git-ignored and stays out of the commit.

---

# Part 4: The short version for the next rebuild

**Status: compulsory after every `terraform destroy` and `apply`.**

With the current code, HTTPS is built from the start. What survives a
destroy and what does not:

| Thing | After destroy and apply |
|---|---|
| The domain and its GoDaddy records | Still there. |
| The ACM validation record in GoDaddy | Still there, and normally still correct: ACM asks for the same record for the same domain in the same AWS account. |
| The certificate | Deleted; a new one is requested. |
| The load balancer | New, with a **new name**. |
| The servers, cluster and secrets | New and empty. |
| `frontend/.env` on your laptop | Unchanged. |

**Step 1. Laptop: check your IP and the code** (see "Before any
Terraform command" at the top).

**Step 2. Laptop: create the certificate.**

```powershell
terraform plan -target="aws_acm_certificate.app" -out=tfplan
terraform show tfplan
terraform apply tfplan
terraform output acm_validation_record
```

**Step 3. GoDaddy: compare the validation record.** If the `name` and
`value` printed in step 2 match the `_....questly` record already in
GoDaddy, do nothing. If they differ, edit that record (3.6).

**Step 4. Laptop: wait for `ISSUED`** (3.7).

**Step 5. Laptop: build everything else.**

```powershell
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
terraform output -raw alb_dns_name
```

On a fresh build the plan shows about `46 to add`.

**Step 6. GoDaddy: update the `questly` record.** Click the pencil on
the `questly` CNAME and paste the new load balancer name from step 5
(2.2). Check it with `nslookup questly.kumardevops.online 8.8.8.8`.

**Step 7. Deploy the app.** Follow
[04-after-terraform-apply.md](04-after-terraform-apply.md) from section
1. It clones the repo into the Jenkins workspace and creates both `.env`
files there, already with the HTTPS value:

```
NEXT_PUBLIC_API_BASE_URL=https://questly.kumardevops.online
```

Every `.env` value, and which one changes between the laptop and AWS, is
listed in section 8 of that guide.

**Step 8. Test** (3.9 and 3.11).

---

# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DNS_PROBE_FINISHED_NXDOMAIN` on your laptop, but `nslookup ... 8.8.8.8` works | Your provider's DNS remembered "does not exist" from a lookup made before the record was saved. | The three options in 2.3. |
| `nslookup ... 8.8.8.8` also fails | The record is wrong or not saved. | Check the Name is only `questly` and the Value has no `http://` (2.2). |
| `http://` changes to `https://` and "site can't be reached" | HTTPS is not on yet (Part 3 not done). | Do Part 3. For a quick laptop-only test, see 2.5. |
| Works on laptop, not on phone or tablet | Same cause: phones insist on HTTPS. | Do Part 3. |
| Certificate stays **Pending validation** for over an hour | The validation record is wrong. | Check the Name does not contain the domain twice, and the underscores are present (3.6). |
| Certificate says **In use: No** after it is issued | Round 2 has not been run. | 3.8. |
| Round 2 plan shows `1 to add` or `No changes` | You ran the round 1 command again, with `-target`. | Run `terraform plan -out=tfplan` with no `-target`. |
| "Mixed Content" in the console | The frontend value starts with `http://`. | 3.10. |
| `ERR_CERT_COMMON_NAME_INVALID` in the console | The frontend value is `https://` plus the load balancer name. | Use `https://questly.kumardevops.online` (3.10). |
| `502` or `503` on the site | The pods are not running, or health checks have not passed. | Agent: `kubectl get pods -n questly-ns`. Wait a minute after they are `Running`. Check target health (1.2). |
| Site does not open after a rebuild | The `questly` record still points at the old load balancer. | Part 4, step 6. |
| `error reading /frontend/.env: no such file or directory` | A path starting with `/` begins at the top of the disk. | Use `--from-env-file=.env` from inside the `frontend` folder. |
| `secrets "questly-frontend-secrets" already exists` | The old secret was not deleted first. | Run the `kubectl delete secret` line, then create again. |
| `secrets "questly-frontend-secrets" not found` on delete | It was already deleted. | Ignore it and run the create line. |
| Frontend pod shows `CreateContainerConfigError` | The secret is missing. | Run the `kubectl create secret` line from 1.4. |
| The value in the secret is right but the site still uses the old one | The pod was not restarted, or the browser is showing a saved copy. | `kubectl rollout restart deployment/frontend -n questly-ns`, then `Ctrl+Shift+R`. |
| `Error: Missing newline after argument` on `terraform.tfvars` | Stray characters on a line. | Fix the line Terraform names (3.4). |
| SSH or Jenkins times out | Your public IP changed. | Update `admin_cidrs` ([03-ssh-into-servers.md](03-ssh-into-servers.md)). |
| "Minified React error #418" in the console | A piece of text differs between the server's version of the page and the browser's. | Harmless here; the page still works. Not related to the domain or HTTPS. |

---

# Optional (production recommended)

Everything above works without this part.

## Make the bare domain open the app

So that `kumardevops.online` without `questly.` also works.

**GoDaddy** → DNS → **Forwarding** tab → add forwarding for the domain:

| Field | Value |
|---|---|
| Forward to | `https://questly.kumardevops.online` |
| Forward type | Permanent (301) |

The existing `A @` record pointed at `3.110.117.177`, an old IP that is
no longer in your AWS account. Forwarding replaces it.

## Stop editing GoDaddy after every rebuild

The `questly` record has to be updated by hand each time because the
load balancer's name changes. Production teams let AWS manage the DNS:

1. Create a hosted zone for the domain in **Route 53** (about $0.50 a
   month).
2. In GoDaddy, replace the nameservers with the four from Route 53.
3. Add Route 53 records to the Terraform: one that always points at the
   current load balancer, and one for the certificate validation.

After that, `terraform apply` handles DNS and the certificate with no
manual steps, and one apply is enough.

## Keep the certificate across rebuilds

`terraform destroy` deletes the certificate, so each rebuild waits for a
new one. A certificate costs nothing to keep. Production teams create it
once, outside the stack that gets destroyed, and only reference it.

---

# What was verified

Checked on 11 October 2026, after Part 3 was finished:

| Check | Result |
|---|---|
| `questly.kumardevops.online` in DNS | CNAME to `questly-dev-alb-542556956.ap-south-1.elb.amazonaws.com` |
| Validation record in DNS | Present |
| Certificate status | `ISSUED`, in use |
| `http://questly.kumardevops.online/` | `301` redirect to HTTPS |
| `https://questly.kumardevops.online/` | `200` |

Part 4 has not been run yet. It is the same commands in a shorter order.
The `46 to add` figure and the statement that ACM reuses the same
validation record are expectations, not results from a real rebuild.
