terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state (recommended for teams). Create the bucket once, then
  # uncomment and run `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket       = "questly-terraform-state-<unique-suffix>"
  #   key          = "questly/dev/terraform.tfstate"
  #   region       = "ap-south-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}
