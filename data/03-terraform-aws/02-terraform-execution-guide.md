# Terraform Execution and Code Navigation Guide (Questly)

This guide explains what happens when you run Terraform in the
`terraform/` folder of this project, from the command in your terminal
to real resources in AWS. Every file name, variable, resource and value
below was read from this project. Nothing in AWS was changed to write it.

**How to read it:** sections 1 to 6 follow the order in which things
happen. Sections 7 to 11 show how the files connect. Sections 12 to 16
cover what comes after, how to investigate on your own, and a full
walkthrough.

**Where a fact comes from** is marked like this:

| Mark | Meaning |
|---|---|
| *Project fact* | Read directly from a file in this project. |
| *Verified* | Checked against your AWS account or laptop on 10 October 2026. |
| *Terraform behaviour* | How Terraform or the AWS provider works in general. |

---

## 1. Start Here: The Big Picture

Terraform is a program that runs **on your laptop**. It does four things:

1. Reads all your `.tf` files and joins them into one description of
   what you want.
2. Compares that description with what already exists (the **state**).
3. Works out the difference (the **plan**).
4. Sends requests to AWS, one per resource, in an order that respects
   which resource needs which (the **apply**).

Three ideas clear up most confusion:

| Idea | What it means |
|---|---|
| `.tf` files are a description, not a script | Terraform does not run them top to bottom. It reads them all, then decides the order itself. |
| The order comes from references | If resource B uses a value from resource A, Terraform creates A first. File names and line order do not matter. |
| AWS never sees your `.tf` files | Terraform turns each resource into an API request. AWS only receives those requests. |

**What this project builds** (*project fact*): 43 resources in Mumbai
(`ap-south-1`).

```
Internet
   │
   ▼
┌──────────────── PUBLIC subnets (10.0.0.0/24, 10.0.1.0/24) ───────┐
│  Load balancer (port 80)    NAT gateway    master EC2 (Jenkins)  │
└────┬──────────────────────────▲──────────────────┬───────────────┘
     │ /      → port 30080      │ outbound only    │ SSH (port 22)
     │ /api/* → port 30081      │                  ▼
┌────▼──────────── PRIVATE subnets (10.0.10.0/24, 10.0.11.0/24) ───┐
│  agent EC2: kind cluster with the frontend and backend           │
└──────────────────────────────────────────────────────────────────┘
```

It creates its own VPC. It does not use the AWS default VPC.

---

## 2. Understand the Actual Project Folder

*Project fact.* This is everything in `terraform/`:

```
terraform/
├── versions.tf               Terraform version, AWS provider version, S3 backend
├── providers.tf              How to talk to AWS (region, default tags)
├── variables.tf              Declares 42 input variables (no values)
├── terraform.tfvars          The values for those 42 variables (git-ignored)
├── terraform.tfvars.example  A template with placeholders (not loaded)
├── network.tf                VPC, subnets, internet gateway, NAT, routes
├── security.tf               3 security groups and 12 rules
├── iam.tf                    Role and instance profile for Session Manager
├── compute.tf                AMI lookup, key pair, master, agent, Elastic IP
├── alb.tf                    Load balancer, target groups, listener, rule
├── outputs.tf                3 helper values and 11 outputs
├── scripts/
│   ├── master-userdata.sh    Runs inside the master on first boot
│   └── agent-userdata.sh     Runs inside the agent on first boot
├── backend.hcl               Where the state lives (git-ignored)
├── .terraform.lock.hcl       Exact provider version that was installed
├── .terraform/               Downloaded provider + backend settings
└── tfplan                    A saved plan file (git-ignored, single use)
```

There are no modules. Everything is in one folder, which Terraform calls
the **root module**.

**Names you might expect that do not exist here:**

| Common name | This project uses |
|---|---|
| `provider.tf` | `providers.tf` |
| `data.tf` | No such file. The 3 data sources live in `network.tf`, `iam.tf` and `compute.tf`. |
| `keypair.tf`, `ec2.tf` | `compute.tf` |
| `security-groups.tf` | `security.tf` |

Terraform does not care what the files are called. Only the `.tf`
ending matters.

### The kinds of things inside the files

| Kind | Looks like | What it is | Count here |
|---|---|---|---|
| Settings | `terraform { ... }` | Which Terraform and provider versions to use, and where state is stored. | 1 block |
| Provider | `provider "aws" { ... }` | How to connect to AWS. It creates nothing. | 1 |
| Variable | `variable "x" { ... }` | An input slot. It has a name and a type but no value. | 42 |
| Local | `locals { x = ... }` | A value the code works out from other values. | 7 |
| Data source | `data "type" "name" { ... }` | Looks something up. It reads; it never creates. | 3 |
| Resource | `resource "type" "name" { ... }` | Something Terraform should create and manage. | 39 blocks → 43 resources |
| Output | `output "x" { ... }` | A value printed after apply. | 11 |

39 resource blocks become 43 resources because four blocks use
`for_each` and make two copies each (section 7).

### Which files Terraform loads, and which it does not

| File | Loaded as configuration? | Role |
|---|---|---|
| All 9 `.tf` files | Yes, all together | The description of what you want. |
| `terraform.tfvars` | Yes, automatically | Supplies values for variables. It is data, not a script. |
| `terraform.tfvars.example` | No | The name does not match a pattern Terraform loads. It is only a template for people. |
| `scripts/*.sh` | Only when a `templatefile()` call reads them | Text that is handed to EC2 as user data. |
| `backend.hcl` | Only when you pass it to `terraform init` | Tells Terraform which S3 bucket holds the state. |
| `.terraform.lock.hcl` | Read by `init` | Pins the provider version. |
| `.terraform/` | Used by every command | Holds the downloaded provider program. |
| `tfplan` | Only when you run `terraform apply tfplan` | A saved plan. |

---

## 3. What Happens Before `terraform apply`

Four things must already be in place.

### 3.1 AWS credentials

*Verified.* Your access key is stored in
`C:\Users\kumar\.aws\credentials`. It belongs to the IAM user `questly`
in account `190633266826`.

*Project fact.* `providers.tf` contains no keys:

```hcl
provider "aws" {
  region = var.aws_region
  ...
}
```

*Terraform behaviour.* When the provider block has no keys, the AWS
provider looks in the standard places, in order: environment variables
such as `AWS_ACCESS_KEY_ID`, then the `~/.aws/credentials` file. That is
how it finds yours. Every request to AWS is signed with that key, and
AWS allows or denies it based on the permissions of the user `questly`.

### 3.2 The SSH public key file

*Project fact.* `compute.tf` reads `~/.ssh/id_ed25519.pub` from your
laptop. If that file is missing, `plan` fails before anything is sent to
AWS.

### 3.3 The values in `terraform.tfvars`

*Project fact.* None of the 42 variables in `variables.tf` has a
default. The top of the file says so:

```hcl
# No defaults here on purpose: every value comes from terraform.tfvars
```

So if `terraform.tfvars` is missing a value, Terraform stops and asks
you to type it.

### 3.4 The state bucket

*Verified.* The S3 bucket `questly-terraform-state-190633266826` exists.
`backend.hcl` points to it. Terraform does not create this bucket; it
was created by hand with the AWS CLI.

---

## 4. Stage 1: `terraform init`

Command used in this project, run from the `terraform` folder:

```powershell
terraform init -backend-config="backend.hcl"
```

`init` prepares the folder. **It creates nothing in AWS.**

| Step | What Terraform does | Project file involved |
|---|---|---|
| 1 | Treats the current folder as the working directory and reads every `.tf` file in it. | all `.tf` files |
| 2 | Finds the `terraform { }` block and checks your Terraform version against `required_version = ">= 1.6.0"`. *Verified:* you have 1.13.4. | `versions.tf` line 2 |
| 3 | Sets up the backend. `backend "s3" {}` is empty, so the bucket, key and region come from `backend.hcl`. Terraform connects to the bucket using your AWS credentials. | `versions.tf` line 23, `backend.hcl` |
| 4 | Reads `required_providers` and sees it needs `hashicorp/aws` at version `~> 6.0`. | `versions.tf` lines 4-9 |
| 5 | Checks `.terraform.lock.hcl`. It records version `6.68.0`, so Terraform installs exactly that one. | `.terraform.lock.hcl` |
| 6 | Downloads the provider from `registry.terraform.io` into `.terraform/providers/`, or reuses it if it is already there. | `.terraform/` |

