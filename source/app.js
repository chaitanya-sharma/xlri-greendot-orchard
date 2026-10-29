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

/* ------------------------------------------------ tooltip */
const tip = $("#tip");
function showTip(e, html) { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + "px"; tip.style.top = (e.clientY + 16) + "px"; }
function hideTip() { tip.style.opacity = 0; }

/* ------------------------------------------------ navigation */
const rooms = $$("[data-room]");
const rail = $("#rail"), menu = $("#menu"), where = $("#where"), menuBtn = $("#menuBtn");
const railLinks = [];
rooms.forEach((r, i) => {
  if (i === 0) return;
  const a = document.createElement("a"); a.href = "#" + r.id; a.innerHTML = `<span>${r.dataset.short}</span><i></i>`; rail.appendChild(a); railLinks[i] = a;
  const m = document.createElement("a"); m.href = "#" + r.id; m.innerHTML = `<small>${String(i).padStart(2, "0")}</small>${r.dataset.short}`; menu.appendChild(m);
  m.addEventListener("click", () => toggleMenu(false));
});
function toggleMenu(open) { menu.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); menuBtn.textContent = open ? "Close" : "Rooms"; }
menuBtn.addEventListener("click", () => toggleMenu(menu.hidden));
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menu.hidden) toggleMenu(false);
  const t = e.target; if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(t.tagName)) return;
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const anchors = $$(".hero, .threshold, .plate, .sowhat, .ask, .finale, .archive").map((n) => n.getBoundingClientRect().top + scrollY - 84).sort((a, b) => a - b);
  let target;
  if (e.key === "ArrowDown") target = anchors.find((y) => y > scrollY + 12);
  else target = [...anchors].reverse().find((y) => y < scrollY - 12);
  if (target === undefined) return;
  e.preventDefault(); scrollTo({ top: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
});

/* ------------------------------------------------ Q1 waterfall */
function waterfall(plan) {
  const svg = $("#waterfall"); svg.innerHTML = "";
  const L = 58, R = 640, T = 30, B = 252, lo = 1600, hi = 2340, y = (v) => B - (v - lo) / (hi - lo) * (B - T);
  [1600, 1800, 2000, 2200].forEach((v) => { el("line", { x1: L, x2: R, y1: y(v), y2: y(v), stroke: C.line }, svg); txt(svg, L - 8, y(v) + 4, v.toLocaleString("en-US"), { "text-anchor": "end", "font-size": 10, fill: C.faint }); });
  el("rect", { x: L, y: y(2272), width: R - L, height: y(2188) - y(2272), fill: "rgba(183,240,94,.12)" }, svg);
  [2188, 2272].forEach((v) => el("line", { x1: L, x2: R, y1: y(v), y2: y(v), stroke: C.neon, "stroke-dasharray": "4 4", "stroke-width": 1 }, svg));
  txt(svg, L + 4, y(2272) - 8, "Board target for FY29: $2,188-2,272M (5-6% a year)", { fill: C.neon, "font-size": 10.5, "font-weight": 600 });
  const bars = [["FY25", 0, 1800, "t"], ["Juice", 1800, 1722, "n"], ["Iced tea", 1722, 1722, "z"], ["Sparkling", 1722, 1867, "p"], ["Hydration|& other", 1867, 1979, "p"], ["FY29|status quo", 0, 1979, "t"]];
  if (plan) bars.push(["Brightwater", 1979, 2224, "g"], ["Data|uplift", 2224, 2234, "g"], ["FY29|with plan", 0, 2234, "tg"]);
  const n = bars.length, slot = (R - L - 6) / n, bw = Math.min(50, slot * 0.6);
  let prev = null;
  bars.forEach(([name, a, b, k], i) => {
    const x = L + 6 + i * slot + (slot - bw) / 2;
    let top, bot, col;
    if (k[0] === "t") { top = y(b); bot = y(lo); col = k === "tg" ? C.neon : "#D9E2DB"; }
    else if (k === "z") { top = y(a) - 1; bot = y(a) + 1; col = C.faint; }
    else { top = y(Math.max(a, b)); bot = y(Math.min(a, b)); col = k === "n" ? C.bad : k === "g" ? C.neon : C.green; }
    el("rect", { x, y: top, width: bw, height: Math.max(bot - top, 2), fill: col }, svg);
    const lbl = k[0] === "t" ? b.toLocaleString("en-US") : k === "z" ? "0" : (b - a > 0 ? "+" : "−") + Math.abs(b - a);
    txt(svg, x + bw / 2, top - 7, lbl, { "text-anchor": "middle", fill: C.ink, "font-size": 11, "font-weight": 600 });
    name.split("|").forEach((ln, j) => txt(svg, x + bw / 2, B + 16 + j * 13, ln, { "text-anchor": "middle", "font-size": 10 }));
    if (prev) el("line", { x1: prev.x, x2: x, y1: prev.y, y2: prev.y, stroke: C.faint, "stroke-dasharray": "2 3" }, svg);
    prev = { x: x + bw, y: y(b) };
  });
  if (!plan) {
    const x = prev.x + 6;
    el("path", { d: `M${x},${y(1979)} h7 V${y(2272)} h-7 M${x},${y(2188)} h7`, stroke: C.bad, fill: "none", "stroke-width": 1.5 }, svg);
    txt(svg, prev.x - 2, y(2128), "Gap to target", { "text-anchor": "end", fill: C.bad, "font-weight": 600, "font-size": 11 });
    txt(svg, prev.x - 2, y(2128) + 14, "$209-294M", { "text-anchor": "end", fill: C.bad, "font-weight": 600, "font-size": 11 });
  }
}
const wfBase = $("#wfBase"), wfPlan = $("#wfPlan");
function setWf(plan) { wfBase.setAttribute("aria-pressed", String(!plan)); wfPlan.setAttribute("aria-pressed", String(plan)); waterfall(plan); }
wfBase.addEventListener("click", () => setWf(false)); wfPlan.addEventListener("click", () => setWf(true));
waterfall(false);

