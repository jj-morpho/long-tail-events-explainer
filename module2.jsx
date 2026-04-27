// module2.jsx — Liquidity Correlations & IRM response (fused, 40s)
//
// Interleaves two views that share a single utilization/rate state:
//
//   L1  0–10s  Liquidity view: bad debt event → mass redemption →
//              shared WBTC market drains to 100% → innocent vaults lock up
//   I1 10–18s  IRM view: utilization pinned at 100% → rate spikes, attractive
//              lending opportunity, lenders arrive
//   L2 18–26s  Liquidity view: fresh liquidity pours INTO the shared market,
//              util starts falling, frozen vaults thaw
//   I2 26–32s  IRM view: util drifts 100% → ~90%, rate falls back to target
//   L3 32–40s  Liquidity view: all vaults liquid again, market at 90%

const M2 = {
  W: 1600, H: 900,
  lenderRowY: 220,
  vaultRowY: 400,
  marketRowY: 640,
  vaultW: 240,
  marketW: 180,
  lenderW: 180,
};

// Three anonymous vaults — A is the risky one.
const M2_VAULTS = [
  { name: 'Vault A', tvl: '$100M', role: 'risky' },     // 0
  { name: 'Vault B', tvl: '$100M', role: 'innocent' },  // 1
  { name: 'Vault C', tvl: '$100M', role: 'innocent' },  // 2
];

// Four markets: rsETH impacted, WBTC is the shared healthy one.
// [Original data kept as a default; LiquidityView accepts a `config` prop to
//  override for the cross-protocol view.]
const M2_MARKETS = [
  { sym: 'rsETH',  role: 'impacted' }, // 0
  { sym: 'WBTC',   role: 'shared'   }, // 1
  { sym: 'wETH',   role: 'side'     }, // 2
  { sym: 'wstETH', role: 'side'     }, // 3
];

// Vault → markets
const M2_EDGES = [
  [0, 1, 2],   // A → rsETH, WBTC, wETH
  [1, 3],      // B → WBTC, wstETH
  [1, 2],      // C → WBTC, wETH
];

// Cross-protocol scene removed (Ch6 deleted; Module 2 is 75s).

function m2Positions() {
  return m2PositionsFor(M2_VAULTS.length, M2_MARKETS.length);
}

function m2PositionsFor(vCount, mCount) {
  const vaultGap = 60;
  const vTotalW = vCount * M2.vaultW + (vCount - 1) * vaultGap;
  const vStart  = (M2.W - vTotalW) / 2;
  const vaultX  = (i) => vStart + i * (M2.vaultW + vaultGap);
  const vaultCX = (i) => vaultX(i) + M2.vaultW / 2;

  const mGap    = 56;
  const mTotalW = mCount * M2.marketW + (mCount - 1) * mGap;
  const mStart  = (M2.W - mTotalW) / 2;
  const marketX  = (i) => mStart + i * (M2.marketW + mGap);
  const marketCX = (i) => marketX(i) + M2.marketW / 2;
  return { vaultX, vaultCX, marketX, marketCX };
}

// Beat timings for the whole 40s piece
const B2 = {
  // 6 chapters × 15s = 90s total
  // Ch1  0–15s  Shared liquidity (intro, pre-incident)
  intro:      [0.5, 5.0],
  settle1:    [5.0, 14.5],
  // Ch2 15–30s  Incident → liquidity event (drain)
  event:      [16.0, 18.0],
  redeem:     [17.5, 22.0],
  drain:      [20.0, 26.0],
  lockup:     [25.5, 29.5],
  // Ch3 30–45s  IRM view: utilization pinned → rate spikes
  irm1_enter: [30.0, 31.0],
  irm1_spike: [31.0, 36.0],
  irm1_attract: [35.0, 44.5],
  // Ch4 45–60s  Higher rate attracts liquidity (inflow)
  l2_enter:   [45.0, 46.0],
  inflow:     [46.0, 52.0],
  thaw:       [50.0, 58.5],
  // Ch5 60–75s  Normalization across the protocol
  irm2_enter: [60.0, 61.0],
  relax:      [61.0, 67.0],
  l3_enter:   [68.0, 69.0],
  delist:     [68.5, 70.5],   // Vault A delists rsETH market (edge breaks)
  realize:    [70.5, 72.0],   // Bad debt realized — vault A marks down
  steady:     [72.0, 74.5],
  // Ch6 75–90s  Cross-protocol: same dynamic applies across lending protocols
  cp_enter:   [75.0, 76.5],  // unused — kept only for shape compatibility
  cp_incident:[78.0, 80.0],
  cp_exit:    [80.0, 84.5],
  cp_rate:    [83.0, 87.0],
  cp_settle:  [87.0, 89.5],
};

// Utilization trajectory for shared WBTC market across the whole 40s.
// One source of truth — drives both the chart and the liquidity-view fills.
function utilAt(T) {
  if (T < B2.intro[1]) {
    // settle at ~42%
    const s = Easing.easeOutCubic(window01(T, B2.intro[0], B2.intro[1]));
    return 0.40 + 0.02 * s;
  }
  if (T < B2.drain[0]) return 0.42 + 0.008 * Math.sin(T * 1.1);
  if (T < B2.drain[1]) {
    // climb to 1.0
    const s = Easing.easeInOutCubic(window01(T, B2.drain[0], B2.drain[1]));
    return 0.42 + 0.58 * s;
  }
  if (T < B2.inflow[0]) return 1.0;
  if (T < B2.relax[1]) {
    // drop from 1.0 → 0.90 across inflow + relax
    const s = Easing.easeInOutCubic(window01(T, B2.inflow[0], B2.relax[1]));
    return 1.0 - 0.10 * s;
  }
  return 0.90 + 0.005 * Math.sin(T * 1.1);
}

// IRM curve — AdaptiveCurve-ish; target=90%, kink up sharply beyond.
function irmRate2(u) {
  const target = 0.9;
  if (u <= target) return 0.005 + (u / target) * 0.035; // 0.5% → 4%
  const over = (u - target) / (1 - target);
  return 0.04 + over * over * 0.10; // up to ~14% at 100%
}

/* ──────────────────────────────────────────────────────────────────
   VIEW 1 — Liquidity (3 vaults → 4 markets).
   Single component driven by T and the utilization from utilAt(T).
   Handles all three liquidity acts (L1, L2, L3).
   ────────────────────────────────────────────────────────────────── */
