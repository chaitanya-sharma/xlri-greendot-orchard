(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const C = { ink: "#E6EDE7", mute: "#A2AFA6", faint: "#6E7B72", green: "#86BC25", neon: "#B7F05E", deep: "#2E7D18", fruit: "#F0A54A", bad: "#EE6A55", warn: "#E9B44C", line: "rgba(160,210,100,.16)", line2: "rgba(160,210,100,.34)" };
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function txt(parent, x, y, s, a) { const t = el("text", Object.assign({ x, y, "font-size": 11, fill: C.mute }, a || {}), parent); t.textContent = s; return t; }
const fmtM = (v) => (v < 0 ? "−$" : "$") + Math.abs(Math.round(v)) + "M";
const fmtS = (v) => (v > 0.5 ? "+$" : v < -0.5 ? "−$" : "$") + Math.abs(Math.round(v)) + "M";
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 60) : ms));

/* ------------------------------------------------ tooltip */
const tip = $("#tip");
function showTip(e, html) { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + "px"; tip.style.top = (e.clientY + 16) + "px"; }
function hideTip() { tip.style.opacity = 0; }

/* ================================================ charts (shared with the chamber content) */
{{CHARTS_JS}}

/* ================================================ sound: synthesised, off until asked for */
const AU = { on: false, ctx: null };
function snd(kind) {
  if (!AU.on) return;
  const c = AU.ctx || (AU.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const t = c.currentTime, out = c.createGain(); out.gain.value = 0.5; out.connect(c.destination);
  const env = (g, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const noise = (dur) => { const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
  if (kind === "tick") { const s = noise(0.03), f = c.createBiquadFilter(), g = c.createGain(); f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 6; env(g, 0.002, 0.22, 0.03); s.connect(f).connect(g).connect(out); s.start(t); }
  if (kind === "bolt" || kind === "deny") {
    const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(kind === "bolt" ? 150 : 95, t); o.frequency.exponentialRampToValueAtTime(kind === "bolt" ? 55 : 70, t + 0.25);
    env(g, 0.004, kind === "bolt" ? 0.5 : 0.3, 0.3); o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
    const s = noise(0.05), f = c.createBiquadFilter(), g2 = c.createGain(); f.type = "highpass"; f.frequency.value = 1800; env(g2, 0.001, 0.12, 0.05); s.connect(f).connect(g2).connect(out); s.start(t);
  }
  if (kind === "open") { const s = noise(3.2), f = c.createBiquadFilter(), g = c.createGain(); f.type = "lowpass"; f.frequency.setValueAtTime(90, t); f.frequency.linearRampToValueAtTime(380, t + 1.6); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1); s.connect(f).connect(g).connect(out); s.start(t); }
  if (kind === "hum") { const o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.value = 110; env(g, 0.3, 0.06, 1.4); o.connect(g).connect(out); o.start(t); o.stop(t + 2); }
  if (kind === "chime") [523.25, 783.99, 1046.5].forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = fq; g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.6); o.connect(g).connect(out); o.start(t + i * 0.09); o.stop(t + 2); });
}

{{ENGINE_JS}}

/* ================================================ the experience */
const vib = (pat) => { try { if (navigator.vibrate) navigator.vibrate(pat); } catch (e) {} };
const CH = [
  { id: "gap", n: "The gap", q: "Q1" }, { id: "choice", n: "The scoring", q: "Q2" }, { id: "value", n: "The value", q: "Q3" },
  { id: "deal", n: "The deal", q: "Q3" }, { id: "execution", n: "Execution", q: "Q4" }, { id: "data", n: "Orchard Engine", q: "Q5" }, { id: "roadmap", n: "The road", q: "Q4" },
];
if (V) V.chamberDoors(CH);
const S = { scene: "", key: -1, tried: new Set(), seen: new Set(), ch: -1, open: false, approved: false };
const scenes = { intro: $("#sIntro"), door: $("#sDoor"), hub: $("#sHub"), ask: $("#sAsk") };
const sheet = $("#sheet"), chs = $$(".ch", sheet), body = document.body;
const hint = $("#hint");
function setHint(t) { hint.textContent = t || ""; hint.classList.toggle("on", !!t); }
function show(name) {
  S.scene = name;
  Object.entries(scenes).forEach(([k, n]) => n.classList.toggle("on", k === name));
  if (name !== "chamber") sheet.classList.remove("on");
  body.classList.toggle("reading", name === "chamber");
  body.classList.toggle("inside", S.open);
  $("#hud").classList.toggle("show-pips", S.open || name === "door");
  const h = { chamber: "#c" + (S.ch + 1), hub: "#plan", door: "#door", ask: "#ask", intro: "" }[name];
  if (h !== undefined) try { history.replaceState(null, "", location.pathname + location.search + h); } catch (e) {}
}

