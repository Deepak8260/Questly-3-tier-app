variable "project_name" {
  description = "Prefix used in resource names."
  type        = string
  default     = "questly"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region. ap-south-1 is Mumbai."
  type        = string
  default     = "ap-south-1"
}

# ---------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block of the VPC. Public subnets get 10.0.0.0/24, 10.0.1.0/24; private subnets get 10.0.10.0/24, 10.0.11.0/24."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "admin_cidr" {
  description = "Your public IP in CIDR form (e.g. 203.0.113.10/32). Only this range can reach SSH and Jenkins on the master."
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0"
    error_message = "admin_cidr must be a valid CIDR and must not be 0.0.0.0/0."
  }
}

variable "app_ingress_cidrs" {
  description = "CIDR ranges allowed to reach the application load balancer on port 80."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ---------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------

variable "ssh_public_key_path" {
  description = "Path to the SSH public key installed on both instances."
  type        = string
  default     = "~/.ssh/questly-key.pub"
}

variable "master_instance_type" {
  description = "Instance type for the Jenkins controller."
  type        = string
  default     = "t3.medium"
}

variable "agent_instance_type" {
  description = "Instance type for the Jenkins agent that runs the kind cluster (app + monitoring)."
  type        = string
  default     = "t3.large"
}

variable "master_volume_size" {
  description = "Root volume size of the master in GiB."
  type        = number
  default     = 20
}

variable "agent_volume_size" {
  description = "Root volume size of the agent in GiB (Docker images + kind nodes)."
  type        = number
  default     = 30
}

variable "kind_version" {
  description = "kind release installed on the agent."
  type        = string
  default     = "v0.29.0"
}

variable "kubectl_version" {
  description = "kubectl release installed on the agent. Keep it within one minor version of the kind node image."
  type        = string
  default     = "v1.33.1"
}