**Terms:**

- **Provider**: a separate program that knows how to talk to one
  platform. *Verified:* yours is
  `.terraform/providers/registry.terraform.io/hashicorp/aws/6.68.0/windows_amd64/terraform-provider-aws_v6.68.0_x5.exe`.
  Terraform itself knows nothing about AWS; it starts this program and
  asks it to do the work.
- **`~> 6.0`**: any version 6.x, but not 7.0.
- **Lock file**: without it, two people could get different 6.x
  versions. With it, everyone gets 6.68.0. That is why it is committed
  to git.
- **Backend**: where the state is stored. Here it is S3, not a file on
  your laptop.
- **`.terraform/terraform.tfstate`**: despite the name, this small file
  is **not** your state. It only remembers which backend this folder is
  connected to. The real state is in S3 at
  `questly/dev/terraform.tfstate`.

You run `init` once, and again only when the provider version or the
backend changes.

---

## 5. Stage 2: `terraform plan`

```powershell
terraform plan -out=tfplan
```

`plan` works out what would change. **It creates nothing in AWS.** It
only reads.

### 5.1 Load the configuration

*Terraform behaviour.* Terraform reads all nine `.tf` files and merges
them into one configuration in memory. From this point on, the file
boundaries are gone. `aws_vpc.main` is simply "a resource", no matter
which file it came from. There is no "first file".

### 5.2 Give the variables their values

For each `variable` block, Terraform looks for a value. These are the
places it checks, from weakest to strongest. A later one overrides an
earlier one.

| Order | Source | Used in this project? |
|---|---|---|
| 1 | `default` inside the `variable` block | No. There are none. |
| 2 | Environment variables named `TF_VAR_<name>` | Not set. |
| 3 | `terraform.tfvars` | **Yes. All 42 values come from here.** |
| 4 | `*.auto.tfvars` files | None exist. |
| 5 | `-var` or `-var-file` on the command line | Not used. |

Example of one value arriving:

```
terraform.tfvars line 7:   project_name = "questly"
          │
          ▼
variables.tf:              variable "project_name" { type = string }
          │
          ▼
anywhere in the code:      var.project_name   →   "questly"
```

Terraform also checks each value against the variable's `type` and any
`validation` block. For example, `variables.tf` rejects `0.0.0.0/0` in
`admin_cidrs`, so you cannot open SSH to the whole internet by mistake.

### 5.3 Configure the provider

```hcl
# providers.tf
provider "aws" {
  region = var.aws_region          # "ap-south-1"

  default_tags {
    tags = {
      Project     = var.project_name     # "questly"
      Environment = var.environment      # "dev"
      ManagedBy   = var.managed_by_tag   # "terraform"
    }
  }
}
```

Terraform starts the provider program and hands it these settings. From
now on every request goes to the Mumbai region, and every resource that
supports tags gets these three tags without any resource asking for
them.

### 5.4 Read the data sources

A data source asks a question; it does not create anything. This project
has three.

| Data source | File | What it asks | Talks to AWS? | Answer |
|---|---|---|---|---|
| `data.aws_availability_zones.available` | `network.tf` | Which availability zones are available in this region? | Yes | A list of names. *Verified:* the first two are `ap-south-1a` and `ap-south-1b`. |
| `data.aws_ssm_parameter.ubuntu_ami` | `compute.tf` | What is stored under the parameter name in `var.ami_ssm_parameter`? | Yes | The ID of the newest Ubuntu 24.04 image, published by Canonical. |
| `data.aws_iam_policy_document.ec2_assume_role` | `iam.tf` | None. It builds a JSON text from the block. | No | A JSON policy that lets EC2 use the role. |

Because none of these depends on a resource that does not exist yet,
Terraform can read them during `plan`.

### 5.5 Evaluate the expressions

Terraform now works out every value it can. Some are known immediately:

```
local.name                 →  "questly-dev"
"${local.name}-vpc"        →  "questly-dev-vpc"
var.master_instance_type   →  "t3.medium"
```

Others cannot be known until AWS creates something:

```
aws_vpc.main.id            →  (known after apply)
```

AWS chooses the VPC's ID when it creates the VPC. So in the plan, every
value built from that ID also shows as `(known after apply)`. This is
normal.

### 5.6 Build the dependency graph

Terraform scans every block for references to other blocks. Each
reference becomes an arrow: "this needs that first". Section 9 shows the
full graph for this project.

### 5.7 Compare with the state and with AWS

For every resource in the configuration, Terraform asks three
questions:

| Is it in the state? | Does it match the code? | Plan says |
|---|---|---|
| No | - | `+ create` |
| Yes | Yes | no change |
| Yes | No, and the setting can be changed in place | `~ update in-place` |
| Yes | No, and the setting cannot be changed | `-/+ destroy and then create replacement` |
| In state but removed from the code | - | `- destroy` |

Before comparing, Terraform asks AWS for the current settings of every
resource already in the state. This is called a **refresh**. It catches
changes someone made by hand in the AWS Console.

*Verified.* With an empty state, this project's plan ends with:

```
Plan: 43 to add, 0 to change, 0 to destroy.
```

### 5.8 Save the plan

`-out=tfplan` writes the plan to the file `tfplan`. A plan is a
**proposal**. Nothing has been done yet.

---

## 6. Stage 3: `terraform apply`, Step by Step

There are two ways to apply. Both end the same way.

| Command | What happens |
|---|---|
| `terraform apply` | Makes a fresh plan, shows it, and waits for you to type `yes`. Typing anything else cancels. |
| `terraform apply tfplan` | Applies the saved plan file exactly. It does not ask, because you already reviewed that file. If anything changed since the plan was made, Terraform refuses the file. |
| `terraform apply -auto-approve` | Makes a fresh plan and applies it without asking. Avoid it when working by hand. |

This project's guides use `terraform plan -out=tfplan`, then
`terraform show tfplan`, then `terraform apply tfplan`.

### What happens after approval

| Step | What happens | Where it happens |
|---|---|---|
| 1 | Terraform locks the state. It writes `terraform.tfstate.tflock` into the S3 bucket so no one else can apply at the same time (`use_lockfile = true` in `backend.hcl`). | Laptop → S3 |
| 2 | Terraform loads the plan and the dependency graph. | Laptop |
| 3 | It finds every resource that needs nothing else. Here that is four: `aws_vpc.main`, `aws_eip.nat`, `aws_key_pair.main` and `aws_iam_role.ec2`. | Laptop |
| 4 | It asks the provider to create them, **in parallel**. Terraform runs up to 10 operations at once by default. | Laptop |
| 5 | The provider turns each one into an AWS API request, signs it with your access key, and sends it over HTTPS. | Laptop → AWS |
| 6 | AWS checks the signature, checks that the user `questly` is allowed to do this, checks the values, and creates the resource. It replies with the new resource's ID and settings. | AWS |
| 7 | Some resources take time. The provider keeps asking AWS "is it ready?" until it is. A NAT gateway takes a minute or two. You see lines like `Still creating... [10s elapsed]`. | Laptop ↔ AWS |
| 8 | Terraform records the finished resource and all its settings in the state. | Laptop → S3 |
| 9 | Resources that were waiting for that one are now free to start. For example, once the VPC exists, the subnets, the internet gateway and the security groups can begin. | Laptop |
| 10 | Steps 4 to 9 repeat until every resource is done. | |
| 11 | Terraform works out the outputs, saves the final state, removes the lock, and prints `Apply complete!` followed by the outputs. | Laptop → S3 |

**The exact order can differ between runs.** Only the arrows in the
dependency graph are guaranteed. Two resources with no arrow between
them may finish in either order.

**If one resource fails**, Terraform stops starting new work. Everything
that depends on the failed resource is skipped. Resources already
created stay created and stay in the state. After you fix the problem,
the next plan only contains what is still missing.

### One real chain from this project

This is the longest chain. It explains why the agent is one of the last
things created.