/* board-test pips in the HUD */
const pips = $$(".pip");
function setPips(vals, states) { pips.forEach((p, i) => { p.classList.toggle("on", states[i] !== "shut"); $("b", p).textContent = vals[i]; }); }
const base = M.run(), cash = M.run({ staged: false });
const PLAN = { v: [pct(base.cagr), pct(base.func), pct(base.opm), base.peakCov.toFixed(2) + "x"], s: ["open", "open", "open", "open"] };
window.__simHook = (r) => { if (!S.open) return; setPips([pct(r.cagr), pct(r.func), pct(r.opm), r.peakCov.toFixed(2) + "x"], [r.cagr >= 0.05, r.func >= 0.12, r.opm >= 0.11, r.peakCov <= 2.5].map((x) => (x ? "open" : "shut"))); };

/* ------------------------------------------------ intro: hold the dot */
function holdControl(btn, ms, onProgress, onDone) {
  let p = 0, dir = 0, raf = 0, lastT = 0, done = false;
  const step = (t) => { const dt = lastT ? t - lastT : 16; lastT = t; p = Math.max(0, Math.min(1, p + dir * dt / (dir > 0 ? ms : 400))); onProgress(p); if (p >= 1 && !done) { done = true; dir = 0; onDone(); return; } if (p > 0 || dir > 0) raf = requestAnimationFrame(step); else { raf = 0; lastT = 0; } };
  const start = (e) => { if (done) return; if (e) e.preventDefault(); dir = 1; if (!raf) { lastT = 0; raf = requestAnimationFrame(step); } snd("hum"); };
  const stop = () => { if (done) return; dir = -1; if (!raf) { lastT = 0; raf = requestAnimationFrame(step); } };
  btn.addEventListener("pointerdown", (e) => { try { btn.setPointerCapture(e.pointerId); } catch (err) {} start(e); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e); });
  btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stop(); });
  btn.addEventListener("click", (e) => e.preventDefault());
  return { reset() { p = 0; done = false; dir = 0; onProgress(0); } };
}
const holdBar = $("#holdBar"), holdBtn = $("#hold");
holdControl(holdBtn, 1300, (p) => { holdBar.style.strokeDashoffset = String(396 * (1 - p)); holdBtn.style.transform = `scale(${1 + p * 0.06})`; if (V) V.charge(p); }, () => { if (V) { V.charge(0); V.shake(0.35); } vib([10, 40, 18]); enterDoor(); });
function fitIntro() { if (V) V.to(V.fit(holdBtn.getBoundingClientRect(), V.DOOR_Z, 0.96), 4); }
async function intro() {
  show("intro"); if (V) { V.rings[0].tI = 1; V.dust(0.35); V.torch(0.9); V.st.texpo = 1.15; fitIntro(); V.jump(); }
  const ls = $$(".lines p");
  for (let i = 0; i < ls.length && S.scene === "intro"; i++) { ls.forEach((p, j) => p.classList.toggle("show", j === i)); await wait(i === ls.length - 1 ? 0 : 3200); }
}

