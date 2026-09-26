/* CheckPoint — Home. Just a greeting: time-of-day message, a rotating
   second line, and a live clock. No stats, no data, on purpose — that
   lives (or used to live) in the tools themselves, not the front door. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);

  const SUBLINES_EN = [
    "Ready when you are.",
    "Let's keep it smooth today.",
    "One thing at a time.",
    "Everything's where you left it.",
    "Take it steady."
  ];
  const SUBLINES_AR = [
    "جاهز عندما تكون جاهزًا.",
    "لنحافظ على سلاسة اليوم.",
    "شيء واحد في كل مرة.",
    "كل شيء كما تركته.",
    "خطوة بخطوة."
  ];

  function greeting(name, hour, arabic) {
    if (arabic) {
      if (hour >= 5 && hour < 12) return `صباح الخير، ${name}`;
      if (hour >= 12 && hour < 17) return `طاب يومك، ${name}`;
      if (hour >= 17 && hour < 24) return `مساء الخير، ${name}`;
      return `ليلة طويلة أمامك، ${name}`;
    }
    if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${name}`;
    if (hour >= 17 && hour < 24) return `Good evening, ${name}`;
    return `Long night ahead, ${name}`;
  }

  // Sunrise → bronze afternoon → deep navy night, blended smoothly by
  // minute-of-day rather than snapping at the same three boundaries the
  // greeting uses, so the background is always mid-transition, never static.
  function gradientForMinute(m) {
    const stops = [
      { at: 0, c: ["#171923", "#20242f", "#171923"] },      // deep night
      { at: 300, c: ["#2b2540", "#a3624f", "#e8b98a"] },    // sunrise (5am)
      { at: 480, c: ["#e8c9a0", "#f2ead9", "#eadfc8"] },    // late morning
      { at: 720, c: ["#c9a24b", "#6b4e33", "#4f3a26"] },    // bronze afternoon (12pm)
      { at: 1020, c: ["#4a3550", "#26314f", "#171923"] },   // dusk (5pm)
      { at: 1260, c: ["#171923", "#20242f", "#171923"] }    // night (9pm)
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (m >= stops[i].at && m <= stops[i + 1].at) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = b.at - a.at || 1;
    const t = Math.max(0, Math.min(1, (m - a.at) / span));
    const mix = (c1, c2, t) => {
      const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const [r1, g1, b1] = p(c1), [r2, g2, b2] = p(c2);
      const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), bl = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r},${g},${bl})`;
    };
    return `linear-gradient(160deg, ${mix(a.c[0], b.c[0], t)}, ${mix(a.c[1], b.c[1], t)} 55%, ${mix(a.c[2], b.c[2], t)})`;
  }

  function wordFade(el, text) {
    el.innerHTML = text.split(" ").map((w, i) =>
      `<span class="home-word" style="animation-delay:${i * 70}ms">${w}</span>`).join(" ");
  }

  function particles(canvas) {
    if (!window.CPMotionOK || !window.CPMotionOK("subtle")) { canvas.hidden = true; return; }
    const ctx = canvas.getContext("2d");
    let w, h, dots, raf;
    function size() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    function makeDots() {
      const n = Math.min(26, Math.max(12, Math.round((w * h) / 45000)));
      dots = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.6 + 0.6,
        vy: -(Math.random() * 0.12 + 0.03),
        vx: (Math.random() - 0.5) * 0.05,
        o: Math.random() * 0.35 + 0.12
      }));
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
        if (d.x < -4) d.x = w + 4; if (d.x > w + 4) d.x = -4;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,172,118,${d.o})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    }
    size(); makeDots(); tick();
    window.addEventListener("resize", () => { size(); makeDots(); });
    return () => cancelAnimationFrame(raf);
  }

  let clockInterval = null, bgInterval = null, stopParticles = null;

  function render(container) {
    const prefs = window.CPPrefs.get();
    const now = new Date();
    const hour = now.getHours();

    container.innerHTML = `
      <div class="home-wrap" id="homeWrap">
        <canvas class="home-particles" id="homeParticles"></canvas>
        <div class="home-center">
          <h1 class="home-greeting cp-serif" id="homeGreeting" dir="${prefs.arabicGreeting ? 'rtl' : 'ltr'}"></h1>
          <p class="home-sub" id="homeSub"></p>
          <div class="home-clock" id="homeClock"></div>
          <div class="home-date" id="homeDate"></div>
        </div>
      </div>`;

    const wrap = $("#homeWrap", container);
    wrap.style.background = gradientForMinute(hour * 60 + now.getMinutes());

    wordFade($("#homeGreeting", container), greeting(prefs.name, hour, prefs.arabicGreeting));

    const lines = prefs.arabicGreeting ? SUBLINES_AR : SUBLINES_EN;
    let idx = 0;
    try { idx = (parseInt(sessionStorage.getItem("cp_home_sub_idx") || "-1", 10) + 1) % lines.length; sessionStorage.setItem("cp_home_sub_idx", String(idx)); } catch (e) {}
    $("#homeSub", container).textContent = lines[idx];

    function tickClock() {
      const d = new Date();
      $("#homeClock", container).textContent = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      $("#homeDate", container).textContent = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    }
    tickClock();
    clearInterval(clockInterval);
    clockInterval = setInterval(tickClock, 1000);

    clearInterval(bgInterval);
    bgInterval = setInterval(() => {
      const d = new Date();
      wrap.style.background = gradientForMinute(d.getHours() * 60 + d.getMinutes());
    }, 60000);

    if (stopParticles) stopParticles();
    stopParticles = particles($("#homeParticles", container));
  }

  window.CPMountHome = function (container) { render(container); };
})();
