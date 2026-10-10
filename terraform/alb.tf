# =====================================================================
# Public Application Load Balancer - the only public entry to the app.
#
#   http://<alb>/                    -> agent:frontend_node_port
#   http://<alb>/<api_path_pattern>  -> agent:backend_node_port
#
# The browser calls the backend directly (frontend/lib/api.ts), so the
# backend is published through the same ALB under /api. Set
# NEXT_PUBLIC_API_BASE_URL=http://<alb-dns> in the frontend secret.
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

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = var.alb_listener_port
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
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
