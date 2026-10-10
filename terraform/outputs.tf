locals {
  # Private key sits next to the public key, without the .pub suffix
  ssh_private_key_path = trimsuffix(var.ssh_public_key_path, ".pub")
  ssh_jump             = "-J ${var.ssh_user}@${aws_eip.master.public_ip}"
  # Omit ":80" so the URLs stay clean on the default HTTP port
  alb_url = var.alb_listener_port == 80 ? "http://${aws_lb.app.dns_name}" : "http://${aws_lb.app.dns_name}:${var.alb_listener_port}"
}

output "app_url" {
  description = "Public URL of the Questly frontend."
  value       = local.alb_url
}

output "next_public_api_base_url" {
  description = "Value for NEXT_PUBLIC_API_BASE_URL in the frontend secret."
  value       = local.alb_url
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