/* ------------------------------------------------ Q1 shelf check */
(function shelf() {
  const svg = $("#shelf");
  const rows = [
    ["LaCroix sparkling water", [[0.50, "8-pack at $3.97, on rollback"]]],
    ["Pepsi", [[0.59, "24-pack at $14.24"]]],
    ["Pepsi Prebiotic Cola", [[0.87, "8-pack at $6.97, on rollback"], [1.03, "8-pack list price, $8.27", 1]]],
    ["Walmart bettergoods prebiotic", [[1.58, "single can at $1.58"]]],
    ["Poppi", [[1.62, "8-pack at $12.98"], [1.74, "4-pack at $6.97"], [2.00, "12-pack at $23.97"]]],
    ["Bloom Pop", [[1.87, "4-pack at $7.48"]]],
    ["Olipop", [[1.97, "4-pack at $7.88"], [1.98, "12-pack at $23.78"]]],
    ["Vital, our plan", [[1.25, "12-pack at about $15"]], "plan"],
    ["Brightwater, our plan", [[1.95, "4-pack at about $7.80"]], "plan"],
  ];
  const X0 = 300, X1 = 1060, x = (v) => X0 + v / 2.6 * (X1 - X0), y0 = 52, rh = 27;
  const yAt = (i) => y0 + i * rh + (i >= 7 ? 14 : 0);
  el("rect", { x: x(0.85), y: 22, width: x(1.6) - x(0.85), height: yAt(8) + 18 - 22, fill: "rgba(134,188,37,.09)" }, svg);
  el("rect", { x: x(1.6), y: 22, width: x(2.55) - x(1.6), height: yAt(8) + 18 - 22, fill: "rgba(240,165,74,.08)" }, svg);
  txt(svg, x(0.85) + 8, 36, "VALUE LANE", { fill: C.green, "font-size": 10, "font-weight": 600, "letter-spacing": "1.5" });
  txt(svg, x(1.6) + 8, 36, "PREMIUM LANE", { fill: C.fruit, "font-size": 10, "font-weight": 600, "letter-spacing": "1.5" });
  [0, 0.5, 1, 1.5, 2, 2.5].forEach((v) => { txt(svg, x(v), 14, "$" + v.toFixed(2), { "text-anchor": "middle", "font-size": 10, fill: C.faint }); });
  el("line", { x1: 20, x2: X1, y1: yAt(7) - 20, y2: yAt(7) - 20, stroke: C.line2 }, svg);
  rows.forEach(([name, vals, plan], i) => {
    const yy = yAt(i);
    txt(svg, X0 - 18, yy + 4, name, { "text-anchor": "end", "font-size": 12, fill: plan ? C.neon : C.ink, "font-weight": plan ? 600 : 400 });
    el("line", { x1: X0, x2: X1, y1: yy, y2: yy, stroke: C.line, "stroke-dasharray": "2 5" }, svg);
    const vs = vals.map((v) => v[0]);
    if (vs.length > 1) el("line", { x1: x(Math.min(...vs)), x2: x(Math.max(...vs)), y1: yy, y2: yy, stroke: C.ink, "stroke-width": 2 }, svg);
    vals.forEach(([v, d, hollow]) => {
      const c = el("circle", { cx: x(v), cy: yy, r: plan ? 8 : 6.5, fill: plan ? C.neon : hollow ? "#0A0F0C" : C.ink, stroke: plan ? C.green : C.ink, "stroke-width": 2, tabindex: 0, style: "cursor:pointer" }, svg);
      const html = `<b>${name}</b><br>${d}<br>$${v.toFixed(2)} a can`;
      c.addEventListener("mousemove", (e) => showTip(e, html)); c.addEventListener("mouseleave", hideTip);
      c.addEventListener("focus", () => { const r = c.getBoundingClientRect(); showTip({ clientX: r.right, clientY: r.bottom }, html); }); c.addEventListener("blur", hideTip);
    });
    const hollow = vals.some((v) => v[2]);
    const lab = plan ? "about $" + vs[0].toFixed(2) : hollow ? "$" + vs[0].toFixed(2) + " (list $" + vs[1].toFixed(2) + ")" : vs.length > 1 ? "$" + Math.min(...vs).toFixed(2) + "-" + Math.max(...vs).toFixed(2) : "$" + vs[0].toFixed(2);
    txt(svg, x(Math.max(...vs)) + 14, yy + 4, lab, { "font-size": 11, fill: plan ? C.neon : C.mute, "font-weight": plan ? 600 : 400 });
  });
  txt(svg, X1, yAt(8) + 40, "Pepsi's prebiotic cola sells at $0.87, about half of Poppi and Olipop.", { "text-anchor": "end", "font-size": 14, fill: C.ink, "font-style": "italic", style: "font-family:Newsreader,Georgia,serif" });
})();

/* ------------------------------------------------ Q2 options */
(function options() {
  const crit = [["FY29 growth and better-for-you share", 30], ["Capability gain", 20], ["Value for the price", 20], ["Fits the 2.5x limit", 15], ["Ease of execution", 15]];
  const opts = [
    ["The Graft Plan", "60% now at $370M; the last 40% earned", [5, 5, 4, 5, 3], "Recommended"],
    ["Brightwater, 100% now", "All cash at the $450M asking price", [5, 5, 2, 1, 3], "Right target, wrong structure"],
    ["Partner-to-own", "25-30% stake, DSD rights and an option", [2, 3, 4, 5, 3], "Our fallback"],
    ["Distribution partnership", "Carry Brightwater, no equity", [2, 1, 3, 5, 2], "Builds a brand we could lose"],
    ["Acquire Marrow Lane", "$170M for the cold-brew producer", [2, 1, 2, 4, 2], "Revisit after FY28"],
    ["Relaunch Vital alone", "$50M over three years", [1, 2, 2, 5, 2], "Too slow alone"],
    ["Sell most of juice", "A joint venture like PepsiCo and PAI (2021)", [1, 1, 3, 5, 3], "Shrinks the base"],
  ];
  const w = crit.map((c) => c[1]);
  const wrap = $("#weights"), rank = $("#rank"), RH = 62;
  rank.style.height = opts.length * RH + "px";
  crit.forEach(([n, v], i) => {
    const d = document.createElement("div");
    d.innerHTML = `<label for="w${i}">${n} <output id="w${i}o">${v}</output></label><input type="range" id="w${i}" min="0" max="50" step="5" value="${v}">`;
    wrap.appendChild(d);
    d.querySelector("input").addEventListener("input", (e) => { w[i] = +e.target.value; d.querySelector("output").textContent = w[i]; update(); });
  });
  const rows = opts.map(([n, d, s, v]) => {
    const r = document.createElement("div"); r.className = "opt";
    r.innerHTML = `<span class="r"></span><div class="n"><b>${n}</b><span>${d}</span></div><div class="bar"><i></i></div><div class="sc num"></div><span class="vd">${v}</span>`;
    rank.appendChild(r); return r;
  });
  function update() {
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    const sc = opts.map((o) => o[2].reduce((a, s, i) => a + s * w[i], 0) / tot);
    const order = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    order.forEach(([s, i], r) => {
      const row = rows[i]; row.style.top = r * RH + "px"; row.classList.toggle("first", r === 0);
      row.querySelector(".r").textContent = r + 1; row.querySelector(".sc").textContent = s.toFixed(1);
      row.querySelector(".bar i").style.width = (s / 5 * 100) + "%";
    });
  }
  update();
})();

