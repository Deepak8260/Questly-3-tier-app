# Install Terraform and AWS CLI on Windows

Steps to install Terraform and the AWS CLI on a Windows laptop, connect
them to your AWS account, and run the Questly Terraform in `terraform/`.

Run every command in **PowerShell**.

Every section is marked:

- **Compulsory**: you must do it, or the next steps will not work.
- **Optional (production recommended)**: everything works without it, but
  real production teams do it.

| #  | Section                  | Status                                       |
| -- | ------------------------ | -------------------------------------------- |
| 1  | Install Terraform        | Compulsory                                   |
| 2  | Install AWS CLI          | Compulsory                                   |
| 3  | Create AWS access keys   | Compulsory                                   |
| 4  | Configure the AWS CLI    | Compulsory                                   |
| 5  | Create an SSH key        | Compulsory                                   |
| 6  | Fill in terraform.tfvars | Compulsory                                   |
| 7  | Set up remote state      | Compulsory (this project uses an S3 backend) |
| 8  | Plan and apply           | Compulsory                                   |
| 9  | Destroy                  | Compulsory when you are done                 |
| 10 | Extra plan flags         | Optional (production recommended)            |
| 11 | Team rules               | Optional (production recommended)            |

---

# Compulsory

## 1. Install Terraform

Check first; if this prints a version, skip to section 2:

```powershell
terraform -version
```

Install:

```powershell
winget install --id Hashicorp.Terraform -e
```

Close and reopen PowerShell, then run `terraform -version` again.

On this laptop Terraform 1.13.4 is already installed at `C:\Terraform\terraform.exe`.

## 2. Install AWS CLI

Check first; if this prints a version, skip to section 3:

```powershell
aws --version
```

Install:

```powershell
winget install --id Amazon.AWSCLI -e
```

Close and reopen PowerShell, then run `aws --version` again.

On this laptop AWS CLI 2.36.1 is already installed.

## 3. Create AWS access keys

1. In the AWS Console, open **IAM → Users** and select your user.
2. Open the **Security credentials** tab and click **Create access key**.
3. Choose **Command Line Interface (CLI)** and create the key.
4. Click **Download .csv file**. The secret is shown only once.

## 4. Configure the AWS CLI

```powershell
aws configure
```

| Prompt                | Value                   |
| --------------------- | ----------------------- |
| AWS Access Key ID     | from the`.csv` file   |
| AWS Secret Access Key | from the`.csv` file   |
| Default region name   | `ap-south-1` (Mumbai) |
| Default output format | `json`                |

Copy the keys from the `.csv` file opened in Notepad, not from the web
page. Copying from the page can add an invisible character and cause
`'charmap' codec can't encode character '\u200b'`.

Check that it works:

```powershell
aws sts get-caller-identity
```

It should print your account number.

| Error                            | Fix                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `InvalidClientTokenId`         | The key is wrong or deleted. Create a new one and run`aws configure` again. |
| `SignatureDoesNotMatch`        | The secret key is wrong. Run`aws configure` and paste it again.             |
| `Unable to locate credentials` | Run`aws configure`.                                                         |

## 5. Create an SSH key

Skip this if `C:\Users\<you>\.ssh\id_ed25519.pub` already exists.

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519
```

Terraform installs the `.pub` file on both EC2 instances so you can SSH in.

## 6. Fill in terraform.tfvars

`terraform/terraform.tfvars` holds the real values and is git-ignored.
If it does not exist, create it from the template and replace every
`<...>` placeholder:

```powershell
cd terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

Find your public IP for `admin_cidrs` and add `/32` to it:

```powershell
curl.exe -s https://checkip.amazonaws.com
```

## 7. Set up remote state

Terraform keeps a record of everything it created, called the state.
This project stores it in an S3 bucket instead of on your laptop, so it
is backed up, versioned and locked while someone is applying.
`terraform/versions.tf` contains `backend "s3" {}`, so `terraform init`
needs the bucket details from a file called `backend.hcl`.