function LiquidityView({ T, act }) {
  const isCP = false;  // kept as stable const so existing !isCP branches remain valid
  const VAULTS = M2_VAULTS;
  const MARKETS = M2_MARKETS;
  const EDGES = M2_EDGES;
  const sectionLabelTop    = 'Vaults · $100M each';
  const sectionLabelBottom = 'Markets';
  const kindLabelTop    = 'Vault';
  const kindLabelBottom = 'Market';

  const P = m2PositionsFor(VAULTS.length, MARKETS.length);
  const util = utilAt(T);

  // Flags per act
  const inL1 = act === 1;
  const inL2 = act === 2;
  const inL3 = act === 3;

  // Stream direction + color for WBTC market
  // L1: outflow (vaults → market draining) — pink/orange
  // L2: inflow (market filling, new lenders) — purple
  // L3: calm — faint blue
  const redeemT = Easing.easeInOutCubic(window01(T, B2.redeem[0], B2.redeem[1]));
  const drainT  = Easing.easeInOutCubic(window01(T, B2.drain[0], B2.drain[1]));
  const lockupT = Easing.easeOutCubic(window01(T, B2.lockup[0], B2.lockup[1]));
  const inflowT = Easing.easeInOutCubic(window01(T, B2.inflow[0], B2.inflow[1]));
  const thawT   = Easing.easeOutCubic(window01(T, B2.thaw[0], B2.thaw[1]));
  const steadyT = Easing.easeOutCubic(window01(T, B2.steady[0], B2.steady[0] + 1.0));
  const delistT = Easing.easeOutCubic(window01(T, B2.delist[0], B2.delist[1]));
  const realizeT = Easing.easeOutCubic(window01(T, B2.realize[0], B2.realize[1]));

  const edges = [];
  EDGES.forEach((mkts, vi) => mkts.forEach((mi) => edges.push({ vi, mi })));

  // Is the bad debt event still visible? It never reverses — rsETH stays flagged.
  const eventLive = T > B2.event[0];

  return (
    <>
      {/* Section labels */}
      {!isCP && (
        <div style={{
          position: 'absolute', left: 132, top: M2.lenderRowY + 14,
          fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.16em',
          color: MORPHO.textFaint, textTransform: 'uppercase',
        }}>Lenders</div>
      )}
      <div style={{
        position: 'absolute', left: 132, top: M2.vaultRowY + 14,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.16em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
      }}>{sectionLabelTop}</div>
      <div style={{
        position: 'absolute', left: 132, top: M2.marketRowY + 14,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.16em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
      }}>{sectionLabelBottom}</div>

      {/* Connector + flow SVG layer */}
      <svg width={M2.W} height={M2.H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id="m2-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <radialGradient id="m2-pulse" cx="50%" cy="50%">
            <stop offset="0%" stopColor={MORPHO.danger} stopOpacity="0.5" />
            <stop offset="60%" stopColor={MORPHO.danger} stopOpacity="0.08" />
            <stop offset="100%" stopColor={MORPHO.danger} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="m2-purplepulse" cx="50%" cy="50%">
            <stop offset="0%" stopColor={MORPHO.purple} stopOpacity="0.35" />
            <stop offset="70%" stopColor={MORPHO.purple} stopOpacity="0.05" />
            <stop offset="100%" stopColor={MORPHO.purple} stopOpacity="0" />
          </radialGradient>
          {/* USDC coin logo as a reusable symbol — drawn at 0,0 with radius 10
               so x/y on <use> places its CENTER. */}
          <symbol id="m2-usdc-coin" viewBox="-1000 -1000 2000 2000" overflow="visible">
            <circle cx="0" cy="0" r="1000" fill="#2775ca" />
            <path transform="translate(-1000 -1000)" fill="#fff"
              d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z" />
            <path transform="translate(-1000 -1000)" fill="#fff"
              d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z" />
          </symbol>
        </defs>

        {edges.map(({ vi, mi }, idx) => {
          const x1 = P.vaultCX(vi);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(mi);
          const y2 = M2.marketRowY;
          const d = curvePath(x1, y1, x2, y2);
          const delay = idx * 0.06;
          const draw = Easing.easeOutCubic(window01(T, B2.intro[0] + 0.3 + delay, B2.intro[0] + 1.1 + delay));

          const isImpactedEdge = (vi === 0 && mi === 0);
          const isSharedEdge   = (mi === 1);
          const isRiskyShared  = isSharedEdge && vi === 0;
          const isInnocentShared = isSharedEdge && vi !== 0;

          let stroke = MORPHO.borderStrong;
          let strokeW = 1;
          let op = 0.55;

          if (isImpactedEdge && eventLive) {
            const t = Easing.easeOutCubic(window01(T, B2.event[0], B2.event[1]));
            stroke = mixHex(MORPHO.borderStrong, MORPHO.danger, t);
            strokeW = 1 + t * 0.8;
            // During L3 the vault delists rsETH — edge fades away entirely.
            if (inL3) {
              op = 0.55 * (1 - delistT);
            }
          } else if (isRiskyShared) {
            // draining (L1) → purple inflow (L2) → blue healthy (L3)
            if (inL1) {
              stroke = mixHex(mixHex(MORPHO.borderStrong, MORPHO.brand, redeemT), MORPHO.warning, drainT);
              strokeW = 1 + 1.2 * Easing.easeOutCubic(window01(T, B2.redeem[0], B2.drain[1]));
            } else if (inL2) {
              stroke = mixHex(MORPHO.warning, MORPHO.purple, inflowT);
              strokeW = 1 + 0.8 * (1 - inflowT * 0.5);
            } else {
              stroke = mixHex(MORPHO.purple, MORPHO.brand, steadyT);
              strokeW = 1 + 0.3;
            }
          } else if (isInnocentShared) {
            if (inL1) {
              const t = lockupT;
              stroke = mixHex(MORPHO.borderStrong, MORPHO.textFaint, t * 0.6);
              op = 0.55 - t * 0.25;
            } else if (inL2) {
              stroke = mixHex(MORPHO.textFaint, MORPHO.brand, thawT);
              op = 0.35 + thawT * 0.3;
            } else {
              stroke = mixHex(MORPHO.brand, MORPHO.borderStrong, 1 - steadyT * 0.3);
              op = 0.55;
            }
          }

          return (
            <path key={idx} d={d} fill="none"
              stroke={stroke} strokeWidth={strokeW}
              strokeLinecap="round" opacity={draw * op}
            />
          );
        })}

        {/* L1: USDC flow UP from shared WBTC market into Vault A
             (mass redemption pulls loan-asset liquidity, NOT collateral) */}
        {inL1 && redeemT > 0.05 && drainT < 0.97 && (() => {
          const x1 = P.vaultCX(0);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(1);
          const y2 = M2.marketRowY;
          const d = curvePath(x1, y1, x2, y2);
          const pathId = `m2-mv-usdc-path`;
          return (
            <g>
              <path id={pathId} d={d} fill="none" stroke="none" />
              {/* $ traveling with the stream — market → vault (withdrawal) */}
              <text fontSize="13" fontWeight="700"
                    fill={MORPHO.danger} textAnchor="middle"
                    dominantBaseline="central" fontFamily={FONTS.mono}
                    opacity={0.95 * redeemT * (1 - drainT * 0.8)}>
                $
                <animateMotion dur="2.8s" repeatCount="indefinite"
                  keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                  begin="-1.4s">
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </text>
            </g>
          );
        })()}

        {/* L1: During lockup, USDC continues flowing from WBTC up to Vault A
             — the withdrawal narrative continues even when the market is
             100% utilized. */}
        {inL1 && lockupT > 0.1 && (() => {
          const x1 = P.vaultCX(0);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(1);
          const y2 = M2.marketRowY;
          const d = curvePath(x1, y1, x2, y2);
          const pathId = `m2-mv-lockup-path`;
          return (
            <g opacity={lockupT * 0.95}>
              <path id={pathId} d={d} fill="none" stroke="none" />
              <text fontSize="13" fontWeight="700"
                    fill={MORPHO.danger} textAnchor="middle"
                    dominantBaseline="central" fontFamily={FONTS.mono}>
                $
                <animateMotion dur="3.2s" repeatCount="indefinite"
                  keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                  begin="-1.6s">
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </text>
            </g>
          );
        })()}

        {/* L2: NEW LENDER inflow — purple particles from above (off-canvas) down INTO WBTC */}
        {/* L2: off-canvas purple inflow REMOVED — deposits now come from
             the lender row via the fan-out curves (see LV deposit block). */}

        {/* L2: Deposits continuing vault→market — blue particles flowing
             DOWN from innocent vaults (B, C) into WBTC. This is the
             visual counterpart to the lender→vault deposits happening
             simultaneously in the top half. */}
        {inL2 && inflowT > 0.15 && [1, 2].map((vi, idx) => {
          const x1 = P.vaultCX(vi);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(1);
          const y2 = M2.marketRowY;
          const d = curvePath(x1, y1, x2, y2);
          const pathId = `m2-vm-dep-path-${vi}`;
          return (
            <g key={`dep2mkt-${vi}`} opacity={inflowT * 0.85}>
              <path id={pathId} d={d} fill="none" stroke="none" />
              {/* $ traveling vault → market (deposit continues) */}
              <text fontSize="13" fontWeight="700"
                    fill={MORPHO.brand} textAnchor="middle"
                    dominantBaseline="central" fontFamily={FONTS.mono}>
                $
                <animateMotion dur="3s" repeatCount="indefinite"
                  keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                  begin={`-${(idx * 0.75 + 1.5) % 3}s`}>
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </text>
            </g>
          );
        })}

        {/* L3: gentle healthy two-way flow vault ↔ market.
             - DOWN ($, brand): deposit / supply moving into the market
             - UP   ($, success-green): interest paid back to vault (yield) */}
        {inL3 && steadyT > 0.1 && [0, 1, 2].map((vi) => {
          const x1 = P.vaultCX(vi);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(1);
          const y2 = M2.marketRowY;
          const d = curvePath(x1, y1, x2, y2);
          const pathId = `m2-st-vm-path-${vi}`;
          return (
            <g key={`st-${vi}`} opacity={steadyT * 0.85}>
              <path id={pathId} d={d} fill="none" stroke="none" />
              {/* DOWN — supply */}
              <text fontSize="13" fontWeight="700"
                    fill={MORPHO.brand} textAnchor="middle"
                    dominantBaseline="central" fontFamily={FONTS.mono}>
                $
                <animateMotion dur="4s" repeatCount="indefinite"
                  keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                  begin={`-${vi * 1.3}s`}>
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </text>
              {/* UP — interest paid back */}
              <text fontSize="13" fontWeight="700"
                    fill={MORPHO.success} textAnchor="middle"
                    dominantBaseline="central" fontFamily={FONTS.mono}>
                $
                <animateMotion dur="4s" repeatCount="indefinite"
                  keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                  begin={`-${vi * 1.3 + 2}s`}>
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </text>
            </g>
          );
        })}

        {/* Bad debt event pulse (L1 only) */}
        {inL1 && (() => {
          const t = Easing.easeOutCubic(window01(T, B2.event[0], B2.event[0] + 0.8)) * Math.exp(-(T - B2.event[0]) * 0.8);
          if (t < 0.02) return null;
          const cx = P.marketCX(0), cy = M2.marketRowY + 48;
          const r = 22 + t * 140;
          return <circle cx={cx} cy={cy} r={r} fill="url(#m2-pulse)" opacity={t} />;
        })()}

        {/* L3: Delist marker — an ✕ on the broken rsETH ↔ Vault A edge. */}
        {!isCP && inL3 && delistT > 0.1 && (() => {
          const x1 = P.vaultCX(0);
          const y1 = M2.vaultRowY + 100;
          const x2 = P.marketCX(0);
          const y2 = M2.marketRowY;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const fade = delistT * (1 - Math.max(0, (T - B2.realize[1]) / 1.0));
          return (
            <g opacity={Math.max(0, fade)} transform={`translate(${mx} ${my})`}>
              <circle r={11} fill={MORPHO.card} stroke={MORPHO.danger} strokeWidth={1.5} />
              <line x1={-4} y1={-4} x2={4} y2={4} stroke={MORPHO.danger} strokeWidth={1.8} strokeLinecap="round" />
              <line x1={-4} y1={4} x2={4} y2={-4} stroke={MORPHO.danger} strokeWidth={1.8} strokeLinecap="round" />
            </g>
          );
        })()}

        {/* ── Lender-to-vault connectors (bipartite fan-out) ─────────────
           Lender A → Vault A, B     (2 edges)
           Lender B → Vault A, B     (2 edges)
           Lender C → Vault A, B, C  (3 edges)
           Total 7 curved edges. Color tracks the flow direction. */}
        {!isCP && (() => {
          const LV_EDGES = [
            { li: 1, vi: 0 }, { li: 1, vi: 1 }, { li: 1, vi: 2 },
          ];
          return LV_EDGES.map(({ li, vi }, idx) => {
            const appear = Easing.easeOutCubic(window01(T, B2.intro[0] + vi * 0.08, B2.intro[0] + 1.0 + vi * 0.08));
            if (appear < 0.05) return null;
            const x1 = P.vaultCX(li);
            const y1 = M2.lenderRowY + 70;     // lender bottom
            const x2 = P.vaultCX(vi);
            const y2 = M2.vaultRowY;            // vault top
            // curved connector: cubic bezier with vertical control points
            const midY = (y1 + y2) / 2;
            const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

            // Flow semantics: only Vault A sees outflow (withdrawals) during L1.
            // Vault B/C edges remain neutral.
            const outflow = inL1 && vi === 0 ? redeemT * (1 - drainT * 0.5) : 0;
            // Inflow (L2) — deposits only go to innocent vaults (B, C), not A.
            const inflow = inL2 && vi !== 0 ? inflowT : 0;

            let stroke = MORPHO.borderStrong;
            let strokeW = 1;
            if (outflow > 0.05) {
              stroke = MORPHO.danger;
              strokeW = 1 + 1.0 * outflow;
            } else if (inflow > 0.05) {
              stroke = MORPHO.purple;
              strokeW = 1 + 0.8 * inflow;
            } else if (inL3 && steadyT > 0.1) {
              stroke = MORPHO.brand;
            }
            const op = Math.min(1, 0.30 + outflow * 0.45 + inflow * 0.45 + (inL3 ? steadyT * 0.35 : 0)) * appear;
            return (
              <path key={`lv-${idx}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={op}
                style={{ transition: 'stroke 400ms' }}
              />
            );
          });
        })()}

        {/* L1: Particles flowing UP along lender→vault curves (USDC withdrawals)
             — Vault A returns USDC to lenders. Same color as the M→V flow above
             so the eye reads it as one continuous USDC chain: market → vault → lender. */}
        {!isCP && inL1 && (() => {
          // Only Vault A shows withdrawal flow during L1.
          const LV_EDGES = [
            { li: 1, vi: 0 },
          ];
          return LV_EDGES.map(({ li, vi }, idx) => {
            const strength = redeemT * (1 - drainT * 0.6);
            if (strength < 0.05) return null;
            const x1 = P.vaultCX(li);
            const y1 = M2.lenderRowY + 70;
            const x2 = P.vaultCX(vi);
            const y2 = M2.vaultRowY;
            const midY = (y1 + y2) / 2;
            const d = `M ${x2} ${y2} C ${x2} ${midY}, ${x1} ${midY}, ${x1} ${y1}`;
            const pathId = `m2-vl-usdc-path-${idx}`;
            return (
              <g key={`outg-${idx}`}>
                <path id={pathId} d={d} fill="none" stroke="none" />
                {/* $ traveling with the stream — vault → lender (withdrawal) */}
                <text fontSize="13" fontWeight="700"
                      fill={MORPHO.danger} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}
                      opacity={strength * 0.95}>
                  $
                  <animateMotion dur="2.8s" repeatCount="indefinite"
                    keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                    begin={`-${idx * 0.4}s`}>
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </text>
              </g>
            );
          });
        })()}

        {/* L2: Deposit particles flowing DOWN to innocent vaults only (B, C) */}
        {!isCP && inL2 && inflowT > 0.1 && (() => {
          // Down-stream: lenders A, B, C each drop particles into B and C.
          const DEP_EDGES = [
            { li: 1, vi: 1 }, { li: 1, vi: 2 },
          ];
          return DEP_EDGES.map(({ li, vi }, idx) => {
            const x1 = P.vaultCX(li);
            const y1 = M2.lenderRowY + 70;
            const x2 = P.vaultCX(vi);
            const y2 = M2.vaultRowY;
            const midY = (y1 + y2) / 2;
            const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
            const pathId = `m2-lv-dep-path-${idx}`;
            return (
              <g key={`dep-${idx}`} opacity={inflowT * (1 - thawT * 0.3)}>
                <path id={pathId} d={d} fill="none" stroke="none" />
                {/* $ traveling lender → vault (deposit) */}
                <text fontSize="13" fontWeight="700"
                      fill={MORPHO.purple} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="3s" repeatCount="indefinite"
                    keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                    begin={`-${(idx * 0.6) % 3}s`}>
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </text>
              </g>
            );
          });
        })()}

        {/* L3: Ambient healthy flow on all 7 edges, both directions, low-key. */}
        {!isCP && inL3 && steadyT > 0.15 && (() => {
          const LV_EDGES = [
            { li: 1, vi: 0 }, { li: 1, vi: 1 }, { li: 1, vi: 2 },
          ];
          return LV_EDGES.map(({ li, vi }, idx) => {
            const x1 = P.vaultCX(li);
            const y1 = M2.lenderRowY + 70;
            const x2 = P.vaultCX(vi);
            const y2 = M2.vaultRowY;
            const midY = (y1 + y2) / 2;
            const dDown = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
            const pathId = `m2-st-lv-path-${idx}`;
            return (
              <g key={`st-${idx}`} opacity={steadyT * 0.85}>
                <path id={pathId} d={dDown} fill="none" stroke="none" />
                {/* DOWN — deposit / supply */}
                <text fontSize="13" fontWeight="700"
                      fill={MORPHO.brand} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="4s" repeatCount="indefinite"
                    keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                    begin={`-${(idx * 0.7) % 4}s`}>
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </text>
                {/* UP — yield paid back to lender */}
                <text fontSize="13" fontWeight="700"
                      fill={MORPHO.success} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="4s" repeatCount="indefinite"
                    keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                    begin={`-${(idx * 0.7 + 2) % 4}s`}>
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </text>
              </g>
            );
          });
        })()}
      </svg>

      {/* Vaults row */}
      {VAULTS.map((v, vi) => {
        const appear = Easing.easeOutCubic(window01(T, B2.intro[0] + vi * 0.08, B2.intro[0] + 1.0 + vi * 0.08));
        let state = 'healthy';
        let userLoss = null;
        let lockLabel = null;
        let badge = null;

        if (vi === 0) {
          // Vault A — risky. Impacted while rsETH market is still present;
          // returns healthy once the market is delisted (L3 · steady phase).
          if (eventLive) state = 'impacted';
          if (inL1 && T > B2.redeem[0]) userLoss = 'withdrawals →';
          // NOTE: no "absorbing inflows" — new lenders avoid the impacted vault
          if (inL3) {
            // Three-beat realization sequence:
            //   68.5–70.5  delist rsETH market
            //   70.5–72.0  realize bad debt (vault marks down)
            //   72.0+      liquidity restored (normalized, healthy again)
            if (realizeT < 0.5 && delistT > 0.05) {
              badge = { label: 'remove exposure to market', color: MORPHO.danger };
            } else if (realizeT >= 0.5 && steadyT < 0.2) {
              badge = { label: 'no more exposure', color: MORPHO.danger };
            } else {
              badge = { label: 'liquidity restored', color: MORPHO.success };
              state = 'healthy';
            }
          }
        } else {
          // Innocent vaults
          if (inL1 && lockupT > 0.05) {
            state = 'locked';
            lockLabel = 'available liquidity ↓';
          } else if (inL2) {
            if (thawT < 0.4) { state = 'healthy'; lockLabel = 'liquidity returning'; }
            else {
              state = 'healthy';
              badge = inflowT > 0.4
                ? { label: 'attracting deposits', color: MORPHO.purple }
                : { label: 'vault liquid again',  color: MORPHO.success };
            }
          } else if (inL3) {
            state = 'healthy';
          }
        }

        // Liquidity bar: fraction of the vault's liquidity AVAILABLE to redeem.
        // 1 = full, 0 = drained. Vault A never fully recovers (bad debt write-down).
        let liquidity;
        if (vi === 0) {
          const drainProg = inL1 ? Easing.easeOutCubic(window01(T, B2.redeem[0], B2.redeem[1])) : 0;
          liquidity = inL1 ? 1 - 0.85 * drainProg                      // drains hard during L1
                    : inL2 ? 0.15 + 0.25 * inflowT                      // some fresh liq, but still depressed
                    :        0.40;                                       // L3: permanently thinner (bad debt)
        } else {
          const lockProg = inL1 ? Easing.easeOutCubic(window01(T, B2.lockup[0], B2.lockup[0] + 1.0)) : 0;
          const thawProg = inL2 ? Easing.easeOutCubic(window01(T, B2.thaw[0], B2.thaw[1])) : 0;
          liquidity = inL1 ? 1 - 0.75 * lockProg                        // drops as lockup builds
                    : inL2 ? 0.25 + 0.70 * thawProg                     // returns to near-full
                    :        0.95;                                       // L3: restored
        }

        return (
          <div key={vi} style={{
            position: 'absolute',
            left: P.vaultX(vi), top: M2.vaultRowY,
            opacity: appear,
            transform: `translateY(${(1 - appear) * -10}px)`,
          }}>
            <VaultCardBig
              name={v.name} tvl={v.tvl} state={state}
              userLoss={userLoss} liquidity={liquidity} width={M2.vaultW}
              lockLabel={lockLabel} badge={badge}
              kindLabel={kindLabelTop}
            />
          </div>
        );
      })}

      {/* Markets row */}
      {MARKETS.map((m, mi) => {
        const appear = Easing.easeOutCubic(window01(T, B2.intro[0] + 0.3 + mi * 0.08, B2.intro[0] + 1.1 + mi * 0.08));
        let state = 'healthy';
        let u = 0.4 + 0.04 * Math.sin(mi + T * 0.5);
        if (mi === 0 && eventLive) state = 'impacted';
        if (mi === 1) {
          u = util;
          if (inL1 && T > B2.drain[0]) state = 'drained';
          else if (inL2 && inflowT > 0.25) state = 'hot';
          else if (inL3) state = 'healthy';
        }
        const utilLabel = mi === 1 ? `${Math.round(u * 100)}%` : null;
        return (
          <div key={mi} style={{
            position: 'absolute',
            left: P.marketX(mi), top: M2.marketRowY,
            opacity: appear,
            transform: `translateY(${(1 - appear) * 10}px)`,
          }}>
            <MarketCardBig
              symbol={m.sym} state={state} utilization={u}
              width={M2.marketW} utilLabel={utilLabel}
              kindLabel={kindLabelBottom}
              dotColor={null}
              subtitle={'/ USDC'}
            />
          </div>
        );
      })}

      {/* Lenders row — one chip sitting above each vault (in-protocol only).
         During L1 they appear agitated (red outflow). During L2 they're
         actively depositing (purple inflow). During L3 they're calm.       */}
      {!isCP && (() => {
        // Single shared lender rendered over Vault B (center).
        const vi = 1;
        const appear = Easing.easeOutCubic(window01(T, B2.intro[0] + vi * 0.08, B2.intro[0] + 1.0 + vi * 0.08));
        let lenderState = 'healthy';
        let badge = null;
        if (inL1) {
          if (T > B2.redeem[0]) {
            lenderState = 'outflow';
            badge = redeemT > 0.2 ? 'withdrawing' : null;
          }
        } else if (inL2) {
          if (inflowT > 0.15) {
            lenderState = 'inflow';
            badge = inflowT > 0.35 ? 'depositing' : null;
          }
        } else if (inL3 && steadyT > 0.2) {
          badge = null;
        }
        const lenderX = P.vaultCX(vi) - M2.lenderW / 2;
        return (
          <div key={`lender-${vi}`} style={{
            position: 'absolute',
            left: lenderX, top: M2.lenderRowY,
            opacity: appear,
            transform: `translateY(${(1 - appear) * -10}px)`,
            transition: 'transform 300ms',
          }}>
            <LenderChip
              label="Lenders"
              amount="$50M"
              state={lenderState}
              width={M2.lenderW}
              badge={badge}
            />
          </div>
        );
      })()}

      {/* Act-specific annotations */}

      {/* L1 · mass-redeem pill REMOVED — lender-exit motion is self-evident
         from the upward particle streams along the lender→vault edges. */}

      {/* L1 · 100% saturation badge on shared market */}
      {inL1 && (
        <Sprite start={B2.drain[1] - 1.5} end={30.0} keepMounted>
          {({ localTime }) => {
            const fade = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));
            return (
              <div style={{
                position: 'absolute',
                left: P.marketCX(1), top: M2.marketRowY + 148,
                transform: `translateX(-50%) translateY(${(1 - fade) * 8}px)`,
                opacity: fade,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: MORPHO.warningBg,
                  border: `1px solid ${MORPHO.warning}`,
                  borderRadius: 999,
                  fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.08em',
                  color: '#8A5A1C', textTransform: 'uppercase',
                }}>
                  WBTC · 100% utilized · no available liquidity
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* L2 · new-lenders-arriving chip above shared market */}
      {inL2 && (
        <Sprite start={B2.inflow[0] + 0.3} end={60.0} keepMounted>
          {({ localTime }) => {
            const fade = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));
            return (
              <div style={{
                position: 'absolute',
                left: P.marketCX(1), top: M2.marketRowY + 148,
                transform: `translateX(-50%) translateY(${(1 - fade) * 8}px)`,
                opacity: fade,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: MORPHO.purpleBg,
                  border: `1px solid ${MORPHO.purple}`,
                  borderRadius: 999,
                  fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.08em',
                  color: MORPHO.purple, textTransform: 'uppercase',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: MORPHO.purple }} />
                  New lenders — attracted by high rate
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* L3 · steady-state chip */}
      {inL3 && (
        <Sprite start={B2.steady[0] + 0.5} end={75.0} keepMounted>
          {({ localTime }) => {
            const fade = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));
            return (
              <div style={{
                position: 'absolute',
                left: P.marketCX(1), top: M2.marketRowY + 118,
                transform: `translateX(-50%) translateY(${(1 - fade) * 8}px)`,
                opacity: fade,
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: MORPHO.successBg,
                  border: `1px solid ${MORPHO.success}`,
                  borderRadius: 999,
                  fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.08em',
                  color: MORPHO.success, textTransform: 'uppercase',
                }}>
                  WBTC · 90% utilized · at target
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* Bottom caption — rotates per act */}
      <LiquidityCaption T={T} act={act} />
    </>
  );
}

function LiquidityCaption({ T, act }) {
  // Fade-in/out caption that updates per-act
  const captions = {
    1: { em: 'Liquidity, not losses, is correlated.', rest: '' },
    2: null,
    3: { em: 'Bad debt contained, market clears.', rest: '' },
  };
  const c = captions[act];
  if (!c) return null;
  // Act windows: L1=9-10s visible, L2=22-26s, L3=34-40s
  const [fadeStart, fadeEnd, holdEnd] = act === 1 ? [27.5, 28.1, 30.0]
                                      : act === 2 ? [56.0, 56.6, 60.0]
                                      : [72.0, 72.6, 75.0];
  const fade = Easing.easeOutCubic(window01(T, fadeStart, fadeEnd));
  const out = Easing.easeInCubic(window01(T, holdEnd - 0.4, holdEnd));
  return (
    <div style={{
      position: 'absolute', left: M2.W / 2, bottom: 30,
      transform: `translateX(-50%) translateY(${(1 - fade) * 12 + out * -6}px)`,
      opacity: fade * (1 - out),
      textAlign: 'center', fontFamily: FONTS.body,
      color: MORPHO.textMuted, fontSize: 17,
      maxWidth: 820,
    }}>
      <span style={{ color: MORPHO.text }}>{c.em}</span>{c.rest}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   VIEW 2 — IRM chart + right-side market/rate card.
   Ported from old module3, adapted for our shared utilAt(T).
   ────────────────────────────────────────────────────────────────── */
const IRM_CHART = {
  x: 140, y: 260, w: 640, h: 380,
  rightX: 900, rightY: 260,
};

function IRMView({ T, act }) {
  // IRM view shows its own animated trajectory, independent of the global
  // utilAt(T). The global state is already "pinned at 100%" by the time we
  // cut into this view, so we replay the climb (act 1) or the unwind (act 2).
  //
  // Act 1 (I1: T=30..45 global):
  //   0..1.5s — sit at 75% / low rate (pre-crisis recap)
  //   1.5..6s — climb 75% → 100%, rate spikes
  //   6..end — hold at 100% / 14%
  //
  // Act 2 (I2: T=60..68 global):
  //   0..1s — hold at 100% / 14%
  //   1..6s — drop 100% → 90%, rate unwinds to 4%
  //   6..end — hold at target
  const startT = act === 1 ? B2.irm1_enter[0] : B2.irm2_enter[0];
  const localT = Math.max(0, T - startT);

  let util, rate;
  if (act === 1) {
    if (localT < 1.5) {
      util = 0.75;
    } else if (localT < 6.0) {
      const p = Easing.easeInOutCubic(window01(localT, 1.5, 6.0));
      util = 0.75 + 0.25 * p;
    } else {
      util = 1.0;
    }
    rate = irmRate2(util);
  } else {
    if (localT < 1.0) {
      util = 1.0;
    } else if (localT < 6.0) {
      const p = Easing.easeInOutCubic(window01(localT, 1.0, 6.0));
      util = 1.0 - 0.10 * p;
    } else {
      util = 0.90;
    }
    rate = irmRate2(util);
  }

  // Chart coord helpers
  const cx = (u) => IRM_CHART.x + u * IRM_CHART.w;
  const cy = (r) => IRM_CHART.y + IRM_CHART.h - (r / 0.16) * IRM_CHART.h; // 0..16%

  const irmPath = React.useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      pts.push(`${i === 0 ? 'M' : 'L'} ${cx(u).toFixed(1)} ${cy(irmRate2(u)).toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);

  const gridUtil = [0.25, 0.5, 0.75, 0.9, 1.0];
  const gridRate = [0.02, 0.05, 0.10, 0.15];

  // Enter fade — use local act windows
  const enterStart = act === 1 ? B2.irm1_enter[0] : B2.irm2_enter[0];
  const enterEnd   = act === 1 ? B2.irm1_enter[1] : B2.irm2_enter[1];
  const enterT = Easing.easeOutCubic(window01(T, enterStart, enterEnd + 0.2));

  const hot = util >= 0.98;
  const restoring = act === 2 && util < 0.98;

  return (
    <div style={{ opacity: enterT, transform: `translateY(${(1 - enterT) * 10}px)`, position: 'absolute', inset: 0 }}>
      {/* Top-left chart label */}
      <div style={{
        position: 'absolute', left: IRM_CHART.x - 4, top: IRM_CHART.y - 58,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.14em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
      }}>Interest rate · WBTC / USDC</div>

      <svg width={M2.W} height={M2.H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="m2-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MORPHO.brand} stopOpacity="0.18" />
            <stop offset="100%" stopColor={MORPHO.brand} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="m2-area-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MORPHO.purple} stopOpacity="0.22" />
            <stop offset="100%" stopColor={MORPHO.purple} stopOpacity="0" />
          </linearGradient>
          <filter id="m2-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Grid */}
        <g>
          {gridUtil.map((u) => (
            <g key={`vu-${u}`}>
              <line x1={cx(u)} y1={IRM_CHART.y} x2={cx(u)} y2={IRM_CHART.y + IRM_CHART.h}
                stroke={MORPHO.border} strokeWidth="1"
                strokeDasharray={u === 0.9 || u === 1.0 ? "none" : "3 4"}
                opacity={u === 0.9 ? 0.9 : 0.55} />
              <text x={cx(u)} y={IRM_CHART.y + IRM_CHART.h + 22} textAnchor="middle"
                fontFamily={FONTS.mono} fontSize="11" fill={MORPHO.textFaint}>
                {Math.round(u * 100)}%
              </text>
            </g>
          ))}
          {gridRate.map((r) => (
            <g key={`hr-${r}`}>
              <line x1={IRM_CHART.x} y1={cy(r)} x2={IRM_CHART.x + IRM_CHART.w} y2={cy(r)}
                stroke={MORPHO.border} strokeWidth="1" strokeDasharray="3 4" opacity={0.55} />
              <text x={IRM_CHART.x - 10} y={cy(r) + 4} textAnchor="end"
                fontFamily={FONTS.mono} fontSize="11" fill={MORPHO.textFaint}>
                {Math.round(r * 100)}%
              </text>
            </g>
          ))}
          <text x={IRM_CHART.x + IRM_CHART.w / 2} y={IRM_CHART.y + IRM_CHART.h + 46}
            textAnchor="middle"
            fontFamily={FONTS.mono} fontSize="10" fill={MORPHO.textFaint}
            letterSpacing="1.6" style={{ textTransform: 'uppercase' }}>
            UTILIZATION
          </text>
          <text x={IRM_CHART.x - 48} y={IRM_CHART.y - 14}
            fontFamily={FONTS.mono} fontSize="10" fill={MORPHO.textFaint}
            letterSpacing="1.6" style={{ textTransform: 'uppercase' }}>
            BORROW RATE
          </text>
          <text x={cx(0.9)} y={IRM_CHART.y - 10} textAnchor="middle"
            fontFamily={FONTS.mono} fontSize="10" fill={MORPHO.textMuted}
            letterSpacing="1.4" style={{ textTransform: 'uppercase' }}>
            Target
          </text>
        </g>

        {/* Area under curve */}
        <path
          d={`${irmPath} L ${cx(1)} ${IRM_CHART.y + IRM_CHART.h} L ${cx(0)} ${IRM_CHART.y + IRM_CHART.h} Z`}
          fill={hot ? "url(#m2-area-hot)" : "url(#m2-area)"}
          style={{ transition: 'fill 400ms' }}
        />
        {/* Curve */}
        <path d={irmPath}
          fill="none"
          stroke={MORPHO.brandDeep} strokeWidth={2} strokeLinecap="round"
          opacity={enterT}
        />

        {/* Dot */}
        {(() => {
          const x = cx(util);
          const y = cy(rate);
          const color = hot ? MORPHO.purple : restoring ? MORPHO.brand : MORPHO.brandDeep;
          return (
            <g opacity={enterT}>
              {hot && (
                <circle cx={x} cy={y} r={14 + Math.sin(T * 6) * 3}
                  fill={MORPHO.purple} opacity={0.25} filter="url(#m2-glow)" />
              )}
              <circle cx={x} cy={y} r={8} fill="#fff" stroke={color} strokeWidth={2} />
              <circle cx={x} cy={y} r={3.5} fill={color} />
              <g transform={`translate(${x}, ${y - 26})`}>
                <rect x={-40} y={-20} width={80} height={28} rx={6}
                  fill={MORPHO.card} stroke={color} strokeWidth={1} />
                <text x={0} y={-2} textAnchor="middle"
                  fontFamily={FONTS.mono} fontSize="13"
                  fill={color} fontWeight="500">
                  {(rate * 100).toFixed(1)}%
                </text>
              </g>
            </g>
          );
        })()}

        {/* Motion trail */}
        {(() => {
          const span = 2.0;
          const start = Math.max(0, localT - span);
          if (localT - start < 0.05) return null;
          const samples = 40;
          const path = [];
          // Replay the local util trajectory
          function localUtilAt(lT) {
            if (act === 1) {
              if (lT < 1.5) return 0.75;
              if (lT < 6.0) {
                const p = Easing.easeInOutCubic(window01(lT, 1.5, 6.0));
                return 0.75 + 0.25 * p;
              }
              return 1.0;
            } else {
              if (lT < 1.0) return 1.0;
              if (lT < 6.0) {
                const p = Easing.easeInOutCubic(window01(lT, 1.0, 6.0));
                return 1.0 - 0.10 * p;
              }
              return 0.90;
            }
          }
          for (let i = 0; i <= samples; i++) {
            const tt = start + (localT - start) * (i / samples);
            const u = localUtilAt(tt);
            const r = irmRate2(u);
            path.push(`${i === 0 ? 'M' : 'L'} ${cx(u).toFixed(1)} ${cy(r).toFixed(1)}`);
          }
          return <path d={path.join(' ')} fill="none"
            stroke={hot ? MORPHO.purple : MORPHO.brandDeep} strokeWidth="1.5" strokeLinecap="round"
            opacity="0.35" strokeDasharray="4 3" />;
        })()}
      </svg>

      {/* Right side: market + utilization/rate readout */}
      <div style={{
        position: 'absolute', left: IRM_CHART.rightX, top: IRM_CHART.rightY,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.14em',
          color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 12,
        }}>Market</div>
        <div style={{
          width: 420, padding: '22px 26px',
          background: MORPHO.card,
          border: `1px solid ${hot ? MORPHO.purple : restoring ? MORPHO.brand : MORPHO.border}`,
          boxShadow: hot
            ? `0 0 0 6px ${MORPHO.purpleBg}, 0 1px 0 rgba(21,24,26,0.04)`
            : restoring
            ? `0 0 0 6px ${MORPHO.brandBg}, 0 1px 0 rgba(21,24,26,0.04)`
            : '0 1px 0 rgba(21,24,26,0.04)',
          borderRadius: 14,
          transition: 'border-color 300ms, box-shadow 300ms',
          fontFamily: FONTS.body,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 22, height: 22, borderRadius: 22, background: MORPHO.tok.WBTC, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)' }} />
            <span style={{ fontSize: 22, fontWeight: 500, color: MORPHO.text, letterSpacing: '-0.01em' }}>WBTC</span>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 11, color: MORPHO.textFaint,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 4,
            }}>/ USDC</span>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: MORPHO.textFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                Utilization
              </div>
              <div style={{
                fontFamily: FONTS.display, fontWeight: 300, fontSize: 42,
                color: hot ? MORPHO.warning : restoring ? MORPHO.brandDeep : MORPHO.text,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                transition: 'color 300ms',
              }}>{Math.round(util * 100)}%</div>
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: MORPHO.textFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                Borrow rate
              </div>
              <div style={{
                fontFamily: FONTS.display, fontWeight: 300, fontSize: 42,
                color: hot ? MORPHO.purple : restoring ? MORPHO.brandDeep : MORPHO.text,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                transition: 'color 300ms',
              }}>{(rate * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div style={{
            marginTop: 22, height: 4, background: MORPHO.border, borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${util * 100}%`,
              background: hot ? MORPHO.warning : restoring ? MORPHO.brand : MORPHO.brandDeep,
              transition: 'width 400ms cubic-bezier(.2,.8,.2,1), background 300ms',
            }} />
          </div>
        </div>

        {/* I1 — reveal 3 sequential bullets during the "attract" window */}
        {act === 1 && (
          <Sprite start={B2.irm1_attract[0]} end={45.0} keepMounted>
            {({ localTime }) => {
              const steps = [
                { label: 'Borrow rate spikes to 14%',                                color: MORPHO.purple, delay: 0.0 },
                { label: 'Rate increases even though there’s no change to credit risk', color: MORPHO.purple, delay: 1.6 },
                { label: 'Higher rate → borrowers repay or new lenders enter',     color: MORPHO.purple, delay: 3.2 },
              ];
              return (
                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {steps.map((s, i) => {
                    const t = Math.max(0, localTime - s.delay);
                    const fade = Easing.easeOutCubic(clamp(t / 0.45, 0, 1));
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        opacity: fade,
                        transform: `translateY(${(1 - fade) * 8}px)`,
                        fontFamily: FONTS.body,
                      }}>
                        {/* Step number badge */}
                        <div style={{
                          flex: 'none',
                          width: 26, height: 26, borderRadius: 26,
                          background: MORPHO.purpleBg,
                          border: `1px solid ${s.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: FONTS.mono, fontSize: 12, fontWeight: 500,
                          color: s.color,
                        }}>
                          {i + 1}
                        </div>
                        <div style={{
                          fontSize: 15, color: MORPHO.text,
                          letterSpacing: '-0.005em',
                          lineHeight: 1.3,
                        }}>
                          {s.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          </Sprite>
        )}
        {act === 2 && (
          <Sprite start={B2.relax[0] + 0.6} end={68.0} keepMounted>
            {({ localTime }) => {
              const steps = [
                { label: 'New liquidity enters',       color: MORPHO.success, delay: 0.0 },
                { label: 'Utilization drops to target', color: MORPHO.success, delay: 1.6 },
                { label: 'Rate normalizes',            color: MORPHO.success, delay: 3.2 },
              ];
              return (
                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {steps.map((s, i) => {
                    const t = Math.max(0, localTime - s.delay);
                    const fade = Easing.easeOutCubic(clamp(t / 0.45, 0, 1));
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        opacity: fade,
                        transform: `translateY(${(1 - fade) * 8}px)`,
                        fontFamily: FONTS.body,
                      }}>
                        <div style={{
                          flex: 'none',
                          width: 26, height: 26, borderRadius: 26,
                          background: MORPHO.successBg,
                          border: `1px solid ${s.color}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: FONTS.mono, fontSize: 12, fontWeight: 500,
                          color: s.color,
                        }}>
                          {i + 1}
                        </div>
                        <div style={{
                          fontSize: 15, color: MORPHO.text,
                          letterSpacing: '-0.005em',
                          lineHeight: 1.3,
                        }}>
                          {s.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          </Sprite>
        )}
      </div>

      {/* Bottom caption */}
      <IRMCaption T={T} act={act} />
    </div>
  );
}

function IRMCaption({ T, act }) {
  const captions = {
    1: null,
    2: { em: 'The rate unwinds with the queue.', rest: '' },
  };
  const c = captions[act];
  if (!c) return null;
  const [fadeStart, fadeEnd, holdEnd] = act === 1 ? [35.0, 35.6, 45.0] : [64.0, 64.6, 68.0];
  const fade = Easing.easeOutCubic(window01(T, fadeStart, fadeEnd));
  const out = Easing.easeInCubic(window01(T, holdEnd - 0.4, holdEnd));
  return (
    <div style={{
      position: 'absolute', left: M2.W / 2, bottom: 82,
      transform: `translateX(-50%) translateY(${(1 - fade) * 12 + out * -6}px)`,
      opacity: fade * (1 - out),
      textAlign: 'center', fontFamily: FONTS.body,
      color: MORPHO.textMuted, fontSize: 17,
      maxWidth: 820,
    }}>
      <span style={{ color: MORPHO.text }}>{c.em}</span>{c.rest}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Module 2 — the 40s master. Cross-fades between LiquidityView and
   IRMView based on time. A single shared title + top "view" ribbon
   indicate which lens we're in.
   ────────────────────────────────────────────────────────────────── */
function Module2() {
  const { time: T } = useTimeline();

  // Which scene is active?
  // Ch1 0–15 L1 (pre-incident), Ch2 15–30 L1 (incident+drain),
  // Ch3 30–45 I1, Ch4 45–60 L2, Ch5 60–75 I2→L3
  let scene, act; // scene: 'L'|'I'
  if (T < 30) { scene = 'L'; act = 1; }
  else if (T < 45) { scene = 'I'; act = 1; }
  else if (T < 60) { scene = 'L'; act = 2; }
  else if (T < 68) { scene = 'I'; act = 2; }
  else { scene = 'L'; act = 3; }

  // Cross-fade windows (400ms either side of each boundary)
  const fadeDur = 0.4;
  function sceneOpacity(targetScene, targetAct) {
    const windows = {
      L1: [0 - 0.2, 30], L2: [45 - 0.2, 60], L3: [68 - 0.2, 75],
      I1: [30 - 0.2, 45], I2: [60 - 0.2, 68],
    };
    const key = `${targetScene}${targetAct}`;
    const [a, b] = windows[key];
    if (T < a - fadeDur || T > b + fadeDur) return 0;
    const fadeIn = Easing.easeOutCubic(window01(T, a - fadeDur, a));
    const fadeOut = 1 - Easing.easeInCubic(window01(T, b, b + fadeDur));
    return Math.min(fadeIn, fadeOut);
  }

  const opL1 = sceneOpacity('L', 1);
  const opI1 = sceneOpacity('I', 1);
  const opL2 = sceneOpacity('L', 2);
  const opI2 = sceneOpacity('I', 2);
  const opL3 = sceneOpacity('L', 3);

  return (
    <>
      {/* Persistent title */}
      <div style={{
        position: 'absolute', left: M2.W / 2, top: 72,
        transform: 'translateX(-50%)',
        textAlign: 'center', fontFamily: FONTS.display,
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.18em',
          color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 10,
        }}>02 · Liquidity correlations &amp; IRM</div>
        <div style={{
          fontFamily: FONTS.display, fontWeight: 400, fontSize: 38,
          letterSpacing: '-0.02em', color: MORPHO.text, lineHeight: 1.1,
        }}>
          {scene === 'L' && act === 1 && T < 15 && <>Shared markets share their liquidity.</>}
          {scene === 'L' && act === 1 && T >= 15 && <>The exploit of one market triggers liquidity flight from Vault A.</>}
          {scene === 'I' && act === 1 && <>As liquidity crunches, utilization is pushed to 100%.</>}
          {scene === 'L' && act === 2 && <>High rates pull in new lenders.</>}
          {scene === 'I' && act === 2 && <>Utilization eases back to target.</>}
          {scene === 'L' && act === 3 && T < 70.5 && <>Vault A delists the rsETH market.</>}
          {scene === 'L' && act === 3 && T >= 70.5 && T < 72 && <>Bad debt is realized — losses absorbed by vault A.</>}
          {scene === 'L' && act === 3 && T >= 72 && <>Liquidity restored across the protocol.</>}
        </div>
      </div>

      {/* View toggle ribbon */}
      <ViewRibbon T={T} />

      {/* Liquidity layers */}
      {opL1 > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, opacity: opL1 }}>
          <LiquidityView T={T} act={1} />
        </div>
      )}
      {opL2 > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, opacity: opL2 }}>
          <LiquidityView T={T} act={2} />
        </div>
      )}
      {opL3 > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, opacity: opL3 }}>
          <LiquidityView T={T} act={3} />
        </div>
      )}

      {/* IRM layers */}
      {opI1 > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, opacity: opI1 }}>
          <IRMView T={T} act={1} />
        </div>
      )}
      {opI2 > 0.01 && (
        <div style={{ position: 'absolute', inset: 0, opacity: opI2 }}>
          <IRMView T={T} act={2} />
        </div>
      )}

      {/* Cross-protocol layer removed */}
    </>
  );
}

// Small top ribbon showing which view is active + scene number
function ViewRibbon({ T }) {
  const ribbons = [
    { key: 'L1a', scene: 'L', label: 'Shared liquidity' },
    { key: 'L1b', scene: 'L', label: 'Liquidity event' },
    { key: 'I1',  scene: 'I', label: 'Rate spike' },
    { key: 'L2',  scene: 'L', label: 'Attracts liquidity' },
    { key: 'L3',  scene: 'L', label: 'Normalizes' },
  ];
  let activeIdx;
  if (T < 15) activeIdx = 0;
  else if (T < 30) activeIdx = 1;
  else if (T < 45) activeIdx = 2;
  else if (T < 60) activeIdx = 3;
  else activeIdx = 4;
  return (
    <div style={{
      position: 'absolute', left: 48, top: 28,
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.14em',
      color: MORPHO.textFaint, textTransform: 'uppercase',
    }}>
      {ribbons.map((r, i) => (
        <React.Fragment key={r.key}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: i === activeIdx ? MORPHO.text : i < activeIdx ? MORPHO.textMuted : MORPHO.textFaint,
            transition: 'color 300ms',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 6,
              background: i === activeIdx
                ? (r.scene === 'I' ? MORPHO.purple : MORPHO.brand)
                : i < activeIdx ? MORPHO.borderStrong : MORPHO.border,
              transition: 'background 300ms',
            }} />
            {r.label}
          </div>
          {i < ribbons.length - 1 && (
            <div style={{ width: 16, height: 1, background: MORPHO.borderStrong }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Card primitives (unchanged from old module2 + small badge addition)
   ────────────────────────────────────────────────────────────────── */
function VaultCardBig({ name, tvl, state = 'healthy', userLoss = null, liquidity = 1, width = 220, lockLabel = null, badge = null, kindLabel = 'Vault' }) {
  const colorMap = {
    healthy:  { bg: MORPHO.card, bd: MORPHO.border, text: MORPHO.text, accent: MORPHO.brand },
    impacted: { bg: MORPHO.card, bd: MORPHO.danger, text: MORPHO.text, accent: MORPHO.danger },
    locked:   { bg: '#F4F6FB',   bd: MORPHO.borderStrong, text: MORPHO.textMuted, accent: MORPHO.textFaint },
  }[state];
  return (
    <div style={{
      width, height: 108,
      background: colorMap.bg,
      border: `1px solid ${colorMap.bd}`,
      boxShadow: state === 'impacted'
        ? `0 0 0 4px ${MORPHO.dangerBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : '0 1px 0 rgba(21,24,26,0.04)',
      borderRadius: 12,
      padding: '14px 18px',
      position: 'relative', fontFamily: FONTS.body,
      transition: 'border-color 300ms, box-shadow 300ms',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.14em',
        color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 6,
      }}>
        <span>{kindLabel}</span>
        {userLoss ? (
          <span style={{ color: MORPHO.danger, fontFamily: FONTS.mono }}>{userLoss}</span>
        ) : tvl ? (
          <span style={{ color: colorMap.text, fontFamily: FONTS.mono }}>{tvl}</span>
        ) : null}
      </div>
      <div style={{
        fontSize: 16, fontWeight: 500, color: colorMap.text,
        letterSpacing: '-0.01em', marginBottom: 14,
      }}>{name}</div>
      <div style={{
        height: 3, background: MORPHO.border, borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, liquidity * 100))}%`,
          background: colorMap.accent,
          transition: 'width 400ms cubic-bezier(.2,.8,.2,1)',
        }} />
      </div>
      {lockLabel && (
        <div style={{
          position: 'absolute', bottom: -22, left: 0, right: 0,
          fontFamily: FONTS.mono, fontSize: 10,
          color: MORPHO.textFaint, letterSpacing: '0.08em',
          textTransform: 'uppercase', textAlign: 'center',
        }}>{lockLabel}</div>
      )}
      {badge && !lockLabel && (
        <div style={{
          position: 'absolute', bottom: -22, left: 0, right: 0,
          textAlign: 'center',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px',
            fontFamily: FONTS.mono, fontSize: 9,
            color: badge.color, letterSpacing: '0.10em',
            textTransform: 'uppercase',
            border: `1px solid ${badge.color}`,
            borderRadius: 999,
            background: MORPHO.card,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 5, background: badge.color }} />
            {badge.label}
          </span>
        </div>
      )}
    </div>
  );
}

function MarketCardBig({ symbol, state = 'healthy', utilization = 0.4, width = 170, utilLabel = null, kindLabel = 'Market', dotColor = null, subtitle = '/ USDC' }) {
  const dot = dotColor || MORPHO.tok[symbol] || MORPHO.textFaint;
  const colorMap = {
    healthy:  { bg: MORPHO.card, bd: MORPHO.border,  accent: MORPHO.brand   },
    impacted: { bg: MORPHO.card, bd: MORPHO.danger,  accent: MORPHO.danger  },
    drained:  { bg: MORPHO.card, bd: MORPHO.warning, accent: MORPHO.warning },
    hot:      { bg: MORPHO.card, bd: MORPHO.purple,  accent: MORPHO.purple  },
  }[state];
  return (
    <div style={{
      width, height: 116,
      background: colorMap.bg,
      border: `1px solid ${colorMap.bd}`,
      boxShadow: state === 'impacted'
        ? `0 0 0 4px ${MORPHO.dangerBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : state === 'drained'
        ? `0 0 0 4px ${MORPHO.warningBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : state === 'hot'
        ? `0 0 0 4px ${MORPHO.purpleBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : '0 1px 0 rgba(21,24,26,0.04)',
      borderRadius: 12,
      padding: '14px 18px',
      position: 'relative', fontFamily: FONTS.body,
      transition: 'border-color 300ms, box-shadow 300ms',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.14em',
        color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 8,
      }}>
        <span>{kindLabel}</span>
        {utilLabel && <span style={{ color: colorMap.accent, fontFamily: FONTS.mono, fontSize: 11 }}>{utilLabel}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 16, height: 16, borderRadius: 16, background: dot,
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)', flexShrink: 0,
        }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: MORPHO.text, letterSpacing: '-0.01em' }}>{symbol}</span>
      </div>
      {subtitle && (
        <div style={{
          fontFamily: FONTS.mono, fontSize: 10, color: MORPHO.textFaint,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>{subtitle}</div>
      )}
      <div style={{
        position: 'absolute', left: 18, right: 18, bottom: 14, height: 3,
        background: MORPHO.border, borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.min(100, utilization * 100)}%`,
          background: colorMap.accent,
          transition: 'width 400ms cubic-bezier(.2,.8,.2,1), background 300ms',
        }} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   LenderChip — small card representing an end-user/lender sitting on
   top of a vault. Used in LiquidityView so the withdraw/deposit flows
   have a literal source/sink above the vaults.
   ────────────────────────────────────────────────────────────────── */
function LenderChip({ label = 'Lender', amount = '$50M', state = 'healthy', width = 180, badge = null, kind = 'Lender' }) {
  const colorMap = {
    healthy: { bd: MORPHO.border,     accent: MORPHO.brand,  text: MORPHO.text },
    outflow: { bd: MORPHO.danger,     accent: MORPHO.danger, text: MORPHO.text },
    inflow:  { bd: MORPHO.purple,     accent: MORPHO.purple, text: MORPHO.text },
  }[state] || { bd: MORPHO.border, accent: MORPHO.brand, text: MORPHO.text };

  return (
    <div style={{
      width, height: 48,
      background: MORPHO.card,
      border: `1px solid ${colorMap.bd}`,
      borderRadius: 10,
      padding: '12px 14px',
      position: 'relative', fontFamily: FONTS.body,
      display: 'flex', alignItems: 'center',
      boxShadow: state === 'outflow'
        ? `0 0 0 3px ${MORPHO.dangerBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : state === 'inflow'
          ? `0 0 0 3px ${MORPHO.purpleBg}, 0 1px 0 rgba(21,24,26,0.04)`
          : '0 1px 0 rgba(21,24,26,0.04)',
      transition: 'border-color 300ms, box-shadow 300ms',
    }}>
      {/* Kind label + amount — hidden; chip shows just avatars + label */}
      {/* Avatar cluster + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: 18,
              marginLeft: i === 0 ? 0 : -6,
              background: [MORPHO.brand, MORPHO.purple, MORPHO.textFaint][i],
              border: `1.5px solid ${MORPHO.card}`,
              flexShrink: 0,
            }} />
          ))}
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: colorMap.text, letterSpacing: '-0.01em' }}>
          {label}
        </span>
      </div>
      {/* State badge (floats below card) */}
      {badge && (
        <div style={{
          position: 'absolute', left: '50%', bottom: -10,
          transform: 'translate(-50%, 100%)',
          fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: '0.10em',
          color: colorMap.accent, textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>{badge}</div>
      )}
    </div>
  );
}

Object.assign(window, { Module2, VaultCardBig, MarketCardBig, LenderChip, M2, utilAt, irmRate2 });
