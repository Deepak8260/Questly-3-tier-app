from archlib import Diagram

d = Diagram("04-cloud-architecture", 1600, 1040, "Cloud Architecture (AWS)",
            "Everything Terraform creates. Two availability zones, one NAT gateway, HTTPS on a custom domain.")

# outside, left
d.card(40, 170, 170, 95, "aws:Users", "Users", icon_size=40)
d.card(40, 285, 170, 95, "aws:Client", "You", "your IP only", icon_size=40)
d.card(40, 400, 170, 95, "brand:github", "GitHub", "webhook", icon_size=36)

# AWS cloud > region > VPC
d.group(250, 110, 1070, 905, "AWS Cloud", "aws", icon="aws:AWSCloudlogo")
d.group(275, 160, 1020, 835, "ap-south-1", "region", icon="aws:Region", sub="Mumbai")
d.group(300, 255, 800, 720, "VPC", "vpc", icon="aws:VirtualprivatecloudVPC", sub="10.0.0.0/16")

d.card(600, 195, 170, 125, "aws:AmazonVPCInternetGateway", "Internet gateway", icon_size=44)

d.group(320, 355, 375, 600, "AZ 1", "az")
d.group(715, 355, 365, 600, "AZ 2", "az")
d.group(335, 390, 345, 255, "Public subnet", "public", icon="aws:Publicsubnet", sub="10.0.0.0/24")
d.group(730, 390, 335, 255, "Public subnet", "public", icon="aws:Publicsubnet", sub="10.0.1.0/24")
d.group(335, 680, 345, 255, "Private subnet", "private", icon="aws:Privatesubnet", sub="10.0.10.0/24", bottom=True)

d.card(355, 425, 140, 110, "aws:AmazonVPCNATGateway", "NAT gateway", icon_size=40)
d.card(515, 425, 150, 110, ["aws:AmazonEC2Instance", "brand:jenkins"], "Master", "Jenkins · Elastic IP", icon_size=40)
d.card(560, 552, 330, 80, "aws:ElasticLoadBalancingApplicationLoadBalancer", "Application Load Balancer",
       icon_size=34)
d.card(430, 745, 240, 125, ["aws:AmazonEC2Instance", "brand:kubernetes"], "Agent", "kind cluster · app",
       icon_size=40)

# region services
d.card(1125, 370, 145, 120, "aws:AWSCertificateManager", "ACM", "HTTPS certificate", icon_size=42)
d.card(1125, 540, 145, 120, "aws:AWSIdentityandAccessManagement", "IAM role", "Session Manager", icon_size=42)

# outside, right
d.group(1345, 160, 230, 400, "Outside AWS", "plain")
d.mini(1360, 195, 200, "brand:godaddy", "GoDaddy DNS", "2 CNAME records")
d.mini(1360, 275, 200, "brand:supabase", "Supabase", "database")
d.mini(1360, 355, 200, "brand:googlegemini", "Gemini API", "AI")
d.mini(1360, 435, 200, "brand:docker", "Docker Hub", "images")

# traffic
d.edge([(210, 205), (598, 205)], "blue", "HTTPS 443", at=(420, 205))
d.edge([(210, 332), (250, 332), (250, 233), (598, 233)], "orange", "SSH · :8080", at=(520, 233))
d.edge([(210, 447), (262, 447), (262, 290), (598, 290)], "green", "webhook :8080", at=(430, 290))
d.edge([(710, 320), (710, 550)], "blue")
d.edge([(650, 320), (650, 423)], "orange")
d.edge([(650, 632), (650, 743)], "blue", ":30080 · :30081", at=(650, 712))
d.edge([(530, 535), (530, 743)], "purple", "SSH", at=(530, 662))
d.edge([(1125, 430), (1095, 430), (1095, 592), (892, 592)], "grey", "certificate", at=(1095, 510))
d.edge([(430, 807), (372, 807), (372, 537)], "teal", "outbound", dashed=True, at=(372, 760))
d.edge([(355, 470), (344, 470), (344, 372), (620, 372), (620, 322)], "teal", dashed=True)
d.edge([(770, 240), (1343, 240)], "teal", "outbound only", dashed=True, at=(1210, 240))

d.render()
