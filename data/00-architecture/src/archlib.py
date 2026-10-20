"""Small layout engine for the Questly architecture diagrams.

Each diagram script builds a Diagram, then calls render(), which writes an
HTML page and screenshots it with headless Chrome into a PNG.

Icons live in ./icons:
  aws/   official AWS Architecture Icons (npm package aws-icons 3.3.0)
  k8s/   official Kubernetes icons (github.com/kubernetes/community)
  brand/ Simple Icons 13.21.0 (single colour, coloured here)
  ui/    Tabler Icons 3.19.0 (outline, coloured here)
"""
import base64
import html
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)  # data/00-architecture
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")

BRAND = {
    "nextdotjs": "#000000", "react": "#149eca", "typescript": "#3178c6", "express": "#000000",
    "nodedotjs": "#5fa04e", "supabase": "#3ecf8e", "postgresql": "#4169e1", "googlegemini": "#8e75b2",
    "docker": "#2496ed", "kubernetes": "#326ce5", "terraform": "#844fba", "jenkins": "#d24939",
    "github": "#181717", "git": "#f05032", "gmail": "#ea4335", "grafana": "#f46800",
    "prometheus": "#e6522c", "redis": "#ff4438", "godaddy": "#1bdbdb", "ubuntu": "#e95420",
}

COL = {
    "blue": "#2563eb", "green": "#16a34a", "orange": "#ea580c", "purple": "#7c3aed", "red": "#dc2626",
    "teal": "#0d9488", "grey": "#64748b", "pink": "#db2777", "amber": "#d97706", "ink": "#0f172a",
}

# AWS group styles: border colour, background, dashed
GROUP = {
    "aws": ("#232f3e", "#ffffff", False),
    "region": ("#00a4a6", "#ffffff", True),
    "vpc": ("#8c4fff", "#ffffff", False),
    "az": ("#147eba", "#ffffff", True),
    "public": ("#7aa116", "#f2f6e8", False),
    "private": ("#00a4a6", "#e6f6f7", False),
    "ec2": ("#ed7100", "#fff8f2", False),
    "k8s": ("#326ce5", "#f3f7ff", False),
    "ns": ("#326ce5", "#ffffff", True),
    "plain": ("#cbd5e1", "#f8fafc", False),
    "dashed": ("#94a3b8", "#ffffff", True),
}


def _icon_data(spec):
    """spec: 'aws:AmazonEC2', 'k8s:deploy', 'brand:docker', 'ui:world', optional '#colour'."""
    kind, _, rest = spec.partition(":")
    name, _, colour = rest.partition("#")
    svg = open(os.path.join(HERE, "icons", kind, name + ".svg"), encoding="utf-8").read()
    if kind == "brand":
        c = "#" + colour if colour else BRAND.get(name, "#0f172a")
        svg = svg.replace("<svg ", f'<svg fill="{c}" ', 1)
    elif kind == "ui":
        c = "#" + colour if colour else "#334155"
        svg = re.sub(r'stroke="currentColor"', f'stroke="{c}"', svg)
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def _img(spec, size):
    return f'<img src="{_icon_data(spec)}" style="width:{size}px;height:{size}px;display:block">'


