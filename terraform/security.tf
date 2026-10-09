# =====================================================================
# Three security groups, one per role:
#
#   alb    : 80 from the internet           -> agent 30080 / 30081
#   master : 22 + 8080 from admin_cidr only
#   agent  : 22 from master only, 30080/30081 from the ALB only
#
# Grafana (30030) and Prometheus (30090) are not exposed; reach them
# with an SSH tunnel through the master (see outputs).
# =====================================================================

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Public application load balancer"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-alb-sg" }
}

resource "aws_security_group" "master" {
  name        = "${local.name}-master-sg"
  description = "Jenkins controller"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-master-sg" }
}

resource "aws_security_group" "agent" {
  name        = "${local.name}-agent-sg"
  description = "Jenkins agent running the kind cluster"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-agent-sg" }
}

# ---------------------------------------------------------------------
# ALB
# ---------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each = toset(var.app_ingress_cidrs)

  security_group_id = aws_security_group.alb.id
  description       = "HTTP from allowed clients"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to frontend NodePort"
  referenced_security_group_id = aws_security_group.agent.id
  ip_protocol                  = "tcp"
  from_port                    = 30080
  to_port                      = 30080
}

resource "aws_vpc_security_group_egress_rule" "alb_to_backend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to backend NodePort"
  referenced_security_group_id = aws_security_group.agent.id
  ip_protocol                  = "tcp"
  from_port                    = 30081
  to_port                      = 30081
}

# ---------------------------------------------------------------------
# Master
# ---------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "master_ssh" {
  security_group_id = aws_security_group.master.id
  description       = "SSH from admin"
  cidr_ipv4         = var.admin_cidr
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "master_jenkins" {
  security_group_id = aws_security_group.master.id
  description       = "Jenkins UI from admin"
  cidr_ipv4         = var.admin_cidr
  ip_protocol       = "tcp"
  from_port         = 8080
  to_port           = 8080
}

resource "aws_vpc_security_group_egress_rule" "master_all" {
  security_group_id = aws_security_group.master.id
  description       = "All outbound (GitHub, Gmail SMTP, SSH to agent, apt)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ---------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "agent_ssh_from_master" {
  security_group_id            = aws_security_group.agent.id
  description                  = "SSH from master (Jenkins agent launch + bastion jump)"
  referenced_security_group_id = aws_security_group.master.id
  ip_protocol                  = "tcp"
  from_port                    = 22
  to_port                      = 22
}

resource "aws_vpc_security_group_ingress_rule" "agent_frontend_from_alb" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Frontend NodePort from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 30080
  to_port                      = 30080
}

resource "aws_vpc_security_group_ingress_rule" "agent_backend_from_alb" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Backend NodePort from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 30081
  to_port                      = 30081
}

resource "aws_vpc_security_group_egress_rule" "agent_all" {
  security_group_id = aws_security_group.agent.id
  description       = "All outbound via NAT (GitHub, Docker Hub, Supabase, Gemini, apt)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
