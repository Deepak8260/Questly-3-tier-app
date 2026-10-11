# =====================================================================
# Public Application Load Balancer - the only public entry to the app.
#
#   http://<domain>/*                    -> redirect to https
#   https://<domain>/                    -> agent:frontend_node_port
#   https://<domain>/<api_path_pattern>  -> agent:backend_node_port
#
# TLS ends at the ALB; traffic to the agent stays plain HTTP inside the
# VPC. The browser calls the backend directly (frontend/lib/api.ts), so
# the backend is published through the same ALB under /api. Set
# NEXT_PUBLIC_API_BASE_URL=https://<domain> in the frontend secret.
# =====================================================================

resource "aws_lb" "app" {
  name               = "${local.name}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]

  drop_invalid_header_fields = true

  tags = { Name = "${local.name}-alb" }
}

resource "aws_lb_target_group" "frontend" {
  name     = "${local.name}-frontend-tg"
  port     = var.frontend_node_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = var.frontend_health_path
    matcher             = var.frontend_health_matcher
    interval            = var.health_check_interval
    healthy_threshold   = var.healthy_threshold
    unhealthy_threshold = var.unhealthy_threshold
  }
}

resource "aws_lb_target_group" "backend" {
  name     = "${local.name}-backend-tg"
  port     = var.backend_node_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = var.backend_health_path
    matcher             = var.backend_health_matcher
    interval            = var.health_check_interval
    healthy_threshold   = var.healthy_threshold
    unhealthy_threshold = var.unhealthy_threshold
  }
}

resource "aws_lb_target_group_attachment" "frontend" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.agent.id
  port             = var.frontend_node_port
}

resource "aws_lb_target_group_attachment" "backend" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.agent.id
  port             = var.backend_node_port
}

# ---------------------------------------------------------------------
# Certificate - free, issued by ACM, proven by a DNS record.
# The validation CNAME (output acm_validation_record) must be added at
# the DNS provider once; the validation resource waits until ACM sees it.
# ---------------------------------------------------------------------

resource "aws_acm_certificate" "app" {
  domain_name       = var.app_domain_name
  validation_method = "DNS"

  tags = { Name = "${local.name}-cert" }

  # A replacement certificate must exist before the listener lets go of the old one
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn = aws_acm_certificate.app.arn
}

# ---------------------------------------------------------------------
# Listeners
# ---------------------------------------------------------------------

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

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = var.api_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = [var.api_path_pattern]
    }
  }
}