/* ------------------------------------------------ Q3 bridge + football field */
(function bridge() {
  const svg = $("#bridge");
  const steps = [["Alderbrook|core FY29", 0, 296.8, "t"], ["Brightwater|on its own", 296.8, 311.5, "p"], ["Canning|in-house", 311.5, 321.6, "p"], ["DSD margin|captured", 321.6, 334.3, "p"], ["Data and AI|net of cost", 334.3, 338.8, "p"], ["Vital|value tier", 338.8, 341.8, "p"], ["FY29 with|the plan", 0, 341.8, "tg"]];
  const L = 20, R = 650, T = 30, B = 246, lo = 270, hi = 350, y = (v) => B - (v - lo) / (hi - lo) * (B - T);
  [280, 300, 320, 340].forEach((v) => { el("line", { x1: L, x2: R, y1: y(v), y2: y(v), stroke: C.line }, svg); });
  const slot = (R - L) / steps.length, bw = 52; let prev = null;
  steps.forEach(([n, a, b, k], i) => {
    const x = L + i * slot + (slot - bw) / 2, top = y(b), bot = k[0] === "t" ? y(lo) : y(a);
    el("rect", { x, y: top, width: bw, height: Math.max(bot - top, 2), fill: k === "t" ? "#D9E2DB" : k === "tg" ? C.neon : C.green }, svg);
    txt(svg, x + bw / 2, top - 7, k[0] === "t" ? b.toFixed(0) : "+" + (b - a).toFixed(1), { "text-anchor": "middle", fill: C.ink, "font-weight": 600 });
    n.split("|").forEach((ln, j) => txt(svg, x + bw / 2, B + 16 + j * 13, ln, { "text-anchor": "middle", "font-size": 10 }));
    if (prev) el("line", { x1: prev.x, x2: x, y1: prev.y, y2: prev.y, stroke: C.faint, "stroke-dasharray": "2 3" }, svg);
    prev = { x: x + bw, y: y(b) };
  });
  txt(svg, L, 14, "Axis starts at $270M", { "font-size": 10, fill: C.faint });
})();
(function field() {
  const svg = $("#field");
  const X0 = 400, X1 = 1070, lo = 150, hi = 550, x = (v) => X0 + (v - lo) / (hi - lo) * (X1 - X0);
  [200, 300, 400, 500].forEach((v) => { el("line", { x1: x(v), x2: x(v), y1: 20, y2: 196, stroke: C.line }, svg); txt(svg, x(v), 14, "$" + v + "M", { "text-anchor": "middle", "font-size": 10, fill: C.faint }); });
  const rows = [["Recent deals, 2.8-4.6x trailing revenue", 266, 437, "#5B675F"], ["Recent deals, 2.8-4.0x FY26 revenue", 359, 513, "#5B675F"], ["Cash flow value, Brightwater on its own", 183, 251, "#D9E2DB"], ["Cash flow value with our synergies (70-100%)", 384, 455, C.green]];
  rows.forEach(([n, a, b, c], i) => {
    const yy = 40 + i * 40;
    txt(svg, X0 - 40, yy + 13, n, { "text-anchor": "end", "font-size": 12, fill: C.ink });
    el("rect", { x: x(a), y: yy, width: x(b) - x(a), height: 18, fill: c }, svg);
    const halo = { stroke: "#07100B", "stroke-width": 4, "paint-order": "stroke" };
    txt(svg, x(a) - 6, yy + 13, a, { "text-anchor": "end", "font-size": 10.5, ...halo }); txt(svg, x(b) + 6, yy + 13, b, { "font-size": 10.5, ...halo });
  });
  [[370, "Our Day-1 valuation $370M", C.neon, 216, "end"], [400, "Walk away above $400M", C.bad, 238, "middle"], [450, "Seller's mark $450M", C.ink, 216, "start"]].forEach(([v, t, c, ly, an]) => {
    el("line", { x1: x(v), x2: x(v), y1: 26, y2: ly - 12, stroke: c, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svg);
    txt(svg, x(v) + (an === "end" ? 6 : an === "start" ? -6 : 0), ly, t, { "text-anchor": an, fill: c, "font-size": 11, "font-weight": 600 });
  });
})();

/* ------------------------------------------------ Q3 simulator */
(function sim() {
  const st = { staged: true, v1: 370, scen: "base", real: 1 };
  const all = M.run({ staged: false });
  $$("#simulator .seg button").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.k; st[k] = k === "staged" ? b.dataset.v === "1" : b.dataset.v;
    $$(`#simulator .seg button[data-k="${k}"]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render();
  }));
  $("#v1").addEventListener("input", (e) => { st.v1 = +e.target.value; render(); });
  $("#real").addEventListener("input", (e) => { st.real = +e.target.value / 100; render(); });
  function chart(r) {
    const svg = $("#lev"); svg.innerHTML = "";
    const L = 44, R = 548, T = 14, B = 186, lo = 0.8, hi = 3.2, y = (v) => B - (v - lo) / (hi - lo) * (B - T), x = (i) => L + 14 + i * (R - L - 28) / 4;
    [1, 1.5, 2, 2.5, 3].forEach((v) => { el("line", { x1: L, x2: R, y1: y(v), y2: y(v), stroke: v === 2.5 ? C.bad : C.line, "stroke-dasharray": v === 2.5 ? "5 4" : "", "stroke-width": v === 2.5 ? 1.4 : 1 }, svg); txt(svg, L - 8, y(v) + 4, v.toFixed(1) + "x", { "text-anchor": "end", "font-size": 10, fill: v === 2.5 ? C.bad : C.faint }); });
    txt(svg, R, y(2.5) - 6, "board limit", { "text-anchor": "end", "font-size": 10, fill: C.bad });
    const line = (pts, col, w, dash) => { el("polyline", { points: pts.map((v, i) => `${x(i)},${y(Math.min(v, 3.2))}`).join(" "), fill: "none", stroke: col, "stroke-width": w, "stroke-dasharray": dash || "", "stroke-linejoin": "round" }, svg); pts.forEach((v, i) => el("circle", { cx: x(i), cy: y(Math.min(v, 3.2)), r: 3.5, fill: "#0A0F0C", stroke: col, "stroke-width": 2 }, svg)); };
    if (st.staged) line(all.path.map((p) => p.cov), "#5B675F", 1.5);
    if (st.staged) line(r.path.map((p) => p.adj), C.green, 1.8, "5 4");
    const over = r.peakCov > 2.5;
    line(r.path.map((p) => p.cov), over ? C.bad : C.neon, 3);
    ["Close", "FY27", "FY28", "FY29", "FY30"].forEach((t, i) => txt(svg, x(i), B + 22, t, { "text-anchor": "middle", "font-size": 10 }));
    const lg = [[over ? C.bad : C.neon, "Net debt / EBITDA", ""], ...(st.staged ? [[C.green, "If the founder's put is debt", "5 4"], ["#5B675F", "All cash at $450M", ""]] : [])];
    lg.forEach(([c, t, d], i) => { const lx = L + [0, 150, 350][i]; el("line", { x1: lx, x2: lx + 18, y1: 236, y2: 236, stroke: c, "stroke-width": 2.5, "stroke-dasharray": d }, svg); txt(svg, lx + 24, 240, t, { "font-size": 10, fill: C.ink }); });
  }
  function render() {
    $("#v1wrap").style.opacity = st.staged ? 1 : 0.35; $("#v1").disabled = !st.staged;
    $("#v1o").textContent = "$" + st.v1 + "M"; $("#realo").textContent = Math.round(st.real * 100) + "%";
    const r = M.run({ scen: st.scen, real: st.real, staged: st.staged, v1: st.v1 });
    const n = $("#oNpv"); n.textContent = fmtS(r.npv); n.style.color = r.npv >= 0 ? C.neon : C.bad;
    $("#oDay1").textContent = fmtM(r.day1); $("#oTotal").textContent = fmtM(r.total);
    chart(r);
    const ck = [["Growth a year", pct(r.cagr), r.cagr >= 0.05, "target 5-6%"], ["Better-for-you share", pct(r.func), r.func >= 0.12, "target 12%+"], ["Operating margin", pct(r.opm), r.opm >= 0.11, "target 11%+"], ["Peak leverage", r.peakCov.toFixed(2) + "x", r.peakCov <= 2.5, "limit 2.5x"]];
    $("#checks").innerHTML = ck.map(([l, v, ok, t]) => `<div class="ck ${ok ? "pass" : "fail"}"><b class="num">${v}</b>${l}<br><span style="color:var(--faint)">${t}</span></div>`).join("");
  }
  render();
})();

/* ------------------------------------------------ Q4 waves */
(function waves() {
  const svg = $("#wavemap"), cols = 11, rowsN = 10, gx = 44, gy = 31;
  const idx = []; for (let k = 0; k < cols * rowsN; k++) idx.push(k);
  idx.sort((a, b) => (((a % cols) - 5) ** 2 + ((Math.floor(a / cols) - 4.5) ** 2) * 1.5) - (((b % cols) - 5) ** 2 + ((Math.floor(b / cols) - 4.5) ** 2) * 1.5));
  const wave = {}; idx.forEach((k, i) => (wave[k] = i < 1 ? 0.5 : i < 15 ? 1 : i < 45 ? 2 : i < 60 ? 3 : 0));
  const dots = [];
  for (let k = 0; k < cols * rowsN; k++) {
    const c = k % cols, r = Math.floor(k / cols), cx = 30 + c * gx + (r % 2 ? gx / 2 : 0), cy = 24 + r * gy;
    dots.push([el("circle", { cx, cy, r: 8.5, fill: "#1A231D" }, svg), wave[k]]);
  }
  const steps = [
    ["Pilot", "Q3 FY27 · 500 outlets", "#F2F7F3"],
    ["Wave 1", "Q4 FY27 · 15,000 look-alike outlets", C.neon],
    ["Wave 2", "FY28 · +30,000 outlets", C.green],
    ["Wave 3", "FY29 · +15,000 outlets, 60,000 in all", "#4E8A16"],
  ];
  const box = $("#waveSteps"), miss = $("#miss"), msg = $("#gateMsg"); let cur = 1;
  steps.forEach(([t, s, c], i) => {
    const b = document.createElement("button"); b.innerHTML = `<i style="background:${c}"></i><div><b>${t}</b><span>${s}</span></div>`;
    b.addEventListener("click", () => { cur = i; draw(); }); box.appendChild(b);
  });
  miss.addEventListener("change", draw);
  function draw() {
    $$("button", box).forEach((b, i) => b.setAttribute("aria-pressed", String(i === cur)));
    const failed = miss.checked && cur < 3;
    dots.forEach(([d, w]) => {
      const lit = w > 0 && w <= cur + (cur === 0 ? 0.5 : 0) && (w <= cur || w === 0.5);
      const hold = failed && w === cur + 1;
      let fill = "#1A231D", stroke = "none";
      if (w === 0.5) fill = "#F2F7F3";
      else if (w && w <= cur) fill = steps[w][2];
      if (hold) { fill = "transparent"; stroke = C.warn; }
      d.setAttribute("fill", fill); d.setAttribute("stroke", stroke); d.setAttribute("stroke-width", hold ? 1.6 : 0);
      d.style.filter = (w && w <= cur) || w === 0.5 ? "drop-shadow(0 0 4px rgba(134,188,37,.6))" : "none";
    });
    const nextName = cur < 3 ? steps[cur + 1][0] : null;
    if (cur === 3) { msg.className = "gate"; msg.innerHTML = "<b>All three waves done.</b> 60,000 outlets on Alderbrook trucks by FY29. The other 50,000 are a weak fit and stay unplanned."; }
    else if (failed) { msg.className = "gate miss"; msg.innerHTML = `<b>${steps[cur][0]} misses its gate:</b> velocity 0.9x category, out-of-stocks at 7%. ${nextName} waits. We fix shelf placement, pack size and price, then retest next quarter. The cost is one quarter, not the brand.`; }
    else { msg.className = "gate"; msg.innerHTML = `<b>Gate to ${nextName}:</b> velocity at or above 1.0x category and out-of-stocks under 5% for a full quarter. Old distributors are bought out with an inventory buyback, 30 days of stock at our DCs and a two-week cutover in Q4 or Q1.`; }
  }
  draw();
})();

/* ------------------------------------------------ Q4 price ladder */
(function ladder() {
  const svg = $("#ladder"), x = (v) => 20 + (v - 0.4) / 1.7 * 360, Y = 64;
  el("line", { x1: x(0.42), x2: x(2.08), y1: Y, y2: Y, stroke: C.line2 }, svg);
  el("rect", { x: x(0.87) + 8, y: Y - 9, width: x(1.58) - x(0.87) - 16, height: 18, fill: "rgba(183,240,94,.06)", stroke: "rgba(183,240,94,.25)", "stroke-dasharray": "3 3" }, svg);
  [[0.5, 0.59], [1.58, 2.0]].forEach(([a, b]) => el("rect", { x: x(a), y: Y - 5, width: x(b) - x(a), height: 10, fill: "#3A463E" }, svg));
  el("circle", { cx: x(0.87), cy: Y, r: 5, fill: "#6E7B72" }, svg);
  const lab = (v, y, t, s, c, w) => { txt(svg, x(v), y, t, { "text-anchor": "middle", "font-size": 12, fill: c, "font-weight": w || 400, style: "font-family:Archivo,sans-serif" }); txt(svg, x(v), y + 14, s, { "text-anchor": "middle", "font-size": 10.5, fill: C.faint }); };
  lab(0.545, Y + 28, "Soda, seltzer", "$0.50-0.59", C.mute);
  lab(1.79, Y + 28, "Poppi, Olipop, Bloom", "$1.58-2.00", C.mute);
  lab(0.87, Y - 36, "Pepsi Prebiotic", "$0.87", C.mute);
  [[1.25, "Vital", C.neon], [1.95, "Brightwater", C.fruit]].forEach(([v, n, c]) => {
    el("line", { x1: x(v), x2: x(v), y1: Y - 16, y2: Y, stroke: c, "stroke-width": 1.5 }, svg);
    el("circle", { cx: x(v), cy: Y, r: 6.5, fill: "#0A0F0C", stroke: c, "stroke-width": 2.5 }, svg);
    lab(v, Y - 36, n, "$" + v.toFixed(2), c, 600);
  });
})();

/* ------------------------------------------------ Q5 engine */
(function engine() {
  const uc = [
    { id: "promo", n: "Cleaner promotions", w: "Months 0-6", ins: ["dsd", "pos", "syn"], d: "Rank every promotion by the extra profit it earns before it runs. Start with Vital, where 60% of volume sells on deal.", t: "Vital's promoted volume from 60% to under 35%", e: "Nielsen: 59% of promotions worldwide and 71-72% in the US do not break even." },
    { id: "where", n: "Where to sell", w: "Months 0-6", ins: ["dsd", "pos", "syn"], d: "Score all 110,000 outlets against Brightwater's best natural-channel stores, joining our deliveries with retailer sales. This picks each DSD wave.", t: "Conventional velocity from 0.8x to 1.0x or better in wave 1", e: "Today the outlet data is used only to plan routes (case)." },
    { id: "make", n: "What to make", w: "Months 3-12", ins: ["soc", "syn", "pos"], d: "Run Brightwater's 90-day method for every Alderbrook brand: trend signals, digital concept tests, then short runs on our own lines.", t: "Idea to shelf from 14 months to under 6", e: "Brightwater already ships new flavours in 90 days (case)." },
    { id: "agent", n: "Agent-ready product data", w: "Months 6-18", ins: ["dsd", "pos"], d: "Publish clean product data, such as claims, fibre, price and stock, so AI shopping assistants can find and recommend our brands.", t: "Brightwater listed correctly on three major retail sites", e: "Deloitte, 2026 Retail Industry Global Outlook: 9 in 10 retail executives expect AI to be used more than search engines." },
  ];
  const outs = $("#outputs"), ucd = $("#ucd"), wires = $("#wires"), eng = $("#engine"); let sel = 0;
  uc.forEach((u, i) => {
    const b = document.createElement("button"); b.innerHTML = `<i>${i + 1}</i><div><b>${u.n}</b><span>${u.w}</span></div>`;
    b.addEventListener("click", () => { sel = i; draw(); }); outs.appendChild(b);
  });
  function wiresDraw() {
    wires.innerHTML = "";
    if (getComputedStyle(wires).display === "none") return;
    const base = eng.getBoundingClientRect(), core = $(".core", eng).getBoundingClientRect();
    const cx = (core.left + core.right) / 2 - base.left, cy = (core.top + core.bottom) / 2 - base.top, cr = core.width / 2;
    $$(".inp", eng).forEach((inp) => {
      const r = inp.getBoundingClientRect(), x1 = r.right - base.left, y1 = (r.top + r.bottom) / 2 - base.top, on = uc[sel].ins.includes(inp.dataset.i);
      const x2 = cx - cr * 0.92, y2 = cy + (y1 - cy) * 0.35;
      el("path", { d: `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`, fill: "none", stroke: on ? C.neon : C.line2, "stroke-width": on ? 2 : 1, opacity: on ? 1 : 0.6 }, wires);
    });
    $$("button", outs).forEach((o, i) => {
      const r = o.getBoundingClientRect(), x2 = r.left - base.left, y2 = (r.top + r.bottom) / 2 - base.top, on = i === sel;
      const x1 = cx + cr * 0.92, y1 = cy + (y2 - cy) * 0.35;
      el("path", { d: `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`, fill: "none", stroke: on ? C.neon : C.line2, "stroke-width": on ? 2 : 1, opacity: on ? 1 : 0.6 }, wires);
    });
  }
  function draw() {
    const u = uc[sel];
    $$("button", outs).forEach((b, i) => b.setAttribute("aria-pressed", String(i === sel)));
    $$(".inp", eng).forEach((x) => x.classList.toggle("lit", u.ins.includes(x.dataset.i)));
    ucd.innerHTML = `<div><p class="kicker">Use case ${sel + 1} · ${u.w}</p><p class="t" style="margin-top:6px">${u.n}</p><p class="small" style="margin-top:8px">${u.d}</p></div>
      <div><p class="kicker">Target</p><p style="margin-top:6px;font-size:16px">${u.t}</p></div>
      <div><p class="kicker">Evidence</p><p class="small" style="margin-top:6px">${u.e}</p></div>`;
    wiresDraw();
  }
  draw(); addEventListener("resize", wiresDraw); if (document.fonts) document.fonts.ready.then(wiresDraw);
})();

/* ------------------------------------------------ Roadmap */
(function roadmap() {
  const lockSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="${C.neon}" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.2" r="1.3" fill="${C.neon}" stroke="none"/></svg>`;
  const L = [["Distributor contracts", "What does it cost to exit them? BodyArmor paid $350M; Celsius $194M."], ["Co-packer contracts", "Minimum volumes, notice periods and change-of-control terms?"], ["Conventional velocity", "Is 0.8x a stock and shelf problem we can fix? Test it in 500 outlets."], ["Quality of growth", "How much of the 55% comes from promotions or one-off flavours?"],
    ["Health claims", "Does the fibre in each can support gut-health wording?"], ["People", "Will the founder and the five AI specialists sign for three years?"], ["Cap table and tax", "What are the PE investor's preferences, drag and tag rights? Is Brightwater an LLC?"], ["Our own record", "Why did the 2016 and 2019 deals fade, and could that happen here?"]];
  $("#locks").innerHTML = L.map(([t, q], i) => `<div class="lock"><span class="n">${i + 1}</span>${lockSvg}<b>${t}</b><p>${q}</p></div>`).join("");
  const cols = ["Dec 26", "Q1 27", "Q2 27", "Q3 27", "Q4 27", "H1 28", "H2 28", "FY29"];
  const rows = [
    ["Deal", [["ms", 0.5, "Board"], ["m", 0.8, 1.62, "Diligence"], ["r", 1.66, 2.12, "HSR"], ["ms", 2.25, "Close"], ["ms", 6.6, "FY28 audit"], ["d", 7.1, 8, "Buy last 40%"]]],
    ["People", [["m", 1, 2, "Retention"], ["l", 2, 7, "Integration office · monthly scorecard"]]],
    ["Plants", [["m", 2, 4, "Qualify core flavours"], ["d", 4, 5.6, "Move core in-house"], ["l", 6, 7.2, "Exit 2 co-packers"]]],
    ["Distribution", [["l", 3, 4, "500 pilot"], ["m", 4, 5.6, "Wave 1 · 15k"], ["d", 5.6, 7, "Wave 2 · +30k"], ["l", 7, 8, "Wave 3"]]],
    ["Data and AI", [["l", 2, 3, "Hire"], ["m", 3, 5, "Promotions, outlet model"], ["d", 5, 7, "What to make"], ["l", 7, 8, "Agent data"]]],
    ["Brands", [["d", 3.5, 5, "Vital value tier"], ["l", 5, 6.6, "Grocery multipacks"]]],
  ];
  let h = `<div></div>` + cols.map((c) => `<div class="hd">${c}</div>`).join("");
  rows.forEach(([n, items]) => {
    h += `<div class="rl">${n}</div><div class="row">`;
    items.forEach((it) => {
      if (it[0] === "ms") h += `<span class="ms" style="left:${it[1] / 8 * 100}%"></span><span class="msl" style="left:${it[1] / 8 * 100}%">${it[2]}</span>`;
      else h += `<span class="bx ${it[0]}" style="left:calc(${it[1] / 8 * 100}% + 2px);width:calc(${(it[2] - it[1]) / 8 * 100}% - 4px)" title="${it[3]}">${it[3]}</span>`;
    });
    h += `</div>`;
  });
  $("#gantt").innerHTML = h;
  const R = [["A sales dip during the DSD switch", "Waves with gates, buybacks and safety stock", "H", "H"], ["Overpaying as the category cools", "Staged price, a cap and a walk-away", "M", "H"], ["The founder or AI talent leaves", "Three-year retention; the founder keeps 40%", "M", "H"],
    ["Seasonal runs hurt plant efficiency", "Seasonal flavours stay at a co-packer", "M", "M"], ["Health-claim lawsuits", "Claims audit before signing", "M", "M"], ["Aluminium cost (50% tariff)", "12-month hedge and pack mix", "H", "M"], ["Big brands and store brands crowd shelves", "Two price lanes and DSD execution", "H", "M"]];
  $("#risks").innerHTML = R.map(([a, b, l, i]) => `<tr><td><b style="font-weight:600;color:var(--ink)">${a}</b></td><td style="color:var(--mute)">${b}</td><td><span class="chip ${l}">${l}</span></td><td><span class="chip ${i}">${i}</span></td></tr>`).join("");
})();

/* ------------------------------------------------ Archive tables */
(function archive() {
  const A = [["Timeline", "Board Dec 2026; sign Mar 2027; HSR 30 days; close Apr 2027. Fiscal year = calendar year."], ["Core business", "FY25 segment growth held: juice −3%, iced tea 0%, sparkling +7%, hydration +11%. EBITDA 15%, operating margin 11%."],
    ["Brightwater revenue", "$165M, $205M, $245M, $280M for FY27-30. Management says $260-300M by FY29."], ["Brightwater margin", "EBITDA 0% in FY27 rising to 9% by FY30, after extra brand and pack spend."],
    ["Canning", "COGS 56% of revenue; saving 15.3% of co-packed cost less 3 points for changeovers and freight; 65% of volume in-house by FY30."], ["DSD", "Distributors keep 27.5% of shelf price; our DSD costs 12%; 38% of Brightwater revenue on our trucks by FY30; only 40% of the gain counted."],
    ["Data and AI", "Gross benefit $9M in FY29 and $11M in FY30; run cost $4.5M a year; build $3M."], ["Finance", "Synergies at 9%, Brightwater on its own at 11%; 12x FY30 EBITDA exit; 6.25% interest; 25% tax."],
    ["One-off costs", "$12M fees; $30M integration (case); $30M distributor and co-packer exits; $5M can-line checks; $10M Vital reset."]];
  $("#assump").innerHTML = A.map(([a, b]) => `<tr><td><b style="color:var(--ink)">${a}</b></td><td style="text-align:left">${b}</td></tr>`).join("");
  const r = M.run(), p = r.path;
  const fin = [["", "FY25", "FY27", "FY28", "FY29", "FY30"], ["Brightwater revenue", "95", "165", "205", "245", "280"],
    ["Brightwater EBITDA", "−1.9", ...r.b.map((b, i) => (b.ebitda * [0.75, 1, 1, 1][i]).toFixed(1))],
    ["Group EBITDA", "270", ...p.slice(1).map((x) => x.e.toFixed(0))], ["Net debt", "324", ...p.slice(1).map((x) => x.nd.toFixed(0))],
    ["Net debt / EBITDA", "1.20x", ...p.slice(1).map((x) => x.cov.toFixed(2) + "x")]];
  $("#fin").innerHTML = fin.map((row, i) => `<tr>${row.map((c) => i ? `<td>${c}</td>` : `<th>${c}</th>`).join("")}</tr>`).join("");
  const sc = [["down", "Downside, $200M in FY29"], ["base", "Base, $245M"], ["up", "Upside, $280M"]];
  let h = `<tr><th>Brightwater FY29</th><th>70% synergies</th><th>85%</th><th>100%</th><th>All cash, 100%</th></tr>`;
  sc.forEach(([k, n]) => {
    const v = [0.7, 0.85, 1].map((re) => M.run({ scen: k, real: re }).npv).concat(M.run({ scen: k, staged: false }).npv);
    h += `<tr><td>${n}</td>${v.map((x) => `<td class="${x >= 0 ? "pos" : "neg"}">${fmtS(x)}</td>`).join("")}</tr>`;
  });
  $("#sens").innerHTML = h;
})();

/* ------------------------------------------------ the vault (WebGL) */
const V = (function vault() {
  const canvas = $("#vault");
  if (!window.THREE) { document.documentElement.classList.add("nogl"); return null; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch (e) { document.documentElement.classList.add("nogl"); return null; }
  if (!renderer.getContext()) { document.documentElement.classList.add("nogl"); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x030504, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x030504, 0.034);
  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
  const W = 11, HH = 9, BAY = 3.4, NB = 90, Z0 = 24, Z1 = Z0 - NB * BAY, LEN = Z0 - Z1, RING_R = 3.2, RING_Y = 4.4;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function tex(w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = maxAniso; return t;
  }
  function noise(g, w, h, n, a) { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5); } }
  // wall bay
  const wallT = tex(256, 512, (g, w, h) => {
    g.fillStyle = "#0A0E0B"; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.07);
    g.fillStyle = "#030504"; g.fillRect(0, 0, 3, h); g.fillRect(0, h * 0.34, w, 2); g.fillRect(0, h * 0.67, w, 2);
    g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(3, 0, 1, h);
    const tipY = h * (1 - 1.15 / HH), topY = h * (1 - 6.6 / HH);
    g.save(); g.translate(w / 2, tipY - h * 0.16); g.scale(0.2, 1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.42); rg.addColorStop(0, "rgba(140,210,60,.42)"); rg.addColorStop(0.4, "rgba(110,180,40,.14)"); rg.addColorStop(1, "rgba(80,140,30,0)");
    g.fillStyle = rg; g.fillRect(-w * 4, -h, w * 8, h * 2); g.restore();
    const lg = g.createLinearGradient(0, tipY, 0, topY); lg.addColorStop(0, "rgba(225,255,170,1)"); lg.addColorStop(0.18, "rgba(165,235,80,.75)"); lg.addColorStop(1, "rgba(120,200,50,0)");
    g.fillStyle = lg; g.fillRect(w / 2 - 2.5, topY, 5, tipY - topY);
    const tg = g.createRadialGradient(w / 2, tipY, 0, w / 2, tipY, 16); tg.addColorStop(0, "rgba(240,255,210,1)"); tg.addColorStop(1, "rgba(150,230,60,0)");
    g.fillStyle = tg; g.fillRect(w / 2 - 16, tipY - 16, 32, 32);
    const fg = g.createLinearGradient(0, h, 0, h * 0.9); fg.addColorStop(0, "rgba(120,190,50,.18)"); fg.addColorStop(1, "rgba(120,190,50,0)"); g.fillStyle = fg; g.fillRect(0, h * 0.9, w, h * 0.1);
  }, NB, 1);
  const floorT = tex(512, 256, (g, w, h) => {
    g.fillStyle = "#060907"; g.fillRect(0, 0, w, h); noise(g, w, h, 4000, 0.05);
    g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(0, 0, w, 2); [128, 256, 384].forEach((x) => g.fillRect(x, 0, 2, h));
    g.fillStyle = "rgba(255,255,255,.03)"; g.fillRect(0, 2, w, 1);
    [[14, 1], [w - 14, -1]].forEach(([x]) => {
      const lg = g.createLinearGradient(0, h / 2, 0, h); lg.addColorStop(0, "rgba(190,250,110,.75)"); lg.addColorStop(0.5, "rgba(140,215,60,.22)"); lg.addColorStop(1, "rgba(120,200,50,0)");
      g.fillStyle = lg; g.fillRect(x - 3, h / 2, 6, h / 2);
      const rg = g.createRadialGradient(x, h * 0.62, 0, x, h * 0.62, 60); rg.addColorStop(0, "rgba(130,200,50,.22)"); rg.addColorStop(1, "rgba(130,200,50,0)");
      g.fillStyle = rg; g.fillRect(x - 60, h * 0.62 - 60, 120, 120);
    });
  }, 1, NB);
  const ceilT = tex(512, 256, (g, w, h) => { g.fillStyle = "#050706"; g.fillRect(0, 0, w, h); noise(g, w, h, 1500, 0.05); g.fillStyle = "#020302"; g.fillRect(0, 0, w, 3); }, 1, NB);
  const mk = (geo, map, pos, rot) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map })); m.position.set(...pos); m.rotation.set(...rot); scene.add(m); return m; };
  const zc = (Z0 + Z1) / 2;
  mk(new THREE.PlaneGeometry(LEN, HH), wallT, [-W / 2, HH / 2, zc], [0, Math.PI / 2, 0]);
  const wr = wallT.clone(); wr.needsUpdate = true; mk(new THREE.PlaneGeometry(LEN, HH), wr, [W / 2, HH / 2, zc], [0, -Math.PI / 2, 0]);
  mk(new THREE.PlaneGeometry(W, LEN), floorT, [0, 0, zc], [-Math.PI / 2, 0, 0]);
  mk(new THREE.PlaneGeometry(W, LEN), ceilT, [0, HH, zc], [Math.PI / 2, 0, 0]);
  // emitter sprites
  const spT = tex(64, 64, (g) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, "rgba(230,255,190,1)"); rg.addColorStop(0.25, "rgba(150,230,60,.55)"); rg.addColorStop(1, "rgba(120,200,40,0)"); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); });
  const spM = new THREE.SpriteMaterial({ map: spT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  for (let k = 0; k < NB; k++) { const z = Z0 - (k + 0.5) * BAY; [-1, 1].forEach((s) => { const sp = new THREE.Sprite(spM); sp.position.set(s * (W / 2 - 0.06), 1.15, z); sp.scale.set(0.9, 0.9, 1); scene.add(sp); }); }
  // ring
  const ringG = new THREE.Group(); scene.add(ringG);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xD2FF8A, fog: false });
  ringG.add(new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.05, 16, 240), ringMat));
  const glowT = tex(512, 512, (g, w) => {
    const r = w * 0.36;
    const hz = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, r); hz.addColorStop(0, "rgba(120,190,40,.035)"); hz.addColorStop(1, "rgba(120,190,40,.09)");
    g.fillStyle = hz; g.beginPath(); g.arc(w / 2, w / 2, r, 0, 7); g.fill();
    g.strokeStyle = "rgba(160,240,70,1)"; g.shadowColor = "rgba(134,220,40,1)";
    [[70, 10, 0.5], [36, 7, 0.7], [16, 4, 1]].forEach(([b, lw, a]) => { g.globalAlpha = a; g.shadowBlur = b; g.lineWidth = lw; g.beginPath(); g.arc(w / 2, w / 2, r, 0, 7); g.stroke(); });
  });
  const glowMat = new THREE.MeshBasicMaterial({ map: glowT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(RING_R / 0.36, RING_R / 0.36), glowMat); glow.position.z = -0.05; ringG.add(glow);
  const haloT = tex(256, 256, (g, w) => { const rg = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); rg.addColorStop(0, "rgba(110,180,40,.16)"); rg.addColorStop(0.5, "rgba(90,160,30,.06)"); rg.addColorStop(1, "rgba(90,160,30,0)"); g.fillStyle = rg; g.fillRect(0, 0, w, w); });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: haloT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.z = -0.3; ringG.add(halo);
  const reflT = tex(256, 512, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, "rgba(170,240,80,.0)"); lg.addColorStop(0.05, "rgba(170,240,80,.5)"); lg.addColorStop(0.35, "rgba(140,220,60,.16)"); lg.addColorStop(1, "rgba(120,200,50,0)");
    g.fillStyle = lg; g.save(); g.translate(w / 2, 0); g.scale(1, 1); g.fillRect(-w * 0.28, 0, w * 0.56, h); g.restore();
    const cut = g.createLinearGradient(0, 0, w, 0); cut.addColorStop(0, "rgba(0,0,0,1)"); cut.addColorStop(0.3, "rgba(0,0,0,0)"); cut.addColorStop(0.7, "rgba(0,0,0,0)"); cut.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = cut; g.fillRect(0, 0, w, h);
  });
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(7, 22), new THREE.MeshBasicMaterial({ map: reflT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 }));
  refl.rotation.x = -Math.PI / 2; scene.add(refl);
  // dust
  const DN = reduce ? 0 : 420, dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = (rnd() - 0.5) * (W - 1); dpos[i * 3 + 1] = rnd() * (HH - 1); dpos[i * 3 + 2] = 6 - rnd() * 40; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xB7F05E, size: 0.035, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);
  // room placards on the left wall
  const anchorsZ = [];
  function placards() {
    rooms.forEach((r, i) => {
      if (i === 0 || i > 8) return;
      const t = tex(1024, 300, (g, w, h) => {
        g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, w, h);
        g.strokeStyle = "rgba(160,220,90,.45)"; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
        g.fillStyle = "rgba(183,240,94,.95)"; g.font = "600 46px 'IBM Plex Mono', monospace"; g.fillText("ROOM " + String(i).padStart(2, "0"), 48, 92);
        g.fillStyle = "rgba(225,235,228,.92)"; g.font = "400 112px Newsreader, Georgia, serif"; g.fillText(r.dataset.short, 44, 228);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      m.rotation.y = Math.PI / 2; m.position.set(-W / 2 + 0.03, 5.6, (anchorsZ[i] ?? 0) - 9); scene.add(m);
    });
  }
  const state = { cz: 6, cy: 2.2, D: 19, tz: 6, ty: 2.2, tD: 19, ro: 0, tro: 0, par: 1, tpar: 1, mx: 0, my: 0, sx: 0, sy: 0, dim: 1, tdim: 1 };
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  addEventListener("pointermove", (e) => { state.mx = e.clientX / innerWidth - 0.5; state.my = e.clientY / innerHeight - 0.5; });
  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000, k = reduce ? 1 : 0.07;
    state.cz += (state.tz - state.cz) * k; state.cy += (state.ty - state.cy) * k; state.D += (state.tD - state.D) * k; state.ro += (state.tro - state.ro) * k; state.par += (state.tpar - state.par) * k; state.dim += (state.tdim - state.dim) * 0.05;
    state.sx += (state.mx * state.par - state.sx) * 0.04; state.sy += (state.my * state.par - state.sy) * 0.04;
    const bob = reduce ? 0 : Math.sin(t * 0.7) * 0.025;
    cam.position.set(state.sx * 0.7, state.cy + bob - state.sy * 0.3, state.cz);
    cam.lookAt(state.sx * 0.25, state.cy - state.sy * 0.15, state.cz - 30);
    ringG.position.set(0, RING_Y + state.ro, state.cz - state.D);
    refl.position.set(0, 0.02, state.cz - state.D + 11);
    const pulse = reduce ? 1 : 0.88 + 0.12 * Math.sin(t * 1.3);
    glowMat.opacity = pulse * state.dim; ringMat.color.setRGB(0.82 * state.dim + 0.1, 1 * state.dim, 0.54 * state.dim);
    if (DN) {
      const a = dgeo.attributes.position.array;
      for (let i = 0; i < DN; i++) { a[i * 3 + 1] += 0.0025; if (a[i * 3 + 1] > HH - 1) a[i * 3 + 1] = 0.2; if (a[i * 3 + 2] > state.cz + 3) a[i * 3 + 2] = state.cz - 38 + rnd() * 4; if (a[i * 3 + 2] < state.cz - 42) a[i * 3 + 2] = state.cz + 2; }
      dgeo.attributes.position.needsUpdate = true;
    }
    if (!document.hidden) renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { state, anchorsZ, placards, RING_Y, RING_R, FOV: 58 };
})();