```
aws_vpc.main
   │  network.tf line 43:  vpc_id = aws_vpc.main.id
   ▼
aws_subnet.public["ap-south-1a"]
   │  network.tf line 83:  subnet_id = aws_subnet.public[local.azs[0]].id
   ▼
aws_nat_gateway.main        (also needs aws_eip.nat and the internet gateway)
   │  network.tf line 117: nat_gateway_id = aws_nat_gateway.main.id
   ▼
aws_route_table.private
   │  network.tf line 127: route_table_id = aws_route_table.private.id
   ▼
aws_route_table_association.private   (2 copies)
   │  compute.tf line 102: depends_on = [aws_route_table_association.private]
   ▼
aws_instance.agent
   │  alb.tf lines 56, 62: target_id = aws_instance.agent.id
   ▼
aws_lb_target_group_attachment.frontend and .backend
```

The last arrow into the agent is written by hand with `depends_on`. The
agent's settings do not use any value from the route table, so Terraform
would not see the link on its own. But the agent's boot script downloads
packages from the internet, and a private instance can only reach the
internet once the route through the NAT gateway exists. The comment in
the code says exactly this:

```hcl
# Packages are downloaded through the NAT gateway at first boot
depends_on = [aws_route_table_association.private]
```

---

## 7. How Terraform Connects Every `.tf` File

### Diagram A: how the files feed each other

```
terraform.tfvars  ──values──►  variables.tf  ──►  var.<name>
(42 values)                    (42 slots)             │
                                                      │ used in every file below
        ┌─────────────────────────────────────────────┤
        ▼                                             ▼
   providers.tf                              network.tf  locals
   region + default tags                     local.name, local.azs,
        │                                    local.public_subnets,
        │ applies to every resource          local.private_subnets
        ▼                                             │
┌───────────────────────────────────────────────────────────────────┐
│ network.tf    aws_vpc.main, subnets, gateways, route tables       │
│      │ aws_vpc.main.id               │ aws_subnet.public[...].id  │
│      ▼                               ▼                            │
│ security.tf   3 security groups + 12 rules                        │
│      │ aws_security_group.<x>.id                                  │
│      ▼                                                            │
│ compute.tf    key pair, master, agent, Elastic IP                 │
│      ▲                │ aws_instance.agent.id                     │
│      │                ▼                                           │
│ iam.tf        alb.tf   load balancer, target groups, listener     │
│ instance profile                                                  │
│                                                                   │
│ scripts/*.sh ──templatefile()──► user_data of master and agent    │
└───────────────────────────────────────────────────────────────────┘
        │ aws_eip.master.public_ip, aws_lb.app.dns_name, ...
        ▼
   outputs.tf   ──►   printed after apply
```

**In plain words:** values enter through `terraform.tfvars`. The code
reads them as `var.something`. A few are combined into locals. Resources
use variables, locals and each other's results. Outputs pick some of
those results and print them.

The arrows show **which value is used where**. They do not show files
running one after another. `terraform.tfvars` does not "run"
`network.tf`, and `network.tf` does not run after `variables.tf` because
of its name.

### How to read a reference

Every reference is an address. Once you can read the address, you know
which block to look for.

| You see | It points to | Where to find it |
|---|---|---|
| `var.vpc_cidr` | `variable "vpc_cidr"` | declared in `variables.tf`, value in `terraform.tfvars` |
| `local.name` | `name = ...` inside a `locals { }` block | `network.tf` line 15 |
| `local.alb_url` | `alb_url = ...` inside a `locals { }` block | `outputs.tf` line 6 |
| `data.aws_ssm_parameter.ubuntu_ami.value` | `data "aws_ssm_parameter" "ubuntu_ami"` | `compute.tf` line 2 |
| `aws_vpc.main.id` | `resource "aws_vpc" "main"` | `network.tf` line 22 |
| `aws_subnet.public["ap-south-1a"].id` | one copy of `resource "aws_subnet" "public"` | `network.tf` line 40 |
| `each.key`, `each.value` | the current item of the `for_each` in the same block | the same block |
| `path.module` | the folder that holds the `.tf` files | `terraform/` |

The pattern for a resource is always `TYPE.NAME.ATTRIBUTE`. The type and
name are the two quoted words after `resource`. To find a block, search
all files for `"NAME"`.

### Where locals live

Locals can be defined in any file and used in every file. This project
has two `locals` blocks:

| Local | Defined in | Used in |
|---|---|---|
| `local.name` | `network.tf` | all five resource files |
| `local.azs` | `network.tf` | `network.tf`, `compute.tf` |
| `local.public_subnets`, `local.private_subnets` | `network.tf` | `network.tf` |
| `local.ssh_private_key_path`, `local.ssh_jump`, `local.alb_url` | `outputs.tf` | `outputs.tf` |

### Expressions explained from the inside out

**1. The name prefix** (`network.tf` line 15)

```hcl
name = "${var.project_name}-${var.environment}"
```

| Piece | Meaning | Value |
|---|---|---|
| `var.project_name` | value from tfvars | `questly` |
| `var.environment` | value from tfvars | `dev` |
| `"${...}-${...}"` | put both into one text with a dash | `questly-dev` |

**2. Picking the availability zones** (`network.tf` line 16)

```hcl
azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
```

| Piece | Meaning | Value |
|---|---|---|
| `data.aws_availability_zones.available.names` | list of zone names from AWS | `["ap-south-1a", "ap-south-1b", ...]` |
| `var.az_count` | value from tfvars | `2` |
| `slice(list, 0, 2)` | keep items from position 0 up to, not including, 2 | `["ap-south-1a", "ap-south-1b"]` |

**3. Working out the subnet ranges** (`network.tf` line 18)

```hcl
public_subnets = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, var.subnet_newbits, i + var.public_subnet_offset) }
```

Read it as: "for each zone, with its position `i`, make an entry
`zone => range`".

| Piece | Meaning | Value |
|---|---|---|
| `for i, az in local.azs` | go through the zones; `i` is 0, then 1 | `0, "ap-south-1a"` then `1, "ap-south-1b"` |
| `var.vpc_cidr` | the whole network | `10.0.0.0/16` |
| `var.subnet_newbits` | how much smaller each subnet is | `8`, so `/16` becomes `/24` |
| `i + var.public_subnet_offset` | which `/24` to take | `0 + 0 = 0`, then `1 + 0 = 1` |
| `cidrsubnet("10.0.0.0/16", 8, 0)` | the 0th `/24` | `10.0.0.0/24` |
| `cidrsubnet("10.0.0.0/16", 8, 1)` | the 1st `/24` | `10.0.1.0/24` |

Result:

```
local.public_subnets  = { "ap-south-1a" = "10.0.0.0/24",  "ap-south-1b" = "10.0.1.0/24"  }
local.private_subnets = { "ap-south-1a" = "10.0.10.0/24", "ap-south-1b" = "10.0.11.0/24" }
```

The private ones start at 10 because `private_subnet_offset = 10`.

**4. `for_each`: one block, several resources** (`network.tf` line 40)

```hcl
resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value
  ...
}
```

`for_each` makes one copy of the block for every entry.

| Copy's address | `each.key` | `each.value` |
|---|---|---|
| `aws_subnet.public["ap-south-1a"]` | `ap-south-1a` | `10.0.0.0/24` |
| `aws_subnet.public["ap-south-1b"]` | `ap-south-1b` | `10.0.1.0/24` |

This project uses `for_each` in seven places:

| Block | Goes through | Copies |
|---|---|---|
| `aws_subnet.public` | `local.public_subnets` | 2 |
| `aws_subnet.private` | `local.private_subnets` | 2 |
| `aws_route_table_association.public` | `aws_subnet.public` (the 2 subnets) | 2 |
| `aws_route_table_association.private` | `aws_subnet.private` | 2 |
| `aws_vpc_security_group_ingress_rule.alb_http` | `toset(var.app_ingress_cidrs)` | 1 |
| `aws_vpc_security_group_ingress_rule.master_ssh` | `toset(var.admin_cidrs)` | 1 |
| `aws_vpc_security_group_ingress_rule.master_jenkins` | `toset(var.admin_cidrs)` | 1 |

