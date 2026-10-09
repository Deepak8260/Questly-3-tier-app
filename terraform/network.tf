# =====================================================================
# VPC with public + private subnets across var.az_count AZs.
#
#   public  : ALB, NAT gateway, master (Jenkins)
#   private : agent (kind cluster running frontend + backend pods)
#
# The ALB needs subnets in at least two AZs.
# =====================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project_name}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  public_subnets  = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, var.subnet_newbits, i + var.public_subnet_offset) }
  private_subnets = { for i, az in local.azs : az => cidrsubnet(var.vpc_cidr, var.subnet_newbits, i + var.private_subnet_offset) }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name}-igw" }
}

# ---------------------------------------------------------------------
# Subnets
# ---------------------------------------------------------------------

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value

  # Public IPs are assigned explicitly (Elastic IP), not on launch
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name}-public-${each.key}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value

  tags = {
    Name = "${local.name}-private-${each.key}"
    Tier = "private"
  }
}

# ---------------------------------------------------------------------
# NAT gateway - lets the private agent reach GitHub, Docker Hub,
# Supabase and Gemini without being reachable from the internet.
# Single NAT to keep cost down; use one per AZ for production HA.
# ---------------------------------------------------------------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = { Name = "${local.name}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[local.azs[0]].id

  tags = { Name = "${local.name}-nat" }

  depends_on = [aws_internet_gateway.main]
}

# ---------------------------------------------------------------------
# Route tables
# ---------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "${local.name}-private-rt" }
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
