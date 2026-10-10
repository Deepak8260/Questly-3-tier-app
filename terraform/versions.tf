terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state (recommended for teams). Backend blocks cannot read
  # variables, so keep the values in a git-ignored backend.hcl:
  #
  #   bucket       = "questly-terraform-state-<unique-suffix>"
  #   key          = "questly/dev/terraform.tfstate"
  #   region       = "ap-south-1"
  #   encrypt      = true
  #   use_lockfile = true
  #
  # then run
  # `terraform init -backend-config=backend.hcl -migrate-state`.
  #
  backend "s3" {}
}