`toset(...)` turns a list into a set, which `for_each` needs. If you put
two IPs in `admin_cidrs`, you get two SSH rules and two Jenkins rules
with no change to the code.

**5. Picking one subnet** (`compute.tf` line 18)

```hcl
subnet_id = aws_subnet.public[local.azs[0]].id
```

| Piece | Meaning | Value |
|---|---|---|
| `local.azs[0]` | first zone in the list | `ap-south-1a` |
| `aws_subnet.public["ap-south-1a"]` | that copy of the subnet | the public subnet `10.0.0.0/24` |
| `.id` | its ID, given by AWS | `subnet-...` (known after apply) |

So the master goes into the first public subnet. The agent uses
`aws_subnet.private[local.azs[0]].id`, the first private subnet.

**6. All public subnets as a list** (`alb.tf` line 17)

```hcl
subnets = [for s in aws_subnet.public : s.id]
```

"Go through both public subnets and collect each one's ID." The result
is a list of two IDs. The load balancer needs subnets in at least two
zones, which is why `variables.tf` rejects `az_count` below 2.

**7. The public key** (`compute.tf` line 8)

```hcl
public_key = file(pathexpand(var.ssh_public_key_path))
```

| Step | Piece | Result |
|---|---|---|
| 1 | `var.ssh_public_key_path` | `~/.ssh/id_ed25519.pub` |
| 2 | `pathexpand(...)` replaces `~` with your home folder | `C:\Users\kumar\.ssh\id_ed25519.pub` |
| 3 | `file(...)` reads the file's text | `ssh-ed25519 AAAA... kumar@KumarVictus2004` |
| 4 | `public_key =` gives that text to the key pair resource | sent to AWS, stored as `questly-dev-key` |

Steps 1 to 3 happen on your laptop. Only the text of the public key is
sent to AWS. The private key file is never read.

**8. The user-data script** (`compute.tf` line 23)

```hcl
user_data = templatefile("${path.module}/scripts/master-userdata.sh", {
  java_package = var.java_package
  ...
})
```

| Step | Piece | Result |
|---|---|---|
| 1 | `path.module` | the `terraform` folder |
| 2 | `"${path.module}/scripts/master-userdata.sh"` | the full path of the script |
| 3 | `templatefile(path, { ... })` reads the file and replaces any `${name}` placeholders with the values given | the final script text |
| 4 | `user_data =` gives that text to the instance | sent to AWS when the instance is launched |

Section 11 has an important note about step 3.

**9. A value chosen by a condition** (`outputs.tf` line 6)

```hcl
alb_url = var.alb_listener_port == 80 ? "http://${aws_lb.app.dns_name}" : "http://${aws_lb.app.dns_name}:${var.alb_listener_port}"
```

The shape is `CONDITION ? VALUE_IF_TRUE : VALUE_IF_FALSE`.

| Piece | Value |
|---|---|
| `var.alb_listener_port == 80` | `80 == 80`, so true |
| chosen value | `"http://${aws_lb.app.dns_name}"` |
| result | `http://<load balancer address>` with no `:80` at the end |

**10. Removing a file ending** (`outputs.tf` line 3)

```hcl
ssh_private_key_path = trimsuffix(var.ssh_public_key_path, ".pub")
```

`~/.ssh/id_ed25519.pub` with `.pub` cut off is `~/.ssh/id_ed25519`. The
outputs use it to print a ready-made `ssh -i ...` command.

**11. Settings that tell Terraform to look away** (`compute.tf` line 47)

```hcl
lifecycle {
  ignore_changes = [ami, user_data]
}
```

Canonical publishes a new Ubuntu image regularly, so the AMI lookup
returns a different ID over time. Without this block, Terraform would
want to destroy and rebuild both servers each time. With it, changes to
`ami` and `user_data` are ignored once the instance exists.

---

## 8. Trace the Actual Values Across Files

All values are from `terraform.tfvars` as it is today.

| Original source | Terraform expression | Intermediate value | Final consumer | Result in AWS |
|---|---|---|---|---|
| tfvars `project_name = "questly"`, `environment = "dev"` | `local.name` (`network.tf`) | `questly-dev` | `tags`, `name` and `key_name` in every resource file | Names such as `questly-dev-vpc`, `questly-dev-master`, `questly-dev-alb`, `questly-dev-key` |
| tfvars `project_name`, `environment`, `managed_by_tag` | `default_tags` (`providers.tf`) | `Project=questly`, `Environment=dev`, `ManagedBy=terraform` | the provider | These 3 tags on every taggable resource |
| tfvars `aws_region = "ap-south-1"` | `var.aws_region` (`providers.tf`) | `ap-south-1` | the provider | Every request goes to Mumbai |
| tfvars `vpc_cidr = "10.0.0.0/16"` | `var.vpc_cidr` (`network.tf`) | `10.0.0.0/16` | `aws_vpc.main` | A VPC with that address range |
| tfvars `vpc_cidr`, `subnet_newbits = 8`, offsets `0` and `10` | `local.public_subnets`, `local.private_subnets` | `10.0.0.0/24`, `10.0.1.0/24`, `10.0.10.0/24`, `10.0.11.0/24` | `aws_subnet.public`, `aws_subnet.private` | 4 subnets |
| AWS (list of zones) + tfvars `az_count = 2` | `local.azs` | `ap-south-1a`, `ap-south-1b` | subnets, master, agent, NAT | Which zone each thing is in |
| AWS (VPC ID, chosen at creation) | `aws_vpc.main.id` | `vpc-...` | subnets, gateway, route tables, 3 security groups, 2 target groups | All of them belong to this VPC |
| tfvars `ami_ssm_parameter` | `data.aws_ssm_parameter.ubuntu_ami.value` | `ami-...` (newest Ubuntu 24.04) | `aws_instance.master`, `aws_instance.agent` | Both servers start from that image |
| tfvars `master_instance_type = "t3.medium"` | `var.master_instance_type` | `t3.medium` | `aws_instance.master` | Server size |
| tfvars `agent_instance_type = "t3.medium"` | `var.agent_instance_type` | `t3.medium` | `aws_instance.agent` | Server size |
| tfvars `master_volume_size = 18`, `agent_volume_size = 18`, `root_volume_type = "gp3"` | `root_block_device` | 18 GiB, gp3, encrypted | both instances | Each server's disk |
| tfvars `ssh_public_key_path` + the file on your laptop | `file(pathexpand(...))` | the public key text | `aws_key_pair.main` | Key pair `questly-dev-key` |
| `aws_key_pair.main` | `aws_key_pair.main.key_name` | `questly-dev-key` | both instances | The key is installed for the user `ubuntu` |
| tfvars `admin_cidrs = ["223.185.129.177/32"]` | `toset(var.admin_cidrs)` then `each.value` | `223.185.129.177/32` | `master_ssh`, `master_jenkins` rules | Only that IP reaches ports 22 and 8080 on the master |
| tfvars `ssh_port = 22`, `jenkins_port = 8080` | `var.ssh_port`, `var.jenkins_port` | `22`, `8080` | security group rules, outputs | Which ports are open |
| tfvars `frontend_node_port = 30080`, `backend_node_port = 30081` | `var.frontend_node_port`, `var.backend_node_port` | `30080`, `30081` | target groups, attachments, security rules | The load balancer forwards to these ports on the agent |
| tfvars `api_path_pattern = "/api/*"` | `var.api_path_pattern` | `/api/*` | `aws_lb_listener_rule.api` | Requests under `/api/` go to the backend |
| AWS (security group IDs) | `aws_security_group.agent.id` and others | `sg-...` | instances, load balancer, rules that name another group | Who may talk to whom |
| AWS (Elastic IP) | `aws_eip.master.public_ip` | a public IP | outputs `master_public_ip`, `jenkins_url`, `ssh_master` | Printed after apply |
| AWS (load balancer address) | `aws_lb.app.dns_name` then `local.alb_url` | `http://questly-dev-alb-....elb.amazonaws.com` | outputs `app_url`, `next_public_api_base_url` | Printed after apply |