/* ------------------------------------------------ scroll binding */
const ROOM_STEP = 14;
function anchors() {
  return rooms.map((r, i) => {
    if (r.id === "ask") return $(".ringed", r).getBoundingClientRect().top + scrollY - innerHeight * 0.08;
    if (r.id === "archive") return r.offsetTop;
    return i === 0 ? 0 : r.offsetTop + innerHeight * 0.1;
  });
}
let A = anchors();
if (V) { rooms.forEach((r, i) => (V.anchorsZ[i] = 6 - Math.min(i, 9) * ROOM_STEP)); (document.fonts ? document.fonts.ready : Promise.resolve()).then(V.placards); }
addEventListener("resize", () => (A = anchors()));
addEventListener("load", () => (A = anchors()));
const prog = $("#prog"), ringed = $(".finale .ringed");
function onScroll() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  prog.style.width = (max > 0 ? y / max * 100 : 0) + "%";
  let i = 0; while (i < A.length - 1 && y >= A[i + 1]) i++;
  const span = (A[i + 1] ?? A[i] + 1) - A[i], p = Math.min(Math.max((y - A[i]) / (span || 1), 0), 1);
  let act = 0; rooms.forEach((r, k) => { if (r.getBoundingClientRect().top < innerHeight * 0.5) act = k; });
  railLinks.forEach((a, k) => { if (!a) return; a.classList.toggle("on", k === act); a.classList.toggle("done", k < act); });
  where.innerHTML = act === 0 ? "Project Orchard" : `<b>${String(Math.min(act, 9)).padStart(2, "0")}</b> ${rooms[act].dataset.name.replace(/^Room \d+ · /, "")}`;
  if (!V) return;
  const s = V.state, z = (k) => 6 - Math.min(k, 9) * ROOM_STEP;
  // finale: size and place the ring so it frames the headline block, and let it ride with the page
  const fit = () => {
    const b = ringed.getBoundingClientRect(), H = innerHeight, span = 2 * Math.tan(V.FOV * Math.PI / 360);
    const D = 2 * V.RING_R * H / (span * b.width * 0.98), h = (H / 2 - (b.top + b.height / 2)) / H * span * D;
    return { D, h: Math.max(-9, Math.min(9, h)) };
  };
  if (i >= 9) { const f = fit(); s.tz = z(9); s.ty = V.RING_Y; s.tD = f.D; s.tro = f.h; s.tpar = 0.25; s.tdim = rooms[i] && rooms[i].id === "archive" ? 0.35 : 1; }
  else {
    s.tz = z(i) + (z(i + 1) - z(i)) * p; s.tdim = 1;
    if (i === 8) { const e = Math.pow(p, 2.2), f = fit(); s.tD = 19 - (19 - f.D) * e; s.ty = 2.2 + (V.RING_Y - 2.2) * e; s.tro = f.h * e; s.tpar = 1 - 0.75 * e; }
    else { s.tD = 19; s.ty = 2.2; s.tro = 0; s.tpar = 1; }
  }
}
addEventListener("scroll", onScroll, { passive: true }); onScroll();
})();
