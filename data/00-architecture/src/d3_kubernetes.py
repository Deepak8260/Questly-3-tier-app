from archlib import Diagram

d = Diagram("03-kubernetes-architecture", 1480, 900, "Kubernetes Architecture",
            "A kind cluster on the agent EC2: two nodes, the app in questly-ns, monitoring in its own namespace.")

# outside the agent
d.card(40, 250, 200, 130, "aws:ElasticLoadBalancingApplicationLoadBalancer", "Load balancer", "/  and  /api/*")
d.card(40, 560, 200, 130, ["aws:AmazonEC2Instance", "brand:jenkins"], "Master", "SSH tunnel")

d.group(300, 120, 1150, 750, "Agent EC2", "ec2", icon="aws:AmazonEC2Instance", sub="Ubuntu 24.04 · Docker")
d.group(330, 170, 1090, 670, "kind cluster  questly", "k8s", icon="brand:kubernetes")

d.mini(370, 205, 330, "brand:kubernetes", "control-plane node", "host ports 30080 · 30081 · 30030 · 30090")
d.mini(730, 205, 300, "brand:kubernetes", "worker node", "runs pods")
d.chip(1200, 232, "pods run on either node", "blue")

# questly-ns
d.group(360, 310, 520, 500, "questly-ns", "ns", icon="k8s:ns")
d.card(385, 345, 220, 125, ["k8s:deploy", "brand:nextdotjs"], "frontend", "Deployment · :3000", icon_size=40)
d.card(635, 345, 220, 125, ["k8s:deploy", "brand:express"], "backend", "Deployment · :3001", icon_size=40)
d.card(385, 535, 220, 110, "k8s:svc", "Service", "NodePort 30080", icon_size=40)
d.card(635, 535, 220, 110, "k8s:svc", "Service", "NodePort 30081", icon_size=40)
d.edge([(495, 535), (495, 472)], "red")
d.edge([(745, 535), (745, 472)], "red")
d.card(385, 690, 470, 95, "k8s:secret", "2 Secrets", "built from frontend/.env and backend/.env", icon_size=36)

# monitoring
d.group(905, 310, 495, 500, "monitoring", "ns", icon="k8s:ns")
d.card(930, 345, 210, 125, "brand:prometheus", "Prometheus", "NodePort 30090", icon_size=40)
d.card(1165, 345, 210, 125, "brand:grafana", "Grafana", "NodePort 30030", icon_size=40)
d.card(930, 500, 210, 120, "ui:file-text", "Loki", "log store", icon_size=38)
d.card(1165, 500, 210, 120, "ui:transfer-in", "Alloy", "collects pod logs", icon_size=38)
d.card(930, 660, 445, 125, ["k8s:ds", "brand:prometheus"], "node-exporter", "DaemonSet · one pod per node", icon_size=38)

# entry points
d.edge([(240, 300), (335, 300), (335, 232), (368, 232)], "orange", ":30080 · :30081", at=(285, 300))
d.edge([(240, 620), (318, 620), (318, 248), (368, 248)], "purple", ":30030 · :30090", at=(270, 620))

d.render()