*Note.* `t3.medium` and `18` are what `terraform.tfvars` says now. This
guide did not check whether the instances running today were created
with those values. `terraform plan` will tell you (section 13).

---

## 9. Understand the Resource Dependency Graph

### Diagram C: the real graph

An arrow means "must exist first". Items on the same row with no arrow
between them can be created at the same time.

```
WAVE 1 (need nothing)
  aws_vpc.main        aws_eip.nat        aws_key_pair.main        aws_iam_role.ec2
      │                   │                    │                        │
      │                   │                    │              ┌─────────┴──────────┐
      │                   │                    │              ▼                    ▼
      │                   │                    │   aws_iam_instance_profile.ec2   aws_iam_role_policy_attachment.ssm
      │                   │                    │              │
WAVE 2 (need the VPC)     │                    │              │
  ├─► aws_internet_gateway.main                │              │
  ├─► aws_subnet.public  (2)                   │              │
  ├─► aws_subnet.private (2)                   │              │
  ├─► aws_security_group.alb / .master / .agent ──► 12 rules  │
  └─► aws_lb_target_group.frontend / .backend  │              │
                          │                    │              │
WAVE 3                    ▼                    │              │
  aws_route_table.public            (VPC + internet gateway)  │
  aws_nat_gateway.main              (EIP + public subnet a + internet gateway*)
  aws_lb.app                        (alb security group + both public subnets)
  aws_instance.master  ◄───────────────────────┴──────────────┤
        (AMI + public subnet a + master security group + key pair + profile)
                          │                                   │
WAVE 4                    ▼                                   │
  aws_route_table_association.public (2)                      │
  aws_route_table.private           (VPC + NAT gateway)       │
  aws_eip.master                    (master + internet gateway*)
  aws_lb_listener.http              (load balancer + frontend target group)
                          │                                   │
WAVE 5                    ▼                                   │
  aws_route_table_association.private (2)                     │
  aws_lb_listener_rule.api          (listener + backend target group)
                          │                                   │
WAVE 6                    ▼                                   │
  aws_instance.agent  ◄───────────────────────────────────────┘
        (AMI + private subnet a + agent security group + key pair + profile
         + private route table associations*)
                          │
WAVE 7                    ▼
  aws_lb_target_group_attachment.frontend / .backend   (target group + agent)

  * written by hand with depends_on
```

**In plain words:** the "waves" are only a way to draw it. Terraform
does not use waves. It starts each resource the moment everything it
points to is finished. The NAT gateway is slow, so the things after it
(private route table, agent, target group attachments) are usually the
last to finish.

### The two kinds of dependency

**Implicit:** the block uses a value from another block. Terraform sees
the reference and adds the arrow itself. Almost every arrow here is this
kind.

```hcl
# security.tf line 16: the security group needs the VPC
vpc_id = aws_vpc.main.id
```

**Explicit:** you write `depends_on` because there is a real-world need
that no value shows. This project has three:

| Resource | `depends_on` | Why |
|---|---|---|
| `aws_nat_gateway.main` (`network.tf`) | `aws_internet_gateway.main` | A NAT gateway only works once the VPC has an internet gateway. |
| `aws_eip.master` (`compute.tf`) | `aws_internet_gateway.main` | A public IP can only be attached in a VPC that has an internet gateway. |
| `aws_instance.agent` (`compute.tf`) | `aws_route_table_association.private` | The boot script needs internet access through the NAT gateway. |

### What does not create a dependency

| Code | Why there is no arrow to a resource |
|---|---|
| `tags = { Name = "${local.name}-vpc" }` | `local.name` is built from two variables. No resource is involved. |
| `instance_type = var.master_instance_type` | A plain input value. |
| `public_key = file(...)` | Reads a file on your laptop. Not an AWS resource. |
| `user_data = templatefile(...)` | Reads a file on your laptop. Not an AWS resource. |
| `assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json` | The data source builds text locally. No AWS call. |

### What each important resource waits for

| Resource | Needs first | Kind | Can run alongside |
|---|---|---|---|
| `aws_vpc.main` | nothing | - | EIP for NAT, key pair, IAM role |
| `aws_subnet.public` / `.private` | VPC (and the zone list) | implicit | gateway, security groups, target groups |
| `aws_security_group.*` | VPC | implicit | subnets, gateway |
| The 12 security group rules | the group they belong to, and the group they name | implicit | each other |
| `aws_nat_gateway.main` | EIP, public subnet a, internet gateway | implicit + explicit | master, load balancer |
| `aws_route_table.private` | VPC, NAT gateway | implicit | listener, Elastic IP for master |
| `aws_instance.master` | AMI lookup, public subnet a, master security group, key pair, instance profile | implicit | NAT gateway, load balancer |
| `aws_eip.master` | master, internet gateway | implicit + explicit | - |
| `aws_instance.agent` | AMI lookup, private subnet a, agent security group, key pair, instance profile, private route associations | implicit + explicit | - |
| `aws_lb.app` | ALB security group, both public subnets | implicit | master, NAT gateway |
| `aws_lb_listener.http` | load balancer, frontend target group | implicit | - |
| `aws_lb_target_group_attachment.*` | target group, agent | implicit | each other |

---

## 10. What Terraform Sends to AWS

Your `.tf` files stay on your laptop. For each resource, the provider
builds one or more API requests from the evaluated values. AWS runs the
request and replies. Terraform stores the reply in the state.

The operation names below are the standard AWS API operations for each
resource type. They were not captured from a log of your run.

| Resource in the code | What Terraform reads | AWS operation | What AWS returns | Saved in state and used by |
|---|---|---|---|---|
| `data.aws_availability_zones.available` | `state = "available"` | `DescribeAvailabilityZones` (read only) | zone names | `local.azs` |
| `data.aws_ssm_parameter.ubuntu_ami` | the parameter name | `GetParameter` (read only) | an AMI ID | both instances |
| `aws_vpc.main` | CIDR, DNS settings, tags | `CreateVpc`, then `ModifyVpcAttribute` | VPC ID | everything with `vpc_id` |
| `aws_internet_gateway.main` | VPC ID | `CreateInternetGateway`, `AttachInternetGateway` | gateway ID | public route table |
| `aws_subnet.*` | VPC ID, zone, CIDR | `CreateSubnet` | subnet ID | instances, NAT, load balancer, associations |
| `aws_eip.nat`, `aws_eip.master` | `domain = "vpc"` | `AllocateAddress`, and `AssociateAddress` for the master | a public IP | NAT gateway; outputs |
| `aws_nat_gateway.main` | EIP, subnet | `CreateNatGateway` | NAT gateway ID | private route table |
| `aws_route_table.*` | VPC ID and one route | `CreateRouteTable`, `CreateRoute` | route table ID | associations |
| `aws_route_table_association.*` | subnet ID, route table ID | `AssociateRouteTable` | association ID | the agent (through `depends_on`) |
| `aws_security_group.*` | name, description, VPC ID | `CreateSecurityGroup` | group ID | instances, load balancer, rules |
| `aws_vpc_security_group_ingress_rule.*` / `egress_rule.*` | group, port, source or destination | `AuthorizeSecurityGroupIngress` / `AuthorizeSecurityGroupEgress` | rule ID | - |
| `aws_iam_role.ec2` | name, trust policy JSON | `CreateRole` | role name and ARN | attachment, instance profile |
| `aws_iam_role_policy_attachment.ssm` | role, policy ARN | `AttachRolePolicy` | - | - |
| `aws_iam_instance_profile.ec2` | name, role | `CreateInstanceProfile`, `AddRoleToInstanceProfile` | profile name | both instances |
| `aws_key_pair.main` | name, public key text | `ImportKeyPair` | key name and fingerprint | both instances |
| `aws_instance.master`, `.agent` | AMI, size, subnet, security group, key name, profile, user data, disk | `RunInstances` | instance ID, private IP | Elastic IP, target group attachments, outputs |
| `aws_lb.app` | name, security group, subnets | `CreateLoadBalancer` | ARN and DNS name | listener, outputs |
| `aws_lb_target_group.*` | name, port, VPC, health check | `CreateTargetGroup` | ARN | listener, rule, attachments |
| `aws_lb_target_group_attachment.*` | target group, instance ID, port | `RegisterTargets` | - | - |
| `aws_lb_listener.http` | load balancer, port, default action | `CreateListener` | ARN | listener rule |
| `aws_lb_listener_rule.api` | listener, priority, path, action | `CreateRule` | ARN | - |

