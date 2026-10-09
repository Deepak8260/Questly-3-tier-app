# Latest Ubuntu 24.04 LTS AMI published by Canonical
data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "aws_key_pair" "main" {
  key_name   = "${local.name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# ---------------------------------------------------------------------
# Master - Jenkins controller (public subnet, Elastic IP)
# ---------------------------------------------------------------------

resource "aws_instance" "master" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.master_instance_type
  subnet_id              = aws_subnet.public[local.azs[0]].id
  vpc_security_group_ids = [aws_security_group.master.id]
  key_name               = aws_key_pair.main.key_name
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = file("${path.module}/scripts/master-userdata.sh")

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.master_volume_size
    encrypted   = true
  }

  tags = {
    Name = "${local.name}-master"
    Role = "jenkins-controller"
  }

  # A newer AMI must not replace a running Jenkins server
  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "master" {
  domain   = "vpc"
  instance = aws_instance.master.id

  tags = { Name = "${local.name}-master-eip" }

  depends_on = [aws_internet_gateway.main]
}

# ---------------------------------------------------------------------
# Agent - Jenkins agent "flask-builder" running kind (private subnet)
# ---------------------------------------------------------------------

resource "aws_instance" "agent" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.agent_instance_type
  subnet_id              = aws_subnet.private[local.azs[0]].id
  vpc_security_group_ids = [aws_security_group.agent.id]
  key_name               = aws_key_pair.main.key_name
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/scripts/agent-userdata.sh", {
    kind_version    = var.kind_version
    kubectl_version = var.kubectl_version
  })

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.agent_volume_size
    encrypted   = true
  }

  tags = {
    Name = "${local.name}-agent"
    Role = "jenkins-agent"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }

  # Packages are downloaded through the NAT gateway at first boot
  depends_on = [aws_route_table_association.private]
}
