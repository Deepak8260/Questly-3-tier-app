locals {
  # Private key sits next to the public key, without the .pub suffix
  ssh_private_key_path = trimsuffix(var.ssh_public_key_path, ".pub")
  ssh_jump             = "-J ${var.ssh_user}@${aws_eip.master.public_ip}"
  # Omit ":443" so the URLs stay clean on the default HTTPS port
  app_url = var.alb_https_port == 443 ? "https://${var.app_domain_name}" : "https://${var.app_domain_name}:${var.alb_https_port}"
}

output "app_url" {
  description = "Public URL of the Questly frontend."
  value       = local.app_url
}

output "next_public_api_base_url" {
  description = "Value for NEXT_PUBLIC_API_BASE_URL in the frontend secret."
  value       = local.app_url
}

output "alb_dns_name" {
  description = "Point the app domain here: CNAME <app_domain_name> -> this name. Changes when the ALB is recreated."
  value       = aws_lb.app.dns_name
}

output "acm_validation_record" {
  description = "CNAME to add once at the DNS provider so ACM can issue the certificate."
  value = {
    for o in aws_acm_certificate.app.domain_validation_options : o.domain_name => {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  }
}

output "jenkins_url" {
  description = "Jenkins UI on the master."
  value       = "http://${aws_eip.master.public_ip}:${var.jenkins_port}"
}

output "master_public_ip" {
  description = "Elastic IP of the master."
  value       = aws_eip.master.public_ip
}

output "agent_private_ip" {
  description = "Private IP of the agent - use as the Host when adding the node in Jenkins."
  value       = aws_instance.agent.private_ip
}

output "ssh_master" {
  description = "SSH into the master."
  value       = "ssh -i ${local.ssh_private_key_path} -p ${var.ssh_port} ${var.ssh_user}@${aws_eip.master.public_ip}"
}

output "ssh_agent" {
  description = "SSH into the private agent, jumping through the master."
  value       = "ssh -i ${local.ssh_private_key_path} ${local.ssh_jump}:${var.ssh_port} -p ${var.ssh_port} ${var.ssh_user}@${aws_instance.agent.private_ip}"
}

output "monitoring_tunnel" {
  description = "Open Grafana and Prometheus on your laptop at the same localhost ports (forwarded by the master to the agent)."
  value       = "ssh -i ${local.ssh_private_key_path} -p ${var.ssh_port} -L ${var.grafana_node_port}:${aws_instance.agent.private_ip}:${var.grafana_node_port} -L ${var.prometheus_node_port}:${aws_instance.agent.private_ip}:${var.prometheus_node_port} -N ${var.ssh_user}@${aws_eip.master.public_ip}"
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = [for s in aws_subnet.public : s.id]
}

output "private_subnet_ids" {
  value = [for s in aws_subnet.private : s.id]
}
