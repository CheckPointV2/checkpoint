"""Build the team's standalone Room Guide (rbabroomguide/rbabroomguide.github.io)
from CheckPoint's Room Guide.

usage (from anywhere):
    git clone https://github.com/rbabroomguide/rbabroomguide.github.io team-site
    python3 tools/roomguide/port_to_team_site.py <path to this checkpoint repo> team-site

It copies data.js, style.css and shared/tokens.css, and builds app.js / index.html:
photo paths at the site root, Matterport 3D tour button added back (the owner wants it
in the team tool), and the team site's own login gate kept exactly as it is.
Only push the result to the team site after the owner's explicit go.
"""
import sys, shutil, re
cp, team = sys.argv[1], sys.argv[2]

# ---------- data + styles copied as they are ----------
shutil.copy(f"{cp}/roomguide/data.js", f"{team}/data.js")
shutil.copy(f"{cp}/roomguide/style.css", f"{team}/style.css")
shutil.copy(f"{cp}/shared/tokens.css", f"{team}/tokens.css")   # colours, fonts, dark mode

# ---------- app.js ----------
app = open(f"{cp}/roomguide/app.js").read()
team_app = open(f"{team}/app.js").read()


def rep(s, a, b, n=1):
    assert s.count(a) == n, (s.count(a), a[:90])
    return s.replace(a, b)


# photos live at the site root here, not under roomguide/
app = rep(app, "return `roomguide/images/${building}/${roomNum}.jpg`;", "return `images/${building}/${roomNum}.jpg`;")
app = rep(app, "return `roomguide/thumbs/${building}/${roomNum}.jpg`;", "return `thumbs/${building}/${roomNum}.jpg`;")

# 3D tours (Matterport), keyed by room type; shown under the photo
app = rep(app, "const isTouch = window.matchMedia", '''// Matterport 3D tours, keyed by room type code.
const MP = (id) => `https://my.matterport.com/show/?m=${id}`;
const TOUR_URL = {
  KGA: MP("Qgu7kVwVoXV"), KGAOV: MP("Qgu7kVwVoXV"),
  KGE: MP("gWD8XSyYAdX"), KGEOV: MP("gWD8XSyYAdX"),
  SKB: MP("gRomPZk2eGW"), SKC: MP("gRomPZk2eGW"),
  SKA: MP("2CA89aughXW"), SKD: MP("zrX453XZxx3"),
  SKP: MP("6m3GtUFHW4E"), SXA: MP("Q2tQqkVcuqn"),
};

const isTouch = window.matchMedia''')
app = rep(app, '''  const tagsWrap = $("#dTags");''', '''  const tourWrap = $("#dTour");
  const tour = TOUR_URL[room.type];
  if (tourWrap) {
    tourWrap.innerHTML = tour
      ? `<a class="tour-btn" href="${tour}" target="_blank" rel="noopener">🧭 View 3D tour — ${TYPE_DESC[room.type] || room.type}</a>`
      : "";
  }

  const tagsWrap = $("#dTags");''')

# standalone start-up: the team site's own login gate (kept exactly as today), then the guide
auth_block = team_app[team_app.index("/* ================= Auth gate ================="):team_app.index("/* ================= First-visit tour =================")]
app = rep(app, "/* ================= First-visit tour =================", auth_block + "/* ================= First-visit tour =================")
app += '''
// Standalone site (rbabroomguide.github.io): no CheckPoint hub around it.
document.addEventListener("DOMContentLoaded", () => {
  if (isAuthed()) {
    $("#authGate").classList.add("hidden");
    $("#mainApp").style.display = "";
    window.CPMountRoomGuide();
  } else {
    setupAuthGate();
  }
});
'''
# the original gate calls initApp() directly after a good login; route it through the mount guard
# (already done if the team site was built with this script before, so re-running is safe)
OLD_LOGIN = '''      $("#mainApp").style.display = "";
      initApp();
    } else {
      $("#authError").classList.add("show");'''
if OLD_LOGIN in app:
    app = rep(app, OLD_LOGIN, OLD_LOGIN.replace("initApp();", "window.CPMountRoomGuide();"))
assert "initApp();\n    } else {" not in app and "window.CPMountRoomGuide();\n    } else {" in app
open(f"{team}/app.js", "w").write(app)

# ---------- index.html ----------
html = open(f"{cp}/roomguide/index.html").read()
html = rep(html, '''<link rel="stylesheet" href="style.css">''', '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="style.css">
<style>
  /* standalone: the guide's styles are scoped to #view-roomguide, as inside CheckPoint */
  #view-roomguide .auth-gate.hidden { display: none; }
  #view-roomguide .app { padding-top: 0; }
  .tour-btn { display: block; margin: 12px 0 4px; padding: 10px 14px; border-radius: 10px; text-align: center; font-size: 13px; font-weight: 600; text-decoration: none; color: #fff; background: var(--ink, #222); }
  .tour-btn:hover { opacity: .85; }
</style>
<script>
  // theme before first paint (same key as CheckPoint)
  try { document.documentElement.dataset.theme = localStorage.getItem("cp_theme") || "light"; } catch (e) {}
</script>''')
html = rep(html, "<body>\n", '<body>\n<div id="view-roomguide">\n')
html = rep(html, "<script src=\"data.js\"></script>", "</div>\n<script src=\"data.js\"></script>")
html = rep(html, '''        <div class="photo-frame" id="dPhoto"></div>
''', '''        <div class="photo-frame" id="dPhoto"></div>

        <div id="dTour"></div>
''')
open(f"{team}/index.html", "w").write(html)
print("built")