**One caveat that matters in this project.** In `security.tf` the three
`aws_security_group` blocks contain no rules. All rules are separate
resources. A security group with no outbound rule cannot send any
traffic, so the `master_all` and `agent_all` egress rules are what let
the servers reach the internet at all. If you removed them, the boot
scripts could not download anything.

**How one ID travels.** AWS returns `vpc-0abc...` when it creates the
VPC. Terraform stores it in the state as the `id` of `aws_vpc.main`.
When it later builds the request for a subnet, it replaces
`aws_vpc.main.id` with that stored value. This is the whole mechanism
behind "known after apply".

---

## 11. User Data and External Script Execution

*Project fact.* Both instances get a script through `user_data`:

| Instance | Script | What it installs |
|---|---|---|
| `aws_instance.master` | `scripts/master-userdata.sh` | Java 21, Jenkins. Starts Jenkins. Prints the first admin password. |
| `aws_instance.agent` | `scripts/agent-userdata.sh` | Java 21, Docker, Docker Compose v2, kind, kubectl. Adds `ubuntu` to the `docker` group. |

### Diagram D: life of a user-data script

```
ON YOUR LAPTOP (during plan)
  compute.tf:  user_data = templatefile(".../scripts/master-userdata.sh", { ... })
        │  Terraform reads the .sh file and fills in any ${name} placeholders
        ▼
  one long text (the final script)
        │
ON YOUR LAPTOP → AWS (during apply)
        │  the provider puts the text into the RunInstances request
        ▼
AWS
  stores the text as the instance's "user data" and starts the instance
        │
INSIDE THE EC2 INSTANCE (first boot only)
        │  cloud-init, a program built into the Ubuntu image, fetches the
        │  user data, sees that it starts with #!/bin/bash, and runs it as root
        ▼
  packages are installed; everything the script prints is written to
  /var/log/cloud-init-output.log
```

**In plain words:**

| Question | Answer |
|---|---|
| What runs on my laptop? | Only reading the file and building the text. |
| What does Terraform do? | Passes the text to AWS inside the "launch instance" request. |
| What runs inside the instance? | The script itself, run by cloud-init. |
| When? | Once, on the first boot. Not on later reboots. |
| Does Terraform wait for it? | No. Terraform reports the instance as created when AWS says it is running. The script is still working for a few minutes after `Apply complete!`. |
| Does Terraform know if it failed? | No. Terraform never connects to the instance. You have to look. |

**Terraform does not SSH into the servers and does not run any command
on them.** This project has no `provisioner` blocks.

### Important: the template variables are not used by the scripts

*Project fact.* `compute.tf` passes values into both scripts:

```hcl
user_data = templatefile("${path.module}/scripts/agent-userdata.sh", {
  java_package           = var.java_package
  docker_compose_package = var.docker_compose_package
  kind_version           = var.kind_version
  kubectl_version        = var.kubectl_version
  ssh_port               = var.ssh_port
  ssh_user               = var.ssh_user
})
```

`templatefile` only replaces placeholders written as `${name}` inside
the script. Neither script contains any `${...}` placeholder. So the
scripts are sent to AWS exactly as written, and the values are ignored.

What this means in practice:

| Variable in `terraform.tfvars` | What the script really does |
|---|---|
| `kind_version = "v0.29.0"` | Downloads `.../dl/latest/kind-linux-amd64`, the newest kind. |
| `kubectl_version = "v1.33.1"` | Downloads the version named in `stable.txt`, the newest stable kubectl. |
| `java_package = "openjdk-21-jre"` | Has `openjdk-21-jre` written directly in the script. |
| `docker_compose_package = "docker-compose-v2"` | Has `docker-compose-v2` written directly in the script. |
| `jenkins_apt_key_url`, `jenkins_apt_repo_url` | Has both URLs written directly in the master script. |

Changing these six values in `terraform.tfvars` changes nothing on the
servers. To change what is installed, edit the `.sh` file. To make the
variables work, the script would need placeholders such as
`${kind_version}`.

`ssh_port`, `ssh_user` and `jenkins_port` are also passed in and unused
by the scripts, but they are used elsewhere (security group rules and
outputs), so they do have an effect.

### Second caveat: `ignore_changes`

Both instances have `ignore_changes = [ami, user_data]`. After an
instance exists, editing its `.sh` file does nothing to it. The script
only runs for a newly created instance.

### How to check a script's result

From your laptop (the IPs come from `terraform output`):

```powershell
ssh ubuntu@<master-ip> "cloud-init status --wait"
ssh ubuntu@<master-ip> "sudo tail -50 /var/log/cloud-init-output.log"
```

| Output | Meaning |
|---|---|
| `status: done` | The script finished. |
| `status: running` | Still installing. Wait. |
| `status: error` | The script failed. Read the log; the last lines show where. |

Both scripts start with `set -e`, which stops the script at the first
failing command. So the error is always near the end of the log.

---

## 12. What Happens After Apply

### What the state records

The state is Terraform's memory. For every managed resource it stores:

- the address in your code, such as `aws_instance.master`
- the real AWS ID, such as `i-0abc...`
- every setting AWS reported back

It is the link between a block in your code and one real object in AWS.
It is **not** a copy of your `.tf` files.

*Project fact.* It lives in S3 at
`s3://questly-terraform-state-190633266826/questly/dev/terraform.tfstate`.
The bucket has versioning on, so older copies are kept.

### Why Terraform does not recreate everything each time

On every `plan`, Terraform goes through each resource in the state, asks
AWS for its current settings, and compares them with your code. If they
match, there is nothing to do. With no changes, the plan ends with:

```
No changes. Your infrastructure matches the configuration.
```

### What happens when you change something

These examples use this project's real settings.

| Change | What the plan shows | Why |
|---|---|---|
| `admin_cidrs` to a new IP (your IP changed) | `2 to add, 2 to destroy` | The rules are keyed by the CIDR text through `for_each`. A new text is a new rule; the old one is removed. Only the SSH and Jenkins rules are touched. |
| Add a second IP to `admin_cidrs` | `2 to add` | One more copy of each rule. |
| `master_instance_type` to `t3.large` | `1 to change` | Instance size can be changed in place. AWS stops and starts the instance to do it. |
| `master_volume_size` from 18 to 30 | `1 to change` | A disk can be grown in place. It cannot be shrunk. |
| `api_path_pattern` to `/v1/*` | `1 to change` | A listener rule can be edited. |
| Edit `scripts/master-userdata.sh` | No changes | `ignore_changes` includes `user_data`. |
| A newer Ubuntu AMI is published | No changes | `ignore_changes` includes `ami`. |
| `ssh_public_key_path` to a different key | Replaces the key pair only | A key pair's public key cannot be edited, so AWS's copy is replaced. The name stays `questly-dev-key`, so the instances are not touched. But running instances still hold the **old** key in `authorized_keys`; only newly created instances get the new one. |
| `project_name` or `environment` | Replaces almost everything | Names such as the security group name and load balancer name cannot be changed in place. Treat this as building a new environment. |
| Delete a `resource` block from the code | `1 to destroy` | It is in the state but no longer in the code. |

**Always read the last line of the plan.** If you see `to destroy` or
`must be replaced` when you did not expect it, stop and find out why.

### What happens if you change AWS by hand

Suppose you delete the Jenkins rule from the master's security group in
the AWS Console. This is called **drift**.

1. The next `terraform plan` refreshes and sees the rule is gone.
2. Your code still says the rule should exist.
3. The plan shows `1 to add`.
4. `apply` puts it back.

Terraform always moves AWS toward what the code says. If you want a
manual change to stay, put it in the code.

### Outputs

*Project fact.* After apply, Terraform prints 11 outputs from
`outputs.tf`:

