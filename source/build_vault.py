import sys, base64, re, os, shutil
sys.path.insert(0, "/private/tmp/claude-501/-Users-chaitanyasharma-Case-Comps-Deloitte/7d267fcf-9372-4bfd-a52e-c4b4ee2a98b6/scratchpad/deck_build")
import art
W = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(W, p)).read()
def uri(p): return "data:image/png;base64," + base64.b64encode(open(os.path.join(W, "img", p), "rb").read()).decode()

site, app, tpl, js = rd("site.html"), rd("app.js"), rd("vault.html"), rd("vault.js")
site = site.replace("which is why Room 06 is about execution", "which is why chamber 05 is about execution").replace("drives the deal simulator in Room 05", "drives the deal simulator in chamber 04")
base_css = site.split("<style>", 1)[1].split("</style>", 1)[0]

def room(rid):
    m = re.search(r'<section class="room" id="%s"[^>]*>(.*?)</section>' % rid, site, re.S)
    inner = m.group(1)
    th, rest = inner.split('<div class="threshold">', 1)[1].split("</div>", 1)
    eb = re.search(r'<p class="eyebrow">.*?</span><span>(.*?)</span></p>', th, re.S).group(1)
    h2 = re.search(r"<h2>(.*?)</h2>", th, re.S).group(1)
    lede = re.search(r'<p class="lede">(.*?)</p>', th, re.S)
    return eb, h2, (lede.group(1) if lede else ""), rest

CH = ["gap", "choice", "value", "deal", "execution", "data", "roadmap"]
out = []
for i, rid in enumerate(CH):
    eb, h2, lede, rest = room(rid)
    out.append(f'<article class="ch" data-ch="{rid}" aria-label="Chamber {i+1:02d}"><div class="ch-head"><p class="eyebrow"><span class="rn">Chamber {i+1:02d}</span><span>{eb}</span></p><h2>{h2}</h2>'
               + (f'<p class="lede">{lede}</p>' if lede else "") + f"</div>{rest}</article>")
_, _, _, brief = room("answer")
arch = re.search(r'<section class="archive" id="archive"[^>]*>(.*?)</section>', site, re.S).group(1)
arch = re.sub(r'^\s*<p class="eyebrow">.*?</p>', "", arch, count=1, flags=re.S)

w0 = app.index("/* ------------------------------------------------ Q1 waterfall */")
w1 = app.index("/* ------------------------------------------------ the vault (WebGL) */")
charts = app[w0:w1]
assert charts.count("    chart(r);") == 1
charts = charts.replace("    chart(r);", "    chart(r); if (window.__simHook) window.__simHook(r, st);")
js = js.replace("{{CHARTS_JS}}", charts)
js = js.replace("{{ENGINE_JS}}", rd("engine.js"))

rep = {"BASE_CSS": base_css, "CHAMBERS": "\n".join(out), "BRIEF": brief, "ARCHIVE": arch,
       "MODEL_JS": rd("model.js").replace('if (typeof module !== "undefined") module.exports = M;', ""), "APP_JS": js}
s = tpl
for k, v in rep.items(): s = s.replace("{{" + k + "}}", v)
img = {"DELOITTE": uri("deloitte_white.png"), "DELOITTE_DARK": uri("deloitte_dark.png"), "XLRI": uri("xlri.png"), "CAN_BW": uri("can_bw.png"), "CAN_VITAL": uri("can_vital.png")}
for n in set(re.findall(r"\{\{ICON_(\w+)\}\}", s)):
    img["ICON_" + n] = art.icon(n, 40, "#E6EDE7", "#B7F05E", 2.0).replace("<svg ", '<svg aria-hidden="true" ')
for k, v in img.items(): s = s.replace("{{" + k + "}}", v)
left = re.findall(r"\{\{\w+\}\}", s)
assert not left, left[:5]
assert "—" not in s.replace("−", ""), "em dash found"
open(os.path.join(W, "GraftVault.html"), "w").write(s)
head, body = s.split("</style>\n\n<canvas", 1)
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + "</style>\n</head>\n<body>\n<canvas" + body + "\n</body>\n</html>\n")
os.makedirs(os.path.join(W, "dist"), exist_ok=True)
open(os.path.join(W, "dist", "index.html"), "w").write(full)
shutil.copy(os.path.join(W, "dist", "index.html"), "/Users/chaitanyasharma/Case Comps/Deloitte/website/index.html")
print("ok", len(s) // 1024, "KB")