/* ------------------------------------------------ the door */
const TODAY = { n: "Today, no deal", v: ["2.4%", "1.1%", "11.0%", "1.20x"], s: ["shut", "shut", "open", "open"] };
const KEYS = [
  { n: "Buy Brightwater, 100% now", d: "$450M, all cash", hint: true,
    v: [pct(cash.cagr), pct(cash.func), pct(cash.opm), cash.peakCov.toFixed(2) + "x"], s: ["open", "open", "open", cash.peakCov <= 2.5 ? "open" : "shut"],
    h: "Right target, wrong structure.", p: `It meets growth, mix and margin. But net debt reaches ${cash.peakCov.toFixed(2)}x EBITDA, past the board's 2.5x limit, and at $450M the seller keeps the value Alderbrook would create: deal NPV is ${fmtS(cash.npv)}.`, w: "Brightwater sold at 4.7x trailing revenue while losing money. Recent peers sold at about 3-4x." },
  { n: "Buy Marrow Lane", d: "$170M for the cold-brew producer",
    v: ["3.4%", "1.1%", "≈ 11%", "1.81x"], s: ["shut", "shut", "hold", "open"],
    h: "Affordable, but too small and the wrong category.", p: "It adds about $80M of revenue by FY29, so growth reaches 3.4%. Cold-brew coffee does not count as better-for-you, and both founders want to leave.", w: "27x EBITDA for a business growing 14%. We would look again after FY28, at a lower price." },
  { n: "Distribution partnership", d: "Carry Brightwater, no equity",
    v: ["≈ 2.4%", "1.1%", "≈ 11%", "1.20x"], s: ["shut", "shut", "hold", "open"],
    h: "Little money at risk, and no brand to keep.", p: "Brightwater's sales stay Brightwater's, so Alderbrook's growth and mix barely move. We would build a brand someone else can take away.", w: "KDP carried BodyArmor and lost it to Coca-Cola in 2018. BodyArmor later paid KDP's bottler $350M to settle." },
  { n: "Partner-to-own", d: "A 25-30% stake plus an option",
    v: ["2.4%", "1.1%", "≈ 11%", "≈ 1.7x"], s: ["shut", "shut", "hold", "open"],
    h: "Sensible, but it does not count by FY29.", p: "A minority stake is not consolidated, so Alderbrook's FY29 revenue and mix stay where they are. It is our fallback if the seller refuses to give up control.", w: "Coca-Cola took 15% of BodyArmor in 2018 and bought the rest in 2021." },
  { n: "Relaunch Vital", d: "$50M over three years",
    v: ["3.2%", "3.2%", "≈ 11%", "≈ 1.2x"], s: ["shut", "shut", "hold", "open"],
    h: "Full control, but too slow.", p: "Vital would need 24-36 months to scale and brings no new capability. 60% of its volume already sells on promotion.", w: "In a study of 83,719 new grocery items, 4 in 10 were gone within two years. We give Vital a different job: the value tier." },
  { n: "The Graft Plan", d: "60% now, the last 40% earned", win: true,
    v: PLAN.v, s: PLAN.s,
    h: "All four locks open.", p: "Buy 60% of Brightwater now at a $370M valuation. Let it earn the last 40% at a capped price. Grow it through Alderbrook's plants, trucks and outlet data.", w: `Deal NPV ${fmtS(base.npv)}, IRR 15%, $234M at close. Leverage peaks at ${base.peakCov.toFixed(2)}x, or 2.36x if the founder's right to sell is treated as debt.` },
];
const keySvg = `<svg viewBox="0 0 30 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="8" r="5"/><circle cx="7" cy="8" r="1.6" fill="currentColor" stroke="none"/><path d="M12 8h16M23 8v4M27 8v3"/></svg>`;
const keysBox = $("#keys");
KEYS.forEach((k, i) => {
  const b = document.createElement("button"); b.className = "key" + (k.hint ? " obvious" : ""); b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<span class="kn" style="color:${k.win ? C.neon : C.mute}">${keySvg}<i>${i + 1}</i></span><div><b>${k.n}</b><span>${k.d}</span></div><span class="sc" data-sc></span>`;
  b.addEventListener("click", () => tryKey(i)); keysBox.appendChild(b);
});
// dial furniture
const knums = [];
(function dial() {
  const tk = $("#ticks"), arcs = $("#arcs");
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, big = i % 10 === 0, r1 = 108, r2 = big ? 118 : 113; el("line", { x1: Math.cos(a) * r1, y1: Math.sin(a) * r1, x2: Math.cos(a) * r2, y2: Math.sin(a) * r2, stroke: big ? "rgba(183,240,94,.7)" : "rgba(160,210,100,.28)", "stroke-width": big ? 1.6 : 1 }, tk); }
  for (let i = 0; i < 6; i++) { const a = (-90 + i * 60) * Math.PI / 180, x = Math.cos(a) * 129, y = Math.sin(a) * 129; const g = el("g", {}, tk); el("circle", { cx: x, cy: y, r: 8.5, fill: "rgba(6,10,7,.9)", stroke: "rgba(183,240,94,.5)" }, g); txt(g, x, y + 4, String(i + 1), { "text-anchor": "middle", "font-size": 11, fill: C.neon, "font-weight": 600 }); knums.push({ g, x, y }); }
  el("path", { d: "M-6,-146 L6,-146 L0,-139 Z", fill: C.neon, style: "filter:drop-shadow(0 0 4px #86BC25)" }, arcs);
  [-90, 0, 90, 180].forEach((deg, i) => { const a0 = (deg - 26) * Math.PI / 180, a1 = (deg + 26) * Math.PI / 180, r = 103; el("path", { d: `M${Math.cos(a0) * r},${Math.sin(a0) * r} A${r},${r} 0 0 1 ${Math.cos(a1) * r},${Math.sin(a1) * r}`, class: "arc shut", "data-i": i }, arcs); });
})();
/* the dial behaves like a combination lock: drag it, it carries momentum, and springs into one of six detents */
const DL = { a: 0, v: 0, t: 0, drag: false, raf: 0, idx: 0 };
const idxAt = (a) => ((Math.round(-a / 60) % 6) + 6) % 6;
function dialRender() {
  $("#ticks").setAttribute("transform", `rotate(${DL.a.toFixed(2)})`);
  knums.forEach((k) => k.g.setAttribute("transform", `rotate(${(-DL.a).toFixed(2)} ${k.x.toFixed(2)} ${k.y.toFixed(2)})`));
  if (V) V.dial(DL.a);
  const i = idxAt(DL.a); if (i !== DL.idx) { DL.idx = i; snd("tick"); vib(3); $$(".key").forEach((b, j) => b.classList.toggle("near", j === i)); }
}
function dialLoop() {
  if (!DL.drag) {
    const dt = 1 / 60, k = 150, c = 2 * Math.sqrt(k) * 0.6; DL.v += (-(DL.a - DL.t) * k - DL.v * c) * dt; DL.a += DL.v * dt;
    if (reduce || (Math.abs(DL.a - DL.t) < 0.04 && Math.abs(DL.v) < 0.5)) { DL.a = DL.t; DL.v = 0; dialRender(); DL.raf = 0; return; }
  }
  dialRender(); DL.raf = requestAnimationFrame(dialLoop);
}
function spinTo(t) { DL.t = t; if (!DL.raf) DL.raf = requestAnimationFrame(dialLoop); }
(function dialDrag() {
  const ds = $("#dialspace"); let wheelT = 0;
  ds.addEventListener("pointerdown", (e) => {
    const r = ds.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = Math.hypot(e.clientX - cx, e.clientY - cy), ring = r.width * (118 / 510);
    if (rad < ring * 0.62 || rad > ring * 1.55) return;
    Object.assign(DL, { drag: true, cx, cy, p0: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI, moved: 0, la: DL.a, lt: performance.now() });
    try { ds.setPointerCapture(e.pointerId); } catch (err) {} ds.classList.add("grabbing"); if (!DL.raf) DL.raf = requestAnimationFrame(dialLoop); e.preventDefault();
  });
  ds.addEventListener("pointermove", (e) => {
    if (!DL.drag) return; const p = Math.atan2(e.clientY - DL.cy, e.clientX - DL.cx) * 180 / Math.PI; let d = p - DL.p0; d = ((d + 540) % 360) - 180;
    DL.a += d; DL.p0 = p; DL.moved += Math.abs(d); const now = performance.now(), dtm = Math.max(8, now - DL.lt); DL.v = DL.v * 0.6 + ((DL.a - DL.la) / dtm * 1000) * 0.4; DL.la = DL.a; DL.lt = now;
  });
  const end = () => { if (!DL.drag) return; DL.drag = false; ds.classList.remove("grabbing"); if (DL.moved < 4) return; const snap = Math.round((DL.a + DL.v * 0.14) / 60) * 60; spinTo(snap); const i = idxAt(snap); setTimeout(() => tryKey(i, true), 420); };
  ds.addEventListener("pointerup", end); ds.addEventListener("pointercancel", end);
  ds.addEventListener("wheel", (e) => { e.preventDefault(); const now = performance.now(); if (now - wheelT < 260) return; wheelT = now; tryKey((idxAt(DL.t) + (e.deltaY > 0 ? 1 : -1) + 6) % 6); }, { passive: false });
})();
function paintLocks(k, animate) {
  const lks = $$(".lk"), arcs = $$("#arcs .arc");
  k.s.forEach((s, i) => {
    setTimeout(() => {
      const lk = lks[i], prev = lk.dataset.s;
      lk.className = "lk " + "NESW"[i] + " " + s; lk.dataset.s = s;
      $(".v", lk).textContent = k.v[i]; $(".st", lk).textContent = s === "shut" ? "Locked" : s === "hold" ? "Holds, about today" : "Open";
      arcs[i].setAttribute("class", "arc " + s);
      if (V) V.bolt(i, s !== "shut");
      if (animate && prev && prev !== s) { snd(s === "shut" ? "deny" : "bolt"); vib(s === "shut" ? [20, 30, 20] : 14); if (V) V.shake(s === "shut" ? 0.12 : 0.06); }
      if (animate && s === "shut") { lk.classList.add("jolt"); }
    }, animate ? 260 + i * 170 : 0);
  });
  const n = k.s.filter((s) => s !== "shut").length;
  $("#dialK").textContent = k.n; $("#dialC").innerHTML = `${n}<small> / 4 open</small>`;
}
function verdict(k, i) {
  const v = $("#verdict");
  if (!k) { v.className = "verdict"; v.innerHTML = `<p class="kicker">Where Alderbrook stands</p><h3>Two of four locks open today.</h3><p>Margin and leverage hold. Growth is 2.4% a year against a 5-6% target, and better-for-you drinks are about 1% of revenue against 12%.</p><p class="why">Pick a key on the left. The bolts move as each test passes or fails, using FY29 figures from our model.</p>`; return; }
  v.className = "verdict fadeswap" + (k.win ? " win" : "");
  v.innerHTML = `<p class="kicker" style="color:${k.win ? C.neon : C.mute}">Key ${i + 1} · ${k.n}</p><h3>${k.h}</h3><p>${k.p}</p><p class="why">${k.w}</p>` +
    (k.win ? `<button class="btn go" id="openVault">Open the vault →</button>` : S.tried.size >= 2 && !S.tried.has(5) ? `<p class="why" style="color:var(--neon)">Every key so far fixes one test by breaking another. Try the last one.</p>` : "");
  void v.offsetWidth;
  if (k.win) $("#openVault").addEventListener("click", openVault);
}
function tryKey(i, fromDial) {
  const k = KEYS[i]; S.key = i; S.tried.add(i);
  if (!fromDial) { const b0 = -i * 60; spinTo(b0 + 360 * Math.round((DL.a - b0) / 360)); }
  $$(".key").forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.classList.remove("obvious"); });
  const sc = $$(".key [data-sc]")[i], n = k.s.filter((s) => s !== "shut").length; sc.textContent = n + "/4"; sc.classList.toggle("full", n === 4);
  $("#tried").textContent = `${S.tried.size} of 6 tried`;
  paintLocks(k, true); verdict(k, i); setPips(k.v, k.s);
}
function fitDoor() { if (V && S.scene === "door") V.to(Object.assign(V.fit($("#dialspace").getBoundingClientRect(), V.DOOR_Z, 200 / 510), { par: 0.35 }), V.st.rate); }
$("#sDoor .in").addEventListener("scroll", () => { if (V) { fitDoor(); V.st.rate = 9; } }, { passive: true });
async function enterDoor() {
  if (S.scene === "door") return;
  show("door"); paintLocks(TODAY, false); verdict(null); setPips(TODAY.v, TODAY.s);
  if (V) { V.approach(); V.dust(1); V.torch(0.22); V.st.texpo = 1; V.st.rate = 0.9; fitDoor(); setTimeout(fitDoor, 1100); }
  setHint("Drag the dial, scroll on it, or pick a key");
  setTimeout(() => setHint(""), 6000);
}
async function openVault() {
  if (S.open) return; S.open = true;
  [0, 1, 2, 3].forEach((i) => V && V.bolt(i, true));
  snd("open"); setHint(""); show("hub-wait"); scenes.door.classList.remove("on");
  vib([30, 60, 30, 60, 80]);
  if (V) { await wait(500); V.shake(1); V.burst(); V.swing(true); await wait(700); V.interior(); V.st.rate = 0.75; V.to({ x: 0, y: 3.1, z: V.DOOR_Z - 3.5, yaw: 0 }); V.rings[0].tI = 0.35; await wait(2300); }
  setPips(PLAN.v, PLAN.s); hub();
}

/* ------------------------------------------------ the plan of the vault */
const plan = $("#plan");
let vertical = null;
function drawPlan() {
  const v = innerWidth < 700; if (v === vertical && plan.childNodes.length) { paintPlan(); return; } vertical = v; plan.innerHTML = "";
  plan.setAttribute("viewBox", v ? "0 0 340 640" : "0 0 1000 300");
  const g = (a) => el("g", a || {}, plan);
  const P = v ? { cx: 170, y0: 50, y1: 590 } : { cy: 150, x0: 70, x1: 905 };
  // corridor
  if (v) { el("rect", { x: P.cx - 26, y: P.y0, width: 52, height: P.y1 - P.y0, fill: "rgba(183,240,94,.04)", stroke: C.line2 }, plan); }
  else { el("rect", { x: P.x0, y: P.cy - 26, width: P.x1 - P.x0, height: 52, fill: "rgba(183,240,94,.04)", stroke: C.line2 }, plan); }
  for (let i = 0; i < 24; i++) { const f = (i + 0.5) / 24; if (v) { [-1, 1].forEach((s) => el("circle", { cx: P.cx + s * 22, cy: P.y0 + f * (P.y1 - P.y0), r: 1.6, fill: C.neon, opacity: 0.55 }, plan)); } else { [-1, 1].forEach((s) => el("circle", { cx: P.x0 + f * (P.x1 - P.x0), cy: P.cy + s * 22, r: 1.6, fill: C.neon, opacity: 0.55 }, plan)); } }
  // door
  const dg = g(); if (v) { el("circle", { cx: P.cx, cy: P.y0 - 8, r: 18, fill: "none", stroke: C.neon, "stroke-width": 2 }, dg); txt(dg, P.cx + 30, P.y0 - 4, "THE DOOR", { "font-size": 10, fill: C.mute, "letter-spacing": "1.4" }); }
  else { el("circle", { cx: P.x0 - 10, cy: P.cy, r: 20, fill: "none", stroke: C.neon, "stroke-width": 2 }, dg); txt(dg, P.x0 - 10, P.cy + 44, "THE DOOR", { "text-anchor": "middle", "font-size": 10, fill: C.mute, "letter-spacing": "1.4" }); }
  // chambers
  CH.forEach((c, k) => {
    const s = k % 2 === 0 ? -1 : 1, f = (k + 0.5) / 7.6;
    const rg = g({ class: "room-g", tabindex: 0, role: "button", "aria-label": `Chamber ${k + 1}: ${c.n}, ${c.q}`, "data-k": k });
    let bx, by, bw, bh, cx, cy;
    if (v) { bw = 116; bh = 60; cy = P.y0 + f * (P.y1 - P.y0); by = cy - bh / 2; bx = s < 0 ? P.cx - 26 - 14 - bw : P.cx + 26 + 14; el("line", { x1: s < 0 ? bx + bw : bx, x2: P.cx + s * 26, y1: cy, y2: cy, stroke: C.line2 }, rg); }
    else { bw = 102; bh = 74; cx = P.x0 + f * (P.x1 - P.x0); bx = cx - bw / 2; by = s < 0 ? P.cy - 26 - 18 - bh : P.cy + 26 + 18; el("line", { x1: cx, x2: cx, y1: s < 0 ? by + bh : by, y2: P.cy + s * 26, stroke: C.line2 }, rg); }
    el("rect", { class: "box", x: bx, y: by, width: bw, height: bh, rx: 1 }, rg);
    txt(rg, bx + 10, by + 30, String(k + 1).padStart(2, "0"), { "font-size": 24, fill: C.neon, style: "font-family:Newsreader,Georgia,serif" });
    txt(rg, bx + bw - 10, by + 18, c.q, { "text-anchor": "end", "font-size": 10, fill: C.mute, "font-weight": 600 });
    txt(rg, bx + 10, by + bh - 12, c.n, { "font-size": 12, fill: C.ink, style: "font-family:Archivo,sans-serif", "font-weight": 600 });
    el("circle", { class: "seenmark", cx: bx + bw - 12, cy: by + bh - 16, r: 4, fill: C.neon, opacity: 0 }, rg);
    rg.addEventListener("click", () => openChamber(k));
    const hov = (on) => { if (!V || S.scene !== "hub") return; V.hoverChamber(on ? k : -1); V.st.thy = on ? s * 0.05 : 0; };
    rg.addEventListener("pointerenter", () => hov(true)); rg.addEventListener("pointerleave", () => hov(false)); rg.addEventListener("focus", () => hov(true)); rg.addEventListener("blur", () => hov(false));
    rg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openChamber(k); } });
  });
  // board room
  const br = g({ class: "room-g", tabindex: 0, role: "button", "aria-label": "The board room", "data-k": "ask" });
  if (v) { el("rect", { class: "box", x: P.cx - 70, y: P.y1 + 4, width: 140, height: 40 }, br); txt(br, P.cx, P.y1 + 29, "THE BOARD ROOM", { "text-anchor": "middle", "font-size": 11, fill: C.neon, "font-weight": 600, "letter-spacing": "1.2" }); }
  else { el("rect", { class: "box", x: P.x1, y: P.cy - 70, width: 84, height: 140 }, br); el("circle", { cx: P.x1 + 42, cy: P.cy - 14, r: 20, fill: "none", stroke: C.neon, "stroke-width": 1.6 }, br); txt(br, P.x1 + 42, P.cy + 30, "BOARD", { "text-anchor": "middle", "font-size": 10.5, fill: C.neon, "font-weight": 600, "letter-spacing": "1.2" }); txt(br, P.x1 + 42, P.cy + 44, "ROOM", { "text-anchor": "middle", "font-size": 10.5, fill: C.neon, "font-weight": 600, "letter-spacing": "1.2" }); }
  br.addEventListener("click", goAsk); br.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goAsk(); } });
  // you are here
  el("circle", { id: "here", r: 6, fill: C.neon, style: "filter:drop-shadow(0 0 6px #86BC25)" }, plan);
  el("circle", { id: "here2", r: 6, fill: "none", stroke: C.neon, opacity: 0.6 }, plan);
  if (!reduce) { const an = el("animate", { attributeName: "r", values: "6;16;6", dur: "2.2s", repeatCount: "indefinite" }, $("#here2")); const an2 = el("animate", { attributeName: "opacity", values: ".6;0;.6", dur: "2.2s", repeatCount: "indefinite" }, $("#here2")); void an; void an2; }
  paintPlan();
}
function paintPlan() {
  const v = vertical, P = v ? { cx: 170, y0: 50, y1: 590 } : { cy: 150, x0: 70, x1: 905 };
  $$(".room-g", plan).forEach((r) => { const k = +r.dataset.k; if (isNaN(k)) return; r.classList.toggle("seen", S.seen.has(k)); $(".seenmark", r).setAttribute("opacity", S.seen.has(k) ? 1 : 0); });
  const f = S.ch < 0 ? 0 : (S.ch + 0.5) / 7.6;
  const hx = v ? P.cx : P.x0 + f * (P.x1 - P.x0) + (S.ch < 0 ? 8 : 0), hy = v ? P.y0 + f * (P.y1 - P.y0) + (S.ch < 0 ? 8 : 0) : P.cy;
  ["#here", "#here2"].forEach((id) => { const c = $(id, plan); c.setAttribute("cx", hx); c.setAttribute("cy", hy); });
  $("#planWhere").textContent = S.ch < 0 ? "You are at the door" : `You are at chamber ${String(S.ch + 1).padStart(2, "0")}`;
  $("#count").innerHTML = `<b>${S.seen.size}</b> of 7 chambers opened · ← → to move between chambers · Esc for this plan`;
  const next = CH.findIndex((_, k) => !S.seen.has(k));
  $("#startTour").textContent = next < 0 ? "All seven opened. Go to the board room →" : `Open chamber ${String(next + 1).padStart(2, "0")}, ${CH[next].n} →`;
  $("#startTour").dataset.k = next;
}
function hub() {
  show("hub"); drawPlan(); playPlan(); if (V) { V.torch(0.16); V.hoverChamber(-1); V.st.thy = 0; }
  if (V) { V.st.rate = 1.1; if (S.ch >= 0) { const p = V.chamberPose(S.ch); V.to({ x: 0, y: 2.9, z: p.z + 3, yaw: 0 }); } else V.to({ x: 0, y: 3.1, z: V.DOOR_Z - 3.5, yaw: 0 }); }
}
$("#startTour").addEventListener("click", (e) => { const k = +e.currentTarget.dataset.k; k < 0 || isNaN(k) ? goAsk() : openChamber(k); });
$("#toAsk").addEventListener("click", goAsk);


/* ------------------------------------------------ motion for the content: charts draw in, figures count up */
function playCharts(root) {
  if (reduce || !root.animate) return;
  $$("svg.chart", root).forEach((svg) => {
    const vb = svg.viewBox && svg.viewBox.baseVal, W0 = (vb && vb.width) || 600, X0 = (vb && vb.x) || 0;
    $$("rect", svg).forEach((r) => { let bb; try { bb = r.getBBox(); } catch (e) { return; } if (bb.width > W0 * 0.55 || bb.height < 3) return;
      r.style.transformBox = "fill-box"; r.style.transformOrigin = bb.width > bb.height * 1.5 ? "0% 50%" : "50% 100%";
      r.animate([{ transform: bb.width > bb.height * 1.5 ? "scaleX(0)" : "scaleY(0)" }, { transform: "none" }], { duration: 760, delay: 140 + ((bb.x - X0) / W0) * 560, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }); });
    $$("polyline, path", svg).forEach((pth) => { if (pth.getAttribute("stroke-dasharray") || (pth.getAttribute("fill") && pth.getAttribute("fill") !== "none") || !pth.getAttribute("stroke")) return;
      let len; try { len = pth.getTotalLength(); } catch (e) { return; } if (len < 40) return;
      pth.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], { duration: 1200, delay: 240, easing: "cubic-bezier(.3,.7,.2,1)" }); });
    $$("circle", svg).forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 160 + (((+c.getAttribute("cx") || 0) - X0) / W0) * 700, fill: "backwards" }));
    $$("text", svg).forEach((tn) => tn.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 380, fill: "backwards" }));
  });
  $$(".gantt .bx", root).forEach((b, i) => b.animate([{ transform: "scaleX(0)", transformOrigin: "0 50%" }, { transform: "scaleX(1)", transformOrigin: "0 50%" }], { duration: 700, delay: 200 + i * 45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  $$(".gantt .ms", root).forEach((b, i) => b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 600 + i * 80, fill: "backwards" }));
}
function countUp(root) {
  if (reduce) return;
  $$(".big, .sig .v, .test .v, .lane .p, .steps2 .n, .tr .t", root).forEach((n) => {
    if (n.dataset.final === undefined) n.dataset.final = n.textContent;
    const f = n.dataset.final, m = /^([\s+−\-$]*)(\d[\d,]*(?:\.\d+)?)/.exec(f); if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length, comma = m[2].includes(","), rest = f.slice(m[0].length), t0 = performance.now(), dur = 1000;
    const fmt = (v) => { let s = v.toFixed(dec); if (comma) s = Number(s).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }); return m[1] + s + rest; };
    const step = (now) => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); n.textContent = p < 1 ? fmt(target * e) : f; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function playPlan() {
  if (reduce || !plan.animate) return;
  $$("rect, line, circle", plan).forEach((n, i) => n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 300 + Math.min(i, 60) * 14, fill: "backwards" }));
  $$(".room-g", plan).forEach((g, i) => g.animate([{ transform: "translateY(6px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 600, delay: 450 + i * 70, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
}

/* ------------------------------------------------ chambers */
const dots = $("#dots"); CH.forEach(() => dots.appendChild(document.createElement("i")));
function openChamber(k) {
  if (!S.open) { openFast(); }
  const prev = S.ch; S.ch = k; S.seen.add(k);
  chs.forEach((c, i) => { c.classList.toggle("cur", i === k); c.classList.remove("play"); });
  const side = k % 2 === 0 ? -1 : 1;
  sheet.classList.toggle("left", side > 0);
  $("#crumb").innerHTML = `Chamber ${String(k + 1).padStart(2, "0")} <span>· ${CH[k].q} · ${CH[k].n}</span>`;
  $$("i", dots).forEach((d, i) => { d.className = i === k ? "cur" : S.seen.has(i) ? "seen" : ""; });
  $("#shPrev").textContent = k > 0 ? `← ${String(k).padStart(2, "0")} ${CH[k - 1].n}` : "← The plan";
  $("#shNext").textContent = k < 6 ? `${String(k + 2).padStart(2, "0")} ${CH[k + 1].n} →` : "The board room →";
  if (V) { V.st.rate = 1.25; V.to(V.chamberPose(k)); V.torch(0); V.hoverChamber(-1); V.st.thy = 0; if (prev >= 0) V.litChamber(prev, false); V.litChamber(k, true); }
  const was = S.scene === "chamber"; show("chamber");
  sheet.classList.remove("on"); void sheet.offsetWidth;
  setTimeout(() => {
    sheet.classList.add("on"); $("#shBody").scrollTop = 0; chs[k].classList.add("play");
    dispatchEvent(new Event("resize")); playCharts(chs[k]); countUp(chs[k]);
  }, was ? 220 : 520);
}
$("#shPrev").addEventListener("click", () => (S.ch > 0 ? openChamber(S.ch - 1) : hub()));
$("#shNext").addEventListener("click", () => (S.ch < 6 ? openChamber(S.ch + 1) : goAsk()));
$("#shPlan").addEventListener("click", hub);
$("#bPlan").addEventListener("click", hub);

/* ------------------------------------------------ board room */
const ringed = $("#ringed"), askIn = $("#askIn");
function fitAsk(rate) { if (!V || S.scene !== "ask") return; if (S.approved) { const d = $("#askDot").getBoundingClientRect(); V.collapse(1, { left: d.left - d.width * 1.1, top: d.top - d.height * 1.1, width: d.width * 3.2, height: d.height * 3.2 }); return; } V.to(Object.assign(V.fit(ringed.getBoundingClientRect(), V.Z1 + 0.5, 0.98), { par: 0.2 }), rate || V.st.rate); }
askIn.addEventListener("scroll", () => fitAsk(9), { passive: true });
async function goAsk() {
  if (!S.open) openFast();
  if (V) { if (S.ch >= 0) V.litChamber(S.ch, false); V.allOn(); V.rings[1].tI = 1; V.torch(0.06); V.st.rate = 1.3; }
  show("ask"); askIn.scrollTop = 0; await wait(30); fitAsk(1.3);
}
const apFill = $("#apFill"), apBtn = $("#approve");
const approveCtl = holdControl(apBtn, 1500, (p) => { apFill.style.transform = `scaleX(${p})`; apBtn.classList.toggle("filling", p > 0.5); }, async () => {
  S.approved = true; snd("chime"); vib([20, 50, 40]); if (V) { V.wave(V.Z1, 1, 34, 1.1); V.shake(0.25); }
  if (V) { V.st.par = 0; V.st.mx = V.st.my = 0; await wait(250); const d = $("#askDot").getBoundingClientRect(); V.collapse(1, { left: d.left - d.width * 1.1, top: d.top - d.height * 1.1, width: d.width * 3.2, height: d.height * 3.2 }); }
  await wait(1100); scenes.ask.classList.add("done");
});
$("#again").addEventListener("click", () => { location.hash = ""; location.reload(); });
$("#askPlan").addEventListener("click", () => { hub(); });
$("#askArch").addEventListener("click", () => overlay("oArch", true));

/* ------------------------------------------------ overlays, HUD, keys */
let lastFocus = null;
function overlay(id, on) {
  const o = $("#" + id); if (on) { lastFocus = document.activeElement; $$(".ovl.on").forEach((x) => x.classList.remove("on")); }
  o.classList.toggle("on", on); if (on) setTimeout(() => $("[data-close]", o).focus(), 50); else if (lastFocus) lastFocus.focus();
}
$$(".ovl").forEach((o) => { o.addEventListener("click", (e) => { if (e.target === o) overlay(o.id, false); }); $("[data-close]", o).addEventListener("click", () => overlay(o.id, false)); });
$("#bBrief").addEventListener("click", () => overlay("oBrief", true));
$("#skipBrief").addEventListener("click", () => overlay("oBrief", true));
$("#bArch").addEventListener("click", () => overlay("oArch", true));
$("#bSound").addEventListener("click", (e) => { AU.on = !AU.on; e.currentTarget.setAttribute("aria-pressed", String(AU.on)); e.currentTarget.textContent = AU.on ? "Sound on" : "Sound"; if (AU.on) snd("tick"); });
addEventListener("keydown", (e) => {
  const t = e.target; if (e.metaKey || e.ctrlKey || e.altKey) return;
  const open = $(".ovl.on");
  if (e.key === "Escape") { if (open) return overlay(open.id, false); if (S.scene === "chamber" || S.scene === "ask") return hub(); }
  if (open || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  if (S.scene === "door" && /^[1-6]$/.test(e.key)) tryKey(+e.key - 1);
  if (S.scene === "hub" && /^[1-7]$/.test(e.key)) openChamber(+e.key - 1);
  if (S.scene === "chamber" && (e.key === "ArrowRight" || e.key === "ArrowLeft") && t.type !== "range") {
    e.preventDefault(); e.key === "ArrowRight" ? (S.ch < 6 ? openChamber(S.ch + 1) : goAsk()) : (S.ch > 0 ? openChamber(S.ch - 1) : hub());
  }
});
addEventListener("resize", () => { if (S.scene === "door") fitDoor(); if (S.scene === "intro") fitIntro(); if (S.scene === "ask") fitAsk(9); if (S.scene === "hub") drawPlan(); });

/* returning visitors and deep links skip straight to where they were */
function openFast() { S.open = true; if (V) { V.allOn(); V.swing(true); [0, 1, 2, 3].forEach((i) => V.bolt(i, true)); V.rings[0].tI = 0.35; V.dust(1); } setPips(PLAN.v, PLAN.s); }
(function boot() {
  const h = location.hash.slice(1), m = /^c([1-7])$/.exec(h);
  if (m || h === "plan" || h === "ask") {
    openFast();
    if (V) { V.to({ x: 0, y: 2.9, z: V.DOOR_Z - 7 }); V.jump(); }
    if (m) { openChamber(+m[1] - 1); if (V) V.jump(); } else if (h === "ask") { goAsk(); setTimeout(() => V && V.jump(), 60); } else hub();
  } else if (h === "door") { enterDoor(); if (V) { V.allOn(); setTimeout(() => { fitDoor(); V.jump(); }, 40); } }
  else intro();
  if (document.fonts) document.fonts.ready.then(() => { if (S.scene === "intro") fitIntro(); });
})();
})();