class Diagram:
    def __init__(self, name, w, h, title, subtitle=""):
        self.name, self.w, self.h = name, w, h
        self.title, self.subtitle = title, subtitle
        self.groups, self.cards, self.edges, self.chips = [], [], [], []

    # ---------------------------------------------------------------- groups
    def group(self, x, y, w, h, label, style="plain", icon=None, sub=None, colour=None, right=False, bottom=False):
        border, bg, dashed = GROUP[style]
        if colour:
            border = colour
        ic = f'<span class="gicon">{_img(icon, 26)}</span>' if icon else ""
        sb = f'<span class="gsub">{html.escape(sub)}</span>' if sub else ""
        self.groups.append(
            f'<div class="group" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'border:{2 if not dashed else 1.6}px {"dashed" if dashed else "solid"} {border};background:{bg}">'
            f'<div class="glabel" style="color:{border};{"left:auto;right:14px;" if right else ""}{"top:auto;bottom:-1px;transform:translateY(50%);" if bottom else ""}">{ic}<span>{html.escape(label)}</span>{sb}</div></div>')

    # ----------------------------------------------------------------- cards
    def card(self, x, y, w, h, icons, title, sub=None, tag=None, tag_colour="blue", icon_size=44, accent=None):
        icons = icons if isinstance(icons, list) else [icons]
        ics = "".join(_img(i, icon_size if n == 0 else int(icon_size * 0.62)) for n, i in enumerate(icons))
        tg = (f'<div class="tag" style="background:{COL[tag_colour]}">{html.escape(tag)}</div>' if tag else "")
        sb = f'<div class="sub">{html.escape(sub)}</div>' if sub else ""
        bar = f'border-top:4px solid {accent};' if accent else ""
        self.cards.append(
            f'<div class="card" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{bar}">{tg}'
            f'<div class="icons">{ics}</div><div class="title">{html.escape(title)}</div>{sb}</div>')
        return (x, y, w, h)

    def mini(self, x, y, w, icon, text, sub=None):
        """Compact one-line card: icon + text."""
        sb = f'<div class="msub">{html.escape(sub)}</div>' if sub else ""
        self.cards.append(
            f'<div class="mini" style="left:{x}px;top:{y}px;width:{w}px">{_img(icon, 28)}'
            f'<div><div class="mtext">{html.escape(text)}</div>{sb}</div></div>')

    # ----------------------------------------------------------------- edges
    def edge(self, pts, colour="grey", label=None, at=None, dashed=False, both=False, width=2.6):
        self.edges.append((pts, COL.get(colour, colour), dashed, both, width))
        if label:
            if at is None:
                a, b = pts[len(pts) // 2 - 1], pts[len(pts) // 2]
                at = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            self.chip(at[0], at[1], label, colour)

    def chip(self, x, y, text, colour="grey", solid=False):
        c = COL.get(colour, colour)
        style = (f"background:{c};color:#fff;border-color:{c}" if solid else f"color:{c};border-color:{c}")
        self.chips.append(f'<div class="chip" style="left:{x}px;top:{y}px;{style}">{html.escape(text)}</div>')

    def note(self, x, y, text, colour="grey", size=13, bold=False, align="left", width=None):
        w = f"width:{width}px;" if width else ""
        self.chips.append(
            f'<div class="note" style="left:{x}px;top:{y}px;color:{COL.get(colour, colour)};font-size:{size}px;'
            f'font-weight:{700 if bold else 500};text-align:{align};{w}">{html.escape(text)}</div>')

    # ---------------------------------------------------------------- render
    def _svg(self):
        defs, paths = [], []
        for i, (pts, c, dashed, both, width) in enumerate(self.edges):
            mid = f"m{i}"
            defs.append(f'<marker id="{mid}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" '
                        f'markerHeight="5.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{c}"/></marker>')
            d = "M" + " L".join(f"{a} {b}" for a, b in pts)
            da = ' stroke-dasharray="8 6"' if dashed else ""
            ms = f' marker-start="url(#{mid})"' if both else ""
            paths.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{width}" stroke-linejoin="round" '
                         f'stroke-linecap="round"{da}{ms} marker-end="url(#{mid})"/>')
        return (f'<svg class="edges" width="{self.w}" height="{self.h}"><defs>{"".join(defs)}</defs>'
                + "".join(paths) + "</svg>")

    def html(self):
        return f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{self.w}px;height:{self.h}px;background:#ffffff;
  font-family:"Segoe UI",Inter,Helvetica,Arial,sans-serif;color:#0f172a;position:relative;overflow:hidden}}
.head{{position:absolute;left:40px;top:28px}}
.head h1{{font-size:28px;font-weight:800;letter-spacing:-.3px}}
.head p{{margin-top:6px;font-size:15px;color:#64748b}}
.group{{position:absolute;border-radius:16px}}
.glabel{{position:absolute;left:14px;top:-1px;transform:translateY(-50%);background:inherit;
  padding:2px 10px 2px 6px;display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;border-radius:8px;
  background:#fff}}
.gsub{{font-weight:500;color:#64748b;font-size:13px}}
.edges{{position:absolute;left:0;top:0}}
.card{{position:absolute;background:#fff;border:1px solid #e2e8f0;border-radius:14px;
  box-shadow:0 1px 2px rgba(15,23,42,.06),0 6px 18px rgba(15,23,42,.07);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:10px}}
.card .icons{{display:flex;align-items:flex-end;gap:8px}}
.card .title{{font-size:16px;font-weight:700;line-height:1.15}}
.card .sub{{font-size:12.5px;color:#64748b;line-height:1.25}}
.tag{{position:absolute;top:-11px;right:12px;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.8px;
  padding:3px 8px;border-radius:999px}}
.mini{{position:absolute;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:9px 12px;
  display:flex;align-items:center;gap:10px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 4px 12px rgba(15,23,42,.05)}}
.mtext{{font-size:14px;font-weight:700}} .msub{{font-size:12px;color:#64748b}}
.chip{{position:absolute;transform:translate(-50%,-50%);background:#fff;border:1.5px solid;border-radius:999px;
  padding:3px 10px;font-size:12.5px;font-weight:700;white-space:nowrap}}
.note{{position:absolute;line-height:1.35}}
</style></head><body>
<div class="head"><h1>{html.escape(self.title)}</h1><p>{html.escape(self.subtitle)}</p></div>
{"".join(self.groups)}{self._svg()}{"".join(self.cards)}{"".join(self.chips)}
</body></html>"""

    def render(self, scale=2):
        src = os.path.join(HERE, self.name + ".html")
        open(src, "w", encoding="utf-8").write(self.html())
        png = os.path.join(OUT, self.name + ".png")
        tmp = png + ".tmp.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        f"--force-device-scale-factor={scale}", f"--window-size={self.w},{self.h}",
                        "--virtual-time-budget=4000", f"--screenshot={tmp}", "file:///" + src.replace("\\", "/")],
                       check=True, stderr=subprocess.DEVNULL)
        try:
            from PIL import Image
            Image.open(tmp).convert("RGB").save(png, optimize=True)
            os.remove(tmp)
        except ImportError:
            os.replace(tmp, png)
        print("wrote", png)


if __name__ == "__main__":
    print("Run one of the d*.py scripts instead.", file=sys.stderr)
