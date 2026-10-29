// Port of graft_plan_model_v2.py (keep in sync). All $M.
const M = (() => {
  const STUB = [0.75, 1, 1, 1], T_MID = [0.375, 1.25, 2.25, 3.25], T_TERM = 3.75, T_TR2 = 2.0;
  const SEG = [[684, -0.03], [432, 0], [468, 0.07], [216, 0.11]];
  const coreRev = (fy) => SEG.reduce((a, [v, g]) => a + v * Math.pow(1 + g, fy), 0);
  const CORE = [2, 3, 4, 5].map(coreRev), CORE_FY26 = coreRev(1);
  const EBITDA_M = 0.15, OP_M = 0.11;
  const SCEN = { base: [165, 205, 245, 280], down: [150, 170, 200, 225], up: [172, 220, 280, 320] };
  const STD_M = [0, 0.03, 0.06, 0.09], INSOURCE = [0.05, 0.35, 0.6, 0.65], NET_COPACK = 0.18 / 1.18 - 0.03;
  const DSD = [0.04, 0.2, 0.32, 0.38], DSD_CAPTURE = (0.275 - 0.12 * 0.7) * (0.9 / 0.425) * 0.4, COGS = 0.56;
  const FEES = 12, T2_MULT = 2.5, T2_CAP = 190, PUT_MULT = 1.25;
  const INTEG = [15, 15, 0, 0], EXIT = [10, 12, 8, 0], REQUAL = [2, 3, 0, 0];
  const AI_GROSS = [1, 5, 9, 11], AI_RUN = [4.5 * 0.75, 4.5, 4.5, 4.5], AI_BUILD = [3, 0, 0, 0];
  const VITAL_SAVE = [0.5, 2, 3, 3], VITAL_SPEND = [5, 5, 0, 0];
  const TAX = 0.25, IR = 0.0625, CAPEX_CORE = 0.04, CAPEX_BW = 0.02, ND0 = 324, LTM = CORE_FY26 * EBITDA_M, DIV_FLAT = 37;
  const pv = (cf, t, r) => cf / Math.pow(1 + r, t);
  const bw = (rev, real) => rev.map((r, i) => {
    const std = r * STD_M[i], cop = r * COGS * INSOURCE[i] * NET_COPACK * real, dsd = r * DSD[i] * DSD_CAPTURE * real;
    return { rev: r, std, cop, dsd, syn: cop + dsd, ebitda: std + cop + dsd };
  });
  const adj28 = (rev) => rev[1] - 0.5 * rev[1] * 0.9 * DSD[1];
  function run({ scen = "base", real = 1, staged = true, v1 = 370, rSyn = 0.09, rStd = 0.11 } = {}) {
    const rev = SCEN[scen], b = bw(rev, real);
    const day1 = (staged ? 0.6 * v1 : 450) + FEES, t2 = staged ? Math.min(0.4 * T2_MULT * adj28(rev), T2_CAP) : 0;
    const put = staged ? 0.4 * PUT_MULT * adj28(rev) : 0;
    let nd = ND0 + day1;
    const path = [{ y: "Close", nd, e: LTM, cov: nd / LTM, adj: (nd + put) / LTM }];
    for (let i = 0; i < 4; i++) {
      const own = staged && i < 2 ? 0.6 : 1, C = CORE[i];
      const E = C * EBITDA_M + b[i].ebitda * STUB[i] + (AI_GROSS[i] - AI_RUN[i]) + VITAL_SAVE[i];
      const capex = CAPEX_CORE * C + CAPEX_BW * b[i].rev * STUB[i] + REQUAL[i];
      const interest = IR * (nd + 140), ebit = E - CAPEX_CORE * C - CAPEX_BW * b[i].rev * STUB[i];
      const tax = TAX * Math.max(ebit - interest, 0), div = i < 2 ? DIV_FLAT : 0.3 * (ebit - interest - tax);
      const nci = (1 - own) * b[i].std * STUB[i] * (1 - TAX);
      const fcf = E - capex - interest - tax - div - nci - INTEG[i] - EXIT[i] - AI_BUILD[i] - VITAL_SPEND[i];
      nd = nd - fcf + (staged && i === 2 ? t2 : 0);
      const po = staged && i < 2 ? put : 0;
      path.push({ y: ["FY27", "FY28", "FY29", "FY30"][i], nd, e: E, cov: nd / E, adj: (nd + po) / E });
    }
    let npv = -day1;
    for (let i = 0; i < 4; i++) {
      const own = staged && i < 2 ? 0.6 : 1;
      const stdCf = own * b[i].std * STUB[i] * (1 - TAX) - CAPEX_BW * b[i].rev * STUB[i];
      const synCf = b[i].syn * STUB[i] * (1 - TAX) - INTEG[i] - EXIT[i] - REQUAL[i];
      npv += pv(stdCf, T_MID[i], rStd) + pv(synCf, T_MID[i], rSyn);
    }
    if (staged) npv -= pv(t2, T_TR2, rStd);
    npv += pv(b[3].std * 12, T_TERM, rStd) + pv(b[3].syn * 12, T_TERM, rSyn);
    const rev29 = CORE[2] + b[2].rev + CORE[2] * 0.005, cagr = Math.pow(rev29 / 1800, 0.25) - 1;
    const func = (b[2].rev + 22 * Math.pow(1.11, 4) * 0.9) / rev29;
    const opm = (CORE[2] * OP_M + (b[2].ebitda - 0.02 * b[2].rev) + (AI_GROSS[2] - AI_RUN[2]) + VITAL_SAVE[2]) / rev29;
    const peakCov = Math.max(...path.map((p) => p.cov)), peakAdj = Math.max(...path.map((p) => p.adj));
    return { path, npv, t2, day1, rev29, cagr, func, opm, peakCov, peakAdj, total: (staged ? 0.6 * v1 : 450) + t2, b };
  }
  return { run, CORE };
})();
if (typeof module !== "undefined") module.exports = M;
