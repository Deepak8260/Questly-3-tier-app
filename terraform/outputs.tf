output "app_url" {
  description = "Public URL of the Questly frontend."
  value       = "http://${aws_lb.app.dns_name}"
}

output "next_public_api_base_url" {
  description = "Value for NEXT_PUBLIC_API_BASE_URL in the frontend secret."
  value       = "http://${aws_lb.app.dns_name}"
}

output "jenkins_url" {
  description = "Jenkins UI on the master."
  value       = "http://${aws_eip.master.public_ip}:8080"
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
  value       = "ssh -i ~/.ssh/questly-key ubuntu@${aws_eip.master.public_ip}"
}

output "ssh_agent" {
  description = "SSH into the private agent, jumping through the master."
  value       = "ssh -i ~/.ssh/questly-key -J ubuntu@${aws_eip.master.public_ip} ubuntu@${aws_instance.agent.private_ip}"
}

output "monitoring_tunnel" {
  description = "Open Grafana (localhost:30030) and Prometheus (localhost:30090) on your laptop."
  value       = "ssh -i ~/.ssh/questly-key -J ubuntu@${aws_eip.master.public_ip} -L 30030:localhost:30030 -L 30090:localhost:30090 -N ubuntu@${aws_instance.agent.private_ip}"
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