| Output | Built from | Use |
|---|---|---|
| `app_url`, `next_public_api_base_url` | `local.alb_url` | Open the app; value for the frontend's API URL |
| `jenkins_url` | master's Elastic IP + `var.jenkins_port` | Open Jenkins |
| `master_public_ip` | `aws_eip.master.public_ip` | SSH target |
| `agent_private_ip` | `aws_instance.agent.private_ip` | Host for the Jenkins node |
| `ssh_master`, `ssh_agent`, `monitoring_tunnel` | key path, user, port, IPs | Ready-made commands |
| `vpc_id`, `public_subnet_ids`, `private_subnet_ids` | resource IDs | Reference |

Outputs are stored in the state, so `terraform output` can show them
again at any time without contacting AWS.

---

## 13. How to Navigate and Debug the Project Yourself

Run every command from the `terraform` folder. All of these are
read-only unless the table says otherwise.

| Command | Reads | Shows | Changes anything? | Look for |
|---|---|---|---|---|
| `terraform fmt -check -recursive` | all `.tf` files | names of badly formatted files | No | No output means all good |
| `terraform validate` | all `.tf` files | syntax and reference errors | No | `Success! The configuration is valid.` |
| `terraform plan` | code, tfvars, state, and AWS | what would change | No AWS changes. It locks the state briefly. | The last line: `Plan: X to add, Y to change, Z to destroy.` |
| `terraform plan -out=tfplan` | same | same, and saves it | Writes the local file `tfplan` | same |
| `terraform show tfplan` | the saved plan | the plan again | No | same |
| `terraform console` | code, tfvars, state | the value of anything you type | No | see below |
| `terraform state list` | state | every resource Terraform manages | No | 43 resources plus the 3 data sources after a full apply |
| `terraform state show <address>` | state | every stored setting of one resource | No | the real AWS ID and settings |
| `terraform output` | state | the 11 outputs | No | URLs and SSH commands |
| `terraform providers` | code | which providers are needed | No | `hashicorp/aws` |
| `terraform graph` | code | the dependency graph as text | No | lines like `"A" -> "B"`, meaning A needs B |

`validate` checks that the code makes sense. It does not check that your
values are correct or that AWS will accept them. Only `plan` does that.

`state list`, `state show` and `output` show nothing useful until an
apply has happened. After `terraform destroy` they are empty.

### Exercise 1: trace a name

**Question:** why is the master called `questly-dev-master`?

1. Open `compute.tf` and find `Name = "${local.name}-master"` (line 42).
2. `local.name` starts with `local.`, so search for `name =` inside a
   `locals` block. It is in `network.tf` line 15.
3. That line uses `var.project_name` and `var.environment`.
4. Open `terraform.tfvars` and find both values: `questly` and `dev`.
5. Check it:

```powershell
terraform console
```
```
local.name
"${local.name}-master"
exit
```

### Exercise 2: watch the subnets being worked out

In `terraform console`, type one line at a time:

```
var.vpc_cidr
local.azs
local.azs[0]
cidrsubnet(var.vpc_cidr, 8, 0)
cidrsubnet(var.vpc_cidr, 8, 10)
local.public_subnets
local.private_subnets
```

Each line shows one step from section 7.

### Exercise 3: follow the SSH key

```
var.ssh_public_key_path
pathexpand(var.ssh_public_key_path)
file(pathexpand(var.ssh_public_key_path))
```

Then, after an apply:

```
aws_key_pair.main.key_name
aws_key_pair.main.fingerprint
aws_instance.master.key_name
```

### Exercise 4: from code to the real AWS object

After an apply:

```powershell
terraform state list
terraform state show aws_instance.master
terraform state show 'aws_subnet.public[\"ap-south-1a\"]'
```

In the output, `id` is the real ID. Copy it into the search box of the
AWS Console to open that exact object.

### Exercise 5: from an output back to its source

**Question:** where does `jenkins_url` come from?

1. Open `outputs.tf` and find `output "jenkins_url"` (line 19).
2. Its value uses `aws_eip.master.public_ip` and `var.jenkins_port`.
3. `aws_eip.master` is in `compute.tf` line 52. It points to
   `aws_instance.master.id`.
4. `var.jenkins_port` is `8080` in `terraform.tfvars` line 24.

### Exercise 6: find everything that depends on one resource

Search the folder for the address. For example, searching for
`aws_security_group.agent` shows:

- `compute.tf` line 69: the agent instance uses this group
- `security.tf` lines 55 and 64: the load balancer may send traffic to it
- `security.tf`: six rules belong to it

That is the full list of what would be affected if the group changed.

### When something goes wrong

| Symptom | Likely cause | Where to look |
|---|---|---|
| `Error: Backend initialization required` | `init` was not run, or the backend changed | Run `terraform init -backend-config="backend.hcl"` |
| Terraform asks you to type a variable value | It is missing from `terraform.tfvars` | Compare with `terraform.tfvars.example` |
| `Invalid function argument ... no file exists` | The public key file is missing | `ssh_public_key_path` in tfvars |
| `Error acquiring the state lock` | Another Terraform run is in progress, or one crashed | Wait for it. Use `terraform force-unlock <ID>` only if you are sure nothing is running. |
| `UnauthorizedOperation` or `AccessDenied` | The IAM user lacks a permission | The user's policies in IAM |
| `InvalidClientTokenId` | The access key is wrong or deleted | `aws sts get-caller-identity` |
| Apply succeeded but Jenkins or Docker is missing | The boot script failed or is still running | `/var/log/cloud-init-output.log` on the instance |
| SSH times out | Your public IP changed | `admin_cidrs` in tfvars |

---

## 14. Common Misunderstandings and Their Corrections

| Misunderstanding | What really happens |
|---|---|
| "Terraform runs `versions.tf` first, then `providers.tf`, then the rest." | It loads all `.tf` files together. Order comes from references, not from file names. |
| "Lines inside a file run top to bottom." | Block order does not matter. You could move `aws_vpc.main` to the bottom of `network.tf` and nothing would change. |
| "`terraform.tfvars` runs the other files." | It only supplies values. It is data. |
| "`variables.tf` holds the values." | It only declares that the variables exist. In this project the values are all in `terraform.tfvars`. |
| "The provider block creates things in AWS." | It only sets up the connection: region and default tags. |
| "A `data` block creates something." | It only looks something up. |
| "`terraform init` creates the infrastructure." | It downloads the provider and connects to the state bucket. |
| "`terraform plan` changes AWS." | It only reads. |
| "A saved plan means the resources exist." | A plan is a proposal. Only apply creates things. |
| "The state file is a backup of my code." | It is a record of real AWS objects and their IDs. |
| "AWS runs my Terraform code." | AWS only receives API requests. Terraform runs on your laptop. |
| "Terraform runs the `.sh` scripts." | Terraform only hands the text to AWS. cloud-init runs it inside the instance on first boot. |
| "`Apply complete!` means Jenkins is ready." | It means AWS created the instance. The boot script needs a few more minutes. |
| "Changing `kind_version` in tfvars changes the kind version." | Not in this project. The script has no placeholders (section 11). |
| "`local.name` was changed to `questly-dev`." | It was never anything else. It is calculated from two variables every time. |
| "`questly-dev-key` is a file on my laptop." | It is only AWS's label for its copy of your public key. Your files are `id_ed25519` and `id_ed25519.pub`. |
| "If I edit something in the AWS Console, Terraform will keep it." | The next apply changes it back to match the code. |
| "Terraform recreates everything on every apply." | It only changes what differs between the code and the state. |

---

## 15. Complete End-to-End Execution Walkthrough

This follows one full run with an empty state, using this project's real
files and values.

### Diagram B: the life of an apply

