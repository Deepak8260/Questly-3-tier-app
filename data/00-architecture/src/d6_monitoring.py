from archlib import Diagram

d = Diagram("06-monitoring-architecture", 1200, 800, "Monitoring Architecture",
            "Logs and metrics collected inside the cluster, viewed in Grafana through an SSH tunnel.")

d.group(40, 120, 1120, 470, "kind cluster  ·  namespace monitoring", "k8s", icon="brand:kubernetes")

d.note(70, 152, "LOGS", "teal", 12, True)
d.card(70, 180, 200, 115, "k8s:pod", "All pods", "stdout · stderr", icon_size=40)
d.card(360, 180, 200, 115, "ui:transfer-in", "Alloy", "collects", icon_size=40)
d.card(650, 180, 200, 115, "ui:file-text", "Loki", "stores", icon_size=40)

d.note(70, 330, "METRICS", "purple", 12, True)
d.card(70, 355, 200, 100, ["k8s:ds", "brand:prometheus"], "node-exporter", "each node", icon_size=34)
d.card(70, 470, 200, 100, "ui:cpu", "cAdvisor", "each container", icon_size=34)
d.card(360, 395, 490, 130, "brand:prometheus", "Prometheus", "scrapes every 15 s · :30090", icon_size=44)

d.card(930, 260, 200, 180, "brand:grafana", "Grafana", ":30030", icon_size=52)

d.edge([(270, 237), (358, 237)], "teal", "read", at=(314, 237))
d.edge([(560, 237), (648, 237)], "teal", "push", at=(604, 237))
d.edge([(270, 405), (358, 440)], "purple")
d.edge([(270, 520), (358, 480)], "purple")
d.edge([(850, 237), (890, 237), (890, 320), (928, 320)], "pink")
d.edge([(850, 460), (890, 460), (890, 385), (928, 385)], "pink")

# access
d.note(40, 620, "HOW YOU OPEN IT", "orange", 12, True)
d.card(40, 650, 220, 110, "ui:device-laptop", "Your laptop", "localhost:30030", icon_size=38)
d.card(390, 650, 220, 110, "aws:AmazonEC2Instance", "Master", "SSH tunnel", icon_size=38)
d.card(740, 650, 220, 110, ["aws:AmazonEC2Instance", "brand:kubernetes"], "Agent", ":30030 · :30090", icon_size=38)
d.edge([(260, 705), (388, 705)], "orange", "ssh -L", at=(324, 705))
d.edge([(610, 705), (738, 705)], "orange", "forward", at=(674, 705))
d.edge([(960, 705), (1030, 705), (1030, 442)], "orange")

d.render()
