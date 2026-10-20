from archlib import Diagram

d = Diagram("02-container-architecture", 1440, 900, "Container Architecture",
            "Two-stage Docker builds, images on Docker Hub, and the full stack locally with Docker Compose.")

# ---- build pipeline
d.note(60, 118, "BUILD  ·  one Dockerfile per app", "grey", 12.5, True)
for y, app, port, logo in [(150, "frontend", ":3000", "brand:nextdotjs"), (300, "backend", ":3001", "brand:express")]:
    d.card(60, y, 200, 120, ["ui:file-code", logo], f"{app}/", "source code", icon_size=38)
    d.card(340, y, 240, 120, "brand:docker", "Build stage", "node:22-slim", icon_size=38)
    d.card(660, y, 260, 120, ["brand:docker", "brand:nodedotjs"], "Runtime image", f"distroless · {port}", icon_size=38)
    d.card(1000, y, 300, 120, "brand:docker", "Docker Hub", f"kumar3472/questly-{app}", icon_size=38)
    d.edge([(260, y + 60), (338, y + 60)], "grey")
    d.edge([(580, y + 60), (658, y + 60)], "amber", "copy build output", at=(619, y + 60))
    d.edge([(920, y + 60), (998, y + 60)], "blue", "docker push", at=(959, y + 60))
d.chip(790, 445, "no .env inside the image", "grey")
d.chip(1150, 445, "frontend image: 1.7 GB → 311 MB", "green")

# ---- docker compose
d.group(40, 500, 1360, 370, "docker compose", "plain", icon="brand:docker", sub="network qnet", colour="#2496ed")
row1 = [(80, ["brand:nextdotjs"], "frontend", ":3000"), (300, ["brand:express"], "backend", ":3001"),
        (520, ["brand:redis"], "redis", "not used yet")]
for x, ic, t, s in row1:
    d.card(x, 545, 190, 115, ic, t, s, icon_size=36)
row2 = [(80, "ui:cpu", "cAdvisor", ":8081"), (300, "brand:prometheus", "node-exporter", "host metrics"),
        (520, "brand:prometheus", "Prometheus", ":9090"), (740, "brand:grafana", "Grafana", ":3002"),
        (960, "ui:file-text", "Loki", "logs"), (1180, "ui:transfer-in", "Alloy", "docker.sock")]
for x, ic, t, s in row2:
    d.card(x, 725, 190, 115, ic, t, s, icon_size=36)
d.edge([(270, 602), (298, 602)], "grey", dashed=True)
d.chip(285, 530, "depends_on", "grey")
d.edge([(175, 725), (175, 700), (590, 700), (590, 723)], "purple", "scrape", at=(400, 700))
d.edge([(490, 782), (518, 782)], "purple")
d.edge([(710, 782), (738, 782)], "pink")
d.edge([(960, 782), (932, 782)], "pink")
d.edge([(1180, 782), (1152, 782)], "teal")
d.chip(1055, 700, "push logs", "teal")
d.chip(840, 700, "dashboards", "pink")

d.render()