```
You type:  terraform plan -out=tfplan   then   terraform apply tfplan
                          │
            ┌─────────────▼──────────────┐
            │ 1. Load all 9 .tf files    │   laptop
            │ 2. Read terraform.tfvars   │   laptop
            │ 3. Start the AWS provider  │   laptop
            │ 4. Read the state from S3  │   laptop → S3
            │ 5. Read the 3 data sources │   laptop → AWS (read only)
            │ 6. Evaluate expressions    │   laptop
            │ 7. Build dependency graph  │   laptop
            │ 8. Compare code with state │   laptop
            └─────────────┬──────────────┘
                          ▼
              Plan: 43 to add, 0 to change, 0 to destroy
                          │
                 you review, then apply
                          │
            ┌─────────────▼──────────────┐
            │ 9. Lock the state          │   laptop → S3
            │ 10. For each resource, as  │
            │     soon as what it needs  │
            │     is done:               │
            │      provider → API call ──┼──►  AWS creates it
            │      AWS replies with ID ◄─┼───
            │      save to state         │   laptop → S3
            │ 11. Work out the outputs   │   laptop
            │ 12. Unlock the state       │   laptop → S3
            └─────────────┬──────────────┘
                          ▼
              Apply complete! Resources: 43 added
              Outputs: app_url, jenkins_url, ...
                          │
                          ▼   (Terraform is finished; this part is not Terraform)
              Inside each EC2 instance, cloud-init runs the boot script
```

### Step by step

**1. You run `terraform plan -out=tfplan`** in the `terraform` folder.

**2. Terraform loads the code.** It reads `versions.tf`, `providers.tf`,
`variables.tf`, `network.tf`, `security.tf`, `iam.tf`, `compute.tf`,
`alb.tf` and `outputs.tf` as one configuration: 42 variables, 7 locals,
3 data sources, 39 resource blocks, 11 outputs.

**3. Variables get their values** from `terraform.tfvars`:
`project_name = "questly"`, `environment = "dev"`,
`aws_region = "ap-south-1"`, `vpc_cidr = "10.0.0.0/16"` and 38 more.

**4. The provider starts.** Terraform launches
`terraform-provider-aws_v6.68.0_x5.exe` and gives it the region and the
three default tags. The provider finds your access key in
`C:\Users\kumar\.aws\credentials`.

**5. The state is read** from
`questly/dev/terraform.tfstate` in the S3 bucket. It is empty.

**6. Data sources are read.** AWS returns the zone names and the current
Ubuntu 24.04 AMI ID. The IAM policy document is built locally.

**7. Locals are worked out:**

```
local.name            = "questly-dev"
local.azs             = ["ap-south-1a", "ap-south-1b"]
local.public_subnets  = { ap-south-1a = "10.0.0.0/24",  ap-south-1b = "10.0.1.0/24"  }
local.private_subnets = { ap-south-1a = "10.0.10.0/24", ap-south-1b = "10.0.11.0/24" }
```

**8. Files on your laptop are read.** `id_ed25519.pub` is read for the
key pair. The two `.sh` files are read for the user data.

**9. `for_each` is expanded.** 39 blocks become 43 resources.

**10. The graph is built** from every reference (section 9).

**11. The comparison is made.** Nothing is in the state, so all 43 are
marked `+ create`. The plan is saved to `tfplan`.

**12. You run `terraform show tfplan`**, read it, then
**`terraform apply tfplan`**.

**13. The state is locked** with a lock file in the bucket.

**14. The first four start together:** the VPC, the Elastic IP for the
NAT gateway, the key pair and the IAM role. The provider sends one
request for each. AWS creates them and returns their IDs. Each is saved
to the state.

**15. The VPC's ID unlocks the next group:** the internet gateway, four
subnets, three security groups and two target groups. Meanwhile the IAM
role unlocks the policy attachment and the instance profile.

**16. More becomes possible:**

- Security groups exist → the 12 rules are created.
- Public subnet a + master security group + key pair + profile + AMI →
  **the master is launched**, with its boot script as user data.
- ALB security group + both public subnets → the load balancer.
- EIP + public subnet a + internet gateway → the NAT gateway. This one
  takes a minute or two.
- VPC + internet gateway → the public route table, then its two
  associations.

**17. The master is running** → its Elastic IP is attached.
**The load balancer exists** → the listener, then the `/api/*` rule.

**18. The NAT gateway is ready** → the private route table → its two
associations.

**19. The private route is in place** → **the agent is launched** in
private subnet a, with its boot script as user data.

**20. The agent exists** → it is registered in both target groups, on
ports 30080 and 30081.

**21. Outputs are worked out** from the finished resources: the load
balancer's address, the master's public IP, the agent's private IP, and
the ready-made SSH commands.

**22. The state is saved and unlocked.** Terraform prints
`Apply complete! Resources: 43 added, 0 changed, 0 destroyed.` and the
outputs.

**23. Outside Terraform:** inside each instance, cloud-init runs the
boot script. A few minutes later Jenkins is running on the master, and
Docker, kind and kubectl are installed on the agent.

**24. What exists now:**

| Where | What |
|---|---|
| AWS | 43 resources named `questly-dev-*`, tagged `Project=questly`, `Environment=dev`, `ManagedBy=terraform` |
| S3 | The state, listing all 43 with their real IDs |
| Your laptop | The same `.tf` files, unchanged. `tfplan` is now used up. |

The load balancer will report the agent as unhealthy until the app is
deployed, because nothing is listening on ports 30080 and 30081 yet.
That part is covered in [after-terraform-apply.md](after-terraform-apply.md).

*Verified earlier on 10 October 2026:* after an apply, both instances
were running with the key `questly-dev-key` attached, the master's boot
script had finished, and Jenkins was active. That shows this flow works
end to end. It does not tell you what is running at the moment you read
this; use `terraform state list` to see.

---

## 16. Final Mental Model and Quick Reference

### The model in five lines

1. **You describe** what you want in `.tf` files.
2. **Values come in** from `terraform.tfvars` through `var.*`.
3. **Terraform reads everything at once** and builds a graph from the
   references.
4. **The provider turns each resource into AWS API requests**, in graph
   order, in parallel where it can.
5. **The state remembers** which real AWS object belongs to which block,
   so the next run only changes the difference.

### Who does what

| Actor | Where it runs | Job |
|---|---|---|
| You | Laptop | Write `.tf` files, set values, review the plan |
| Terraform | Laptop | Load, evaluate, build the graph, compare, decide the order |
| AWS provider | Laptop | Turn resources into signed API requests; wait for results |
| AWS | Cloud | Check permissions, create resources, return IDs |
| S3 bucket | Cloud | Hold the state and the lock |
| cloud-init | Inside each EC2 instance | Run the boot script once |

### The three commands

| Command | Purpose | Touches AWS? |
|---|---|---|
| `terraform init -backend-config="backend.hcl"` | Get the provider, connect to the state | Only reads the state bucket |
| `terraform plan -out=tfplan` | Work out what would change | Reads only |
| `terraform apply tfplan` | Do it | Creates, changes, deletes |

### Reading any reference

| Starts with | Look in |
|---|---|
| `var.` | `variables.tf` for the declaration, `terraform.tfvars` for the value |
| `local.` | a `locals { }` block (`network.tf` or `outputs.tf`) |
| `data.` | a `data "..." "..."` block (`network.tf`, `iam.tf`, `compute.tf`) |
| `aws_...` | a `resource "..." "..."` block; search for the name in quotes |
| `each.` | the `for_each` line in the same block |
| `path.module` | the `terraform` folder |

### Where each resource type lives

| File | Resources |
|---|---|
| `network.tf` | VPC, internet gateway, 4 subnets, NAT gateway and its IP, 2 route tables, 4 associations (14) |
| `security.tf` | 3 security groups, 12 rules (15) |
| `iam.tf` | role, policy attachment, instance profile (3) |
| `compute.tf` | key pair, master, master's Elastic IP, agent (4) |
| `alb.tf` | load balancer, 2 target groups, 2 attachments, listener, listener rule (7) |
| **Total** | **43** |

### The questions this guide answers

| Question | Short answer | Section |
|---|---|---|
| Which `.tf` file is read first? | None. All are loaded together. | 5.1 |
| How does Terraform know what to do first? | From the references between blocks. | 6, 9 |
| Where does a value come from? | Follow `var.` to `terraform.tfvars`, or `local.` to a `locals` block. | 7, 8 |
| How does Terraform talk to AWS? | The provider sends signed API requests using your access key. | 3.1, 10 |
| What is the state for? | Linking each block to a real AWS object. | 12 |
| Who runs the `.sh` scripts? | cloud-init inside the instance, not Terraform. | 11 |
| How do I check a value myself? | `terraform console`. | 13 |
