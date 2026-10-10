# =====================================================================
# Three security groups, one per role:
#
#   alb    : listener port from app_ingress_cidrs -> agent NodePorts
#   master : SSH + Jenkins from admin_cidrs only
#   agent  : SSH from master, app NodePorts from the ALB,
#            Grafana/Prometheus NodePorts from the master only
#
# Grafana and Prometheus are not public; reach them with an SSH
# tunnel through the master (see outputs).
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
  from_port         = var.alb_listener_port
  to_port           = var.alb_listener_port
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to frontend NodePort"
  referenced_security_group_id = aws_security_group.agent.id
  ip_protocol                  = "tcp"
  from_port                    = var.frontend_node_port
  to_port                      = var.frontend_node_port
}

resource "aws_vpc_security_group_egress_rule" "alb_to_backend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to backend NodePort"
  referenced_security_group_id = aws_security_group.agent.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_node_port
  to_port                      = var.backend_node_port
}

# ---------------------------------------------------------------------
# Master
# ---------------------------------------------------------------------

resource "aws_vpc_security_group_ingress_rule" "master_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.master.id
  description       = "SSH from admin"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = var.ssh_port
  to_port           = var.ssh_port
}

resource "aws_vpc_security_group_ingress_rule" "master_jenkins" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.master.id
  description       = "Jenkins UI from admin"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = var.jenkins_port
  to_port           = var.jenkins_port
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
  from_port                    = var.ssh_port
  to_port                      = var.ssh_port
}

resource "aws_vpc_security_group_ingress_rule" "agent_frontend_from_alb" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Frontend NodePort from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.frontend_node_port
  to_port                      = var.frontend_node_port
}

resource "aws_vpc_security_group_ingress_rule" "agent_backend_from_alb" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Backend NodePort from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.backend_node_port
  to_port                      = var.backend_node_port
}

resource "aws_vpc_security_group_ingress_rule" "agent_grafana_from_master" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Grafana NodePort from master (SSH tunnel)"
  referenced_security_group_id = aws_security_group.master.id
  ip_protocol                  = "tcp"
  from_port                    = var.grafana_node_port
  to_port                      = var.grafana_node_port
}

resource "aws_vpc_security_group_ingress_rule" "agent_prometheus_from_master" {
  security_group_id            = aws_security_group.agent.id
  description                  = "Prometheus NodePort from master (SSH tunnel)"
  referenced_security_group_id = aws_security_group.master.id
  ip_protocol                  = "tcp"
  from_port                    = var.prometheus_node_port
  to_port                      = var.prometheus_node_port
}

resource "aws_vpc_security_group_egress_rule" "agent_all" {
  security_group_id = aws_security_group.agent.id
  description       = "All outbound via NAT (GitHub, Docker Hub, Supabase, Gemini, apt)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
