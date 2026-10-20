from archlib import Diagram

d = Diagram("05-cicd-pipeline-architecture", 1600, 740, "CI/CD Pipeline Architecture",
            "A push to main triggers Jenkins. The agent deploys to the kind cluster and Jenkins emails the result.")

d.card(40, 220, 180, 130, "ui:device-laptop", "Developer", icon_size=46)
d.card(300, 220, 180, 130, "brand:github", "GitHub", "main branch", icon_size=44)
d.card(560, 220, 200, 130, ["brand:jenkins", "aws:AmazonEC2Instance"], "Jenkins master", "job: questly", icon_size=44)

d.group(840, 150, 730, 400, "Jenkins agent  questly-agent", "ec2", icon="aws:AmazonEC2Instance")
d.card(870, 220, 190, 130, "brand:git", "1 · Checkout", "github-token", icon_size=42)
d.card(1100, 220, 200, 130, "ui:terminal-2", "2 · deploy.sh", "cluster · secrets · apply", icon_size=42)
d.card(1340, 220, 200, 130, "brand:kubernetes", "kind cluster", "app + monitoring", icon_size=44)
d.mini(1100, 430, 200, "ui:key", ".env files", "→ Kubernetes secrets")

d.card(560, 430, 200, 110, "brand:gmail", "Gmail", "success / failure", icon_size=40)
d.card(1340, 610, 200, 100, "brand:docker", "Docker Hub", ":latest images", icon_size=38)

d.edge([(220, 285), (298, 285)], "grey", "git push", at=(259, 285))
d.edge([(480, 285), (558, 285)], "green", "webhook", at=(519, 285))
d.edge([(760, 285), (868, 285)], "blue", "SSH", at=(814, 285))
d.edge([(1060, 285), (1098, 285)], "orange")
d.edge([(1300, 285), (1338, 285)], "orange")
d.edge([(1200, 430), (1200, 352)], "amber", "secrets", at=(1200, 392))
d.edge([(1440, 610), (1440, 352)], "teal", "pull :latest", at=(1440, 480))
d.edge([(838, 485), (762, 485)], "pink", "email", at=(800, 485))
d.edge([(560, 485), (160, 485), (160, 352)], "pink", dashed=True)
d.edge([(100, 352), (100, 660), (1338, 660)], "teal", "docker push (by hand)", dashed=True, at=(700, 660))

d.render()
