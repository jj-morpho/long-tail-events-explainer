// module1.jsx — Bad Debt Isolation
// A vault's market experiences a bad debt event; losses stay isolated to vaults
// exposed to that market. Other vaults keep running.

// Layout constants for a 1600×900 module canvas
const M1 = {
  W: 1600, H: 900,
  vaultRowY: 240,
  marketRowY: 600,
  vaultW: 178,
  marketW: 148,
};

// Static data — mirrors the reference frame vocabulary
const M1_VAULTS = [
  { name: 'USDC Vault A', segs: [{color:'#F2A13B', weight:3},{color:'#1C64EA', weight:5}] },
  { name: 'USDC Vault B', segs: [{color:'#F2A13B', weight:2},{color:'#8A38F5', weight:3},{color:'#95A1B8', weight:2}] },
  { name: 'USDC Vault C', segs: [{color:'#19A06A', weight:3},{color:'#1C64EA', weight:5}] },
];

const M1_MARKETS = [
  { sym: 'rsETH' },   // higher risk — the one that will have the bad debt event
  { sym: 'sUSDe' },   // higher risk
  { sym: 'wstETH' },  // bluechip
  { sym: 'cbBTC' },   // bluechip
];

// Which vaults are exposed to rsETH (the impacted market)
const M1_EXPOSED = new Set([1]); // Vault B is the only exposed one
const M1_IMPACTED_MKT = 0;        // rsETH

// Allocation graph — which vault touches which markets.
// Markets: [rsETH=0, sUSDe=1, wstETH=2, cbBTC=3]
const M1_EDGES = [
  [1, 2, 3],        // Vault A → sUSDe, wstETH, cbBTC              (safe)
  [0, 1, 2],        // Vault B → rsETH, sUSDe, wstETH              (EXPOSED — the only one)
  [2, 3],           // Vault C → wstETH, cbBTC                     (safe, bluechip only)
];

// Pre-compute x positions centered in the canvas
function m1Positions() {
  const vaultGap = 28;
  const vaultsTotalW = M1_VAULTS.length * M1.vaultW + (M1_VAULTS.length - 1) * vaultGap;
  const vaultStartX = (M1.W - vaultsTotalW) / 2;
  const vaultX = (i) => vaultStartX + i * (M1.vaultW + vaultGap);
  const vaultCX = (i) => vaultX(i) + M1.vaultW/2;

  const marketGap = 36;
  const marketsTotalW = M1_MARKETS.length * M1.marketW + (M1_MARKETS.length - 1) * marketGap;
  const marketStartX = (M1.W - marketsTotalW) / 2;
  const marketX = (i) => marketStartX + i * (M1.marketW + marketGap);
  const marketCX = (i) => marketX(i) + M1.marketW/2;

  return { vaultX, vaultCX, marketX, marketCX };
}

