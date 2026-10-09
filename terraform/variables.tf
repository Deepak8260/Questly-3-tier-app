# =====================================================================
# No defaults here on purpose: every value comes from terraform.tfvars
# (copy terraform.tfvars.example), which Terraform loads automatically.
# TF_VAR_<name> environment variables also work, e.g. in CI.
# =====================================================================

variable "project_name" {
  description = "Prefix used in resource names."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "aws_region" {
  description = "AWS region, e.g. ap-south-1 (Mumbai)."
  type        = string
}

variable "managed_by_tag" {
  description = "Value of the ManagedBy tag applied to every resource."
  type        = string
}

# ---------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block of the VPC."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across (the ALB needs at least 2)."
  type        = number

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be at least 2 for the ALB."
  }
}

variable "subnet_newbits" {
  description = "Bits added to vpc_cidr to size each subnet (8 turns a /16 into /24s)."
  type        = number
}

variable "public_subnet_offset" {
  description = "Index of the first public subnet within vpc_cidr (0 -> 10.0.0.0/24 for a 10.0.0.0/16 VPC)."
  type        = number
}

variable "private_subnet_offset" {
  description = "Index of the first private subnet within vpc_cidr (10 -> 10.0.10.0/24 for a 10.0.0.0/16 VPC)."
  type        = number
}

variable "admin_cidrs" {
  description = "Your public IP(s) in CIDR form (e.g. [\"203.0.113.10/32\"]). Only these can reach SSH and Jenkins on the master. List every IP when your network load-balances across several."
  type        = list(string)

  validation {
    condition     = length(var.admin_cidrs) > 0 && alltrue([for c in var.admin_cidrs : can(cidrhost(c, 0)) && c != "0.0.0.0/0"])
    error_message = "admin_cidrs must be a non-empty list of valid CIDRs and must not contain 0.0.0.0/0."
  }
}

variable "app_ingress_cidrs" {
  description = "CIDR ranges allowed to reach the application load balancer."
  type        = list(string)
}

# ---------------------------------------------------------------------
# Ports
# ---------------------------------------------------------------------

variable "ssh_port" {
  description = "SSH port on both instances."
  type        = number
}

variable "jenkins_port" {
  description = "Port the Jenkins UI listens on (master)."
  type        = number
}

variable "alb_listener_port" {
  description = "HTTP port the ALB listens on."
  type        = number
}

variable "frontend_node_port" {
  description = "Frontend NodePort on the agent. Must match k8s/frontend.yml and k8s/kind-config.yml."
  type        = number
}

variable "backend_node_port" {
  description = "Backend NodePort on the agent. Must match k8s/backend.yml and k8s/kind-config.yml."
  type        = number
}

variable "grafana_node_port" {
  description = "Grafana NodePort on the agent (used only for the SSH tunnel output)."
  type        = number
}

variable "prometheus_node_port" {
  description = "Prometheus NodePort on the agent (used only for the SSH tunnel output)."
  type        = number
}

# ---------------------------------------------------------------------
# Load balancer routing and health checks
# ---------------------------------------------------------------------

variable "api_path_pattern" {
  description = "ALB path pattern routed to the backend."
  type        = string
}

variable "api_rule_priority" {
  description = "Priority of the ALB listener rule that routes the API path."
  type        = number
}

variable "frontend_health_path" {
  description = "Health check path of the frontend target group."
  type        = string
}

variable "frontend_health_matcher" {
  description = "HTTP codes treated as healthy for the frontend (middleware may redirect to /login)."
  type        = string
}

variable "backend_health_path" {
  description = "Health check path of the backend target group."
  type        = string
}

variable "backend_health_matcher" {
  description = "HTTP codes treated as healthy for the backend."
  type        = string
}

variable "health_check_interval" {
  description = "Seconds between target health checks."
  type        = number
}

variable "healthy_threshold" {
  description = "Consecutive successes before a target is healthy."
  type        = number
}

variable "unhealthy_threshold" {
  description = "Consecutive failures before a target is unhealthy."
  type        = number
}

# ---------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------

variable "ami_ssm_parameter" {
  description = "SSM parameter that resolves to the AMI ID used by both instances."
  type        = string
}

variable "ssh_user" {
  description = "Default login user of the AMI (ubuntu for Ubuntu images)."
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key installed on both instances. The private key is expected at the same path without .pub."
  type        = string
}

variable "master_instance_type" {
  description = "Instance type for the Jenkins controller."
  type        = string
}

variable "agent_instance_type" {
  description = "Instance type for the Jenkins agent that runs the kind cluster (app + monitoring)."
  type        = string
}

variable "root_volume_type" {
  description = "EBS volume type of both root volumes."
  type        = string
}

variable "master_volume_size" {
  description = "Root volume size of the master in GiB."
  type        = number
}

variable "agent_volume_size" {
  description = "Root volume size of the agent in GiB (Docker images + kind nodes)."
  type        = number
}

variable "java_package" {
  description = "apt package providing Java on both instances (Jenkins controller and agent)."
  type        = string
}

variable "jenkins_apt_repo_url" {
  description = "Jenkins apt repository base URL (LTS: https://pkg.jenkins.io/debian-stable)."
  type        = string
}

variable "jenkins_apt_key_url" {
  description = "URL of the key that signs the Jenkins apt repository. Jenkins rotates it; check https://www.jenkins.io/doc/book/installing/linux/."
  type        = string
}

variable "docker_compose_package" {
  description = "apt package providing the Docker Compose v2 plugin (`docker compose`) on the agent."
  type        = string
}

variable "kind_version" {
  description = "kind release installed on the agent."
  type        = string
}

variable "kubectl_version" {
  description = "kubectl release installed on the agent. Keep it within one minor version of the kind node image."
  type        = string
}

variable "ssm_policy_arn" {
  description = "Managed policy attached to the instance role for Session Manager access."
  type        = string
}