**On this laptop it is already set up.** The bucket
`questly-terraform-state-190633266826` exists and `terraform/backend.hcl`
points to it. Skip to section 8.

**On a new laptop, same AWS account:** the bucket already exists, so only
create `terraform/backend.hcl` (it is git-ignored, so it is not in the repo):

```hcl
bucket       = "questly-terraform-state-190633266826"
key          = "questly/dev/terraform.tfstate"
region       = "ap-south-1"
encrypt      = true
use_lockfile = true
```

**On a different AWS account:** create the bucket first, then write
`backend.hcl` with that bucket name. The account number makes the name
unique.

```powershell
$ACCOUNT = aws sts get-caller-identity --query Account --output text
$BUCKET  = "questly-terraform-state-$ACCOUNT"

aws s3api create-bucket --bucket $BUCKET --region ap-south-1 `
  --create-bucket-configuration LocationConstraint=ap-south-1

aws s3api put-bucket-versioning --bucket $BUCKET `
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block --bucket $BUCKET `
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

| Setting             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| Versioning          | Keeps old copies of the state so you can restore one |
| Public access block | Nobody outside the account can read the state        |
| `encrypt`         | The state is encrypted in the bucket                 |
| `use_lockfile`    | Two people cannot apply at the same time             |

## 8. Plan and apply

Run these from the `terraform` folder, in this order.

```powershell
terraform init -backend-config="backend.hcl"
terraform validate
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
```

| Command                                          | What it does                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `terraform init -backend-config="backend.hcl"` | Downloads the AWS provider and connects to the state bucket. Needed the first time only.   |
| `terraform validate`                           | Checks the code for errors.                                                                |
| `terraform plan -out=tfplan`                   | Works out what will be created and saves it to the file`tfplan`. Nothing is created yet. |
| `terraform show tfplan`                        | Shows the saved plan so you can review it.                                                 |
| `terraform apply tfplan`                       | Creates exactly what is in the saved plan. It does not ask for`yes`.                     |

When you review the plan, read the last line. A first run of this project
shows `Plan: 43 to add, 0 to change, 0 to destroy.`

Afterwards, print the URLs and SSH commands:

```powershell
terraform output
```

Wait about 3 minutes after apply for Jenkins and Docker to finish
installing on the instances.

## 9. Destroy

Compulsory when you are done. The NAT gateway and load balancer cost
money every hour, even when the EC2 instances are stopped.

```powershell
terraform plan -destroy -out=tfplan
terraform show tfplan
terraform apply tfplan
```

This does not delete the state bucket, because Terraform does not manage
it. It costs almost nothing; keep it for the next run.

---

# Optional (production recommended)

Everything above works without this part.

## 10. Extra plan flags

```powershell
terraform fmt -check -recursive
terraform plan -input=false -lock-timeout=60s -out=tfplan
terraform apply -input=false tfplan
terraform plan -detailed-exitcode
```

| Command or flag                       | Why teams use it                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `terraform fmt -check -recursive`   | Fails if any file is badly formatted. Run`terraform fmt -recursive` to fix.              |
| `-input=false`                      | Fails instead of prompting when a variable is missing. Used in CI pipelines.               |
| `-lock-timeout=60s`                 | Waits for another person's run to finish instead of failing at once.                       |
| `terraform plan -detailed-exitcode` | Run after apply. Exit code`0` means AWS matches the code; `2` means something drifted. |

## 11. Team rules

| Do                                           | Do not                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Commit`.terraform.lock.hcl`                | Commit`terraform.tfvars`, `backend.hcl`, `tfplan` or `*.tfstate` |
| Make a new plan file for every change        | Reuse an old plan file                                                   |
| Change infrastructure through Terraform only | Edit Terraform-managed resources in the AWS Console                      |
| Keep access keys in`~/.aws/credentials`    | Put access keys in`.tf` or `.tfvars` files                           |
| Review the plan before applying              | Run`terraform apply -auto-approve` by hand                             |