function Module1() {
  const { time } = useTimeline();
  const T = time;
  const P = m1Positions();

  // Beat timings (within module-local time 0..20)
  const B = {
    title:   [0.3, 2.8],
    intro:   [2.8, 5.5],   // vaults + markets fade in, curves draw
    event:   [6.2, 9.0],   // rsETH bad debt event pulse
    travel:  [8.8, 12.0],  // red travels up connecting curves
    label:   [11.5, 14.5], // losses label
    isolate: [13.5, 17.5], // others stay green
    outro:   [17.5, 20.0], // settle
  };

  // Eases
  const introT = Easing.easeOutCubic(window01(T, B.intro[0], B.intro[1]));
  const eventPulse = (() => {
    if (T < B.event[0]) return 0;
    const u = window01(T, B.event[0], B.event[0]+0.6);
    const decay = Math.exp(-(T - B.event[0]) * 1.2);
    return Easing.easeOutBack(u) * decay;
  })();
  const travelT  = Easing.easeInOutCubic(window01(T, B.travel[0], B.travel[1]));
  const isolateT = Easing.easeOutCubic(window01(T, B.isolate[0], B.isolate[1]));

  // Slight ambient breathing on healthy vault cards
  const breathe = 1 + Math.sin(T * 0.8) * 0.003;

  // Build list of all (vault, market) edges
  const edges = [];
  M1_EDGES.forEach((mkts, vi) => mkts.forEach((mi) => edges.push({vi, mi})));

  return (
    <>
      {/* Header block */}
      <Sprite start={B.title[0]} end={20} keepMounted>
        {({ localTime }) => {
          const fade = Easing.easeOutCubic(clamp(localTime / 0.8, 0, 1));
          return (
            <div style={{
              position:'absolute', left: M1.W/2, top: 72,
              transform: `translateX(-50%) translateY(${(1-fade)*-8}px)`,
              opacity: fade,
              textAlign:'center', fontFamily: FONTS.display,
            }}>
              <div style={{
                fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.18em',
                color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 10,
              }}></div>
              <div style={{
                fontFamily: FONTS.display, fontWeight: 400, fontSize: 42,
                letterSpacing: '-0.02em', color: MORPHO.text, lineHeight: 1.1,
              }}>Credit risk is isolated to a given market.</div>
            </div>
          );
        }}
      </Sprite>

      {/* Section labels */}
      <div style={{
        position:'absolute', left: 96, top: M1.vaultRowY + 14,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.16em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
        opacity: Easing.easeOutCubic(window01(T, 2.6, 3.6)),
      }}>Vaults</div>
      <div style={{
        position:'absolute', left: 96, top: M1.marketRowY + 14,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.16em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
        opacity: Easing.easeOutCubic(window01(T, 3.2, 4.2)),
      }}>Markets</div>

      {/* SVG connector layer */}
      <svg width={M1.W} height={M1.H} style={{position:'absolute', inset:0, pointerEvents:'none'}}>
        {edges.map(({vi, mi}, idx) => {
          const x1 = P.vaultCX(vi);
          const y1 = M1.vaultRowY + 74; // bottom of vault card
          const x2 = P.marketCX(mi);
          const y2 = M1.marketRowY;     // top of market card
          const d  = curvePath(x1, y1, x2, y2);

          // Stagger drawing in during intro
          const delay = (idx * 0.03) % 0.5;
          const draw  = Easing.easeOutCubic(window01(T, B.intro[0] + 0.6 + delay, B.intro[0] + 1.4 + delay));

          // Is this edge connected to the impacted market?
          const isImpactEdge  = (mi === M1_IMPACTED_MKT);
          const isExposed     = isImpactEdge && M1_EXPOSED.has(vi);
          const isSafeEdge    = !isImpactEdge;

          // Red-travel opacity for the specific exposed edges during travel beat
          const travelLocal = isExposed
            ? Easing.easeInOutCubic(window01(T, B.travel[0], B.travel[1]))
            : 0;

          // During isolate beat, safe edges tint green softly
          const safeTint = isSafeEdge
            ? Easing.easeOutCubic(window01(T, B.isolate[0], B.isolate[1]))
            : 0;

          // Base grey stroke
          const baseColor = mixHex(
            mixHex(MORPHO.borderStrong, MORPHO.success, safeTint * 0.8),
            MORPHO.danger,
            isImpactEdge ? (isExposed ? travelLocal : 0.15 * Easing.easeOutCubic(window01(T, B.event[0], B.event[1]))) : 0,
          );
          const strokeW = 1 + (isExposed ? travelLocal * 1.2 : 0);
          const opacity = 0.55 + 0.25 * draw + (isExposed ? travelLocal * 0.3 : 0) + (isSafeEdge ? safeTint * 0.15 : 0);

          return (
            <g key={idx}>
              <path d={d} fill="none"
                stroke={baseColor}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={draw * opacity}
                style={{transition:'none'}}
              />
              {/* Red travelling glow along exposed edges */}
              {isExposed && travelLocal > 0.02 && (
                <path d={d} fill="none"
                  stroke={MORPHO.danger}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.35 * travelLocal}
                  filter="url(#m1-soft)"
                />
              )}
            </g>
          );
        })}
        <defs>
          <filter id="m1-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5"/>
          </filter>
          <radialGradient id="m1-pulse" cx="50%" cy="50%">
            <stop offset="0%"  stopColor={MORPHO.danger} stopOpacity="0.55"/>
            <stop offset="60%" stopColor={MORPHO.danger} stopOpacity="0.10"/>
            <stop offset="100%" stopColor={MORPHO.danger} stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Event pulse emanating from impacted market */}
        {eventPulse > 0.01 && (() => {
          const cx = P.marketCX(M1_IMPACTED_MKT);
          const cy = M1.marketRowY + 46;
          const r  = 24 + eventPulse * 140;
          return (
            <circle cx={cx} cy={cy} r={r} fill="url(#m1-pulse)" opacity={eventPulse}/>
          );
        })()}
      </svg>

      {/* Vaults row */}
      {M1_VAULTS.map((v, vi) => {
        const appear = Easing.easeOutCubic(window01(T, B.intro[0] + vi * 0.06, B.intro[0] + 0.8 + vi * 0.06));
        const exposed = M1_EXPOSED.has(vi);
        // Determine state by time
        let state = 'healthy';
        let userLoss = null;
        let note = null;
        if (exposed && T > B.travel[0] + 0.6) {
          state = 'impacted';
          const lossProg = Easing.easeOutCubic(window01(T, B.travel[0] + 0.8, B.travel[1]));
          if (lossProg > 0.02) userLoss = 'users exposed';
        } else if (!exposed && T > B.isolate[0]) {
          note = 'INTACT';
        }
        return (
          <div key={vi} style={{
            position:'absolute',
            left: P.vaultX(vi),
            top: M1.vaultRowY,
            opacity: appear,
            transform: `translateY(${(1-appear)*-10}px) scale(${state === 'healthy' ? breathe : 1})`,
          }}>
            <VaultCard name={v.name} segments={v.segs} state={state} userLoss={userLoss} note={note} width={M1.vaultW}/>
          </div>
        );
      })}

      {/* Markets row */}
      {M1_MARKETS.map((m, mi) => {
        const appear = Easing.easeOutCubic(window01(T, B.intro[0] + 0.3 + mi * 0.06, B.intro[0] + 1.0 + mi * 0.06));
        let state = 'healthy';
        let util = 0.35 + 0.08 * Math.sin(mi + T * 0.4);
        if (mi === M1_IMPACTED_MKT && T > B.event[0]) state = 'impacted';
        return (
          <div key={mi} style={{
            position:'absolute',
            left: P.marketX(mi),
            top: M1.marketRowY,
            opacity: appear,
            transform: `translateY(${(1-appear)*10}px)`,
          }}>
            <MarketCard symbol={m.sym} state={state} utilization={util}/>
          </div>
        );
      })}

      {/* Credit-event call-out chip near impacted market */}
      <Sprite start={B.event[0]+0.15} end={B.isolate[1]} keepMounted>
        {({localTime}) => {
          const fade = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));
          const cx = P.marketCX(M1_IMPACTED_MKT);
          return (
            <div style={{
              position:'absolute', left: cx, top: M1.marketRowY + 110,
              transform: `translate(-50%, ${(1-fade)*8}px)`,
              opacity: fade,
              display:'inline-flex', alignItems:'center', gap:8,
              padding: '6px 10px',
              background: MORPHO.dangerBg,
              border: `1px solid ${MORPHO.danger}`,
              borderRadius: 999,
              fontFamily: FONTS.mono, fontSize: 11, letterSpacing:'0.08em',
              color: MORPHO.danger, textTransform:'uppercase',
              whiteSpace:'nowrap',
            }}>
              <span style={{
                width:6, height:6, borderRadius:6, background: MORPHO.danger,
                boxShadow: `0 0 0 0 ${MORPHO.danger}`,
                animation: 'm1-dot-pulse 1.4s ease-out infinite',
              }}/>
              Potential bad debt
            </div>
          );
        }}
      </Sprite>

      {/* Bottom caption for isolate beat */}
      <Sprite start={B.label[0]} end={20} keepMounted>
        {({localTime, duration}) => {
          const fade = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));
          const out  = Easing.easeInCubic(clamp((localTime - (duration - 0.4))/0.4, 0, 1));
          return (
            <div style={{
              position:'absolute', left: M1.W/2, bottom: 30,
              transform: `translateX(-50%) translateY(${(1-fade)*12 + out*-6}px)`,
              opacity: fade * (1-out),
              textAlign:'center', fontFamily: FONTS.body,
              color: MORPHO.textMuted, fontSize: 17, letterSpacing:'-0.005em',
              maxWidth: 900, textWrap: 'balance',
            }}>
              <span style={{color: MORPHO.text}}></span>
            </div>
          );
        }}
      </Sprite>

      <style>{`
        @keyframes m1-dot-pulse {
          0%   { box-shadow: 0 0 0 0 ${MORPHO.danger}; opacity: 1; }
          70%  { box-shadow: 0 0 0 8px rgba(255,119,146,0); opacity: 0.85; }
          100% { box-shadow: 0 0 0 0 rgba(255,119,146,0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

Object.assign(window, { Module1, M1 });
