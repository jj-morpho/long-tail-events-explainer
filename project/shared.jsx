// shared.jsx
// Shared tokens, vault/market card primitives, curve helpers.
// Morpho-aligned light aesthetic with brand blue, pink credit, purple opportunity.

const MORPHO = {
  // base
  bg:        '#EFF2FA',        // soft blue-grey canvas (matches reference)
  bgSoft:    '#F6F8FC',
  card:      '#FFFFFF',
  cardMuted: '#F0F2F7',
  border:    '#E3E7F0',
  borderStrong: '#CCD3E0',
  text:      '#15181A',        // near-black
  textMuted: '#5B677E',
  textFaint: '#95A1B8',
  // brand
  brand:     '#5792FF',        // primary blue (rgb 87,146,255)
  brandDeep: '#1C64EA',        // 28,100,234
  brandSoft: '#C4DAFF',        // 196,218,255
  brandBg:   '#DEE8FC',        // 222,232,252
  // states
  danger:    '#FF7792',        // pink — credit event (255,119,146)
  dangerBg:  '#FFE3EA',
  success:   '#19A06A',
  successBg: '#DDF5EA',
  warning:   '#F2A13B',
  warningBg: '#FDEBCE',
  // opportunity
  purple:    '#8A38F5',        // 138,56,245
  purpleBg:  '#EEDCFE',
  // token colors (for dot in market chip)
  tok: {
    WBTC:   '#F7931A',
    ETH:    '#627EEA',
    USDC:   '#2775CA',
    USDe:   '#1F8E4A',
    sUSDe:  '#28B67A',
    wstETH: '#2EB4E8',
    rsETH:  '#B088F0',
    wETH:   '#8C95AC',
    eUSD:   '#1C64EA',
    cbBTC:  '#0052FF',
  },
};

const FONTS = {
  display: '"FK Grotesk", "Neue Haas Grotesk", "Inter", system-ui, sans-serif',
  body:    '"FK Grotesk", "Inter", system-ui, sans-serif',
  mono:    '"FK Grotesk SemiMono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
};

// ── Small helpers ───────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t < 0 ? 0 : t > 1 ? 1 : t*t*(3-2*t); }

// Ease-out on [a,b] window with clamp
function window01(t, a, b) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}

// Mixes two hex colors (approx, sRGB)
function mixHex(h1, h2, t) {
  const p = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(h1), [r2,g2,b2] = p(h2);
  const r = Math.round(lerp(r1,r2,t)), g = Math.round(lerp(g1,g2,t)), b = Math.round(lerp(b1,b2,t));
  const toHex = (n)=>n.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Ring tick for vaults: draws a small segmented allocation bar
function AllocBar({ segments, width = 116, height = 4, radius = 2, opacity = 1 }) {
  // segments: [{color, weight}]
  const total = segments.reduce((a,s)=>a+s.weight,0) || 1;
  let acc = 0;
  return (
    <svg width={width} height={height} style={{display:'block', opacity}}>
      {segments.map((s,i)=>{
        const x = (acc/total)*width;
        const w = (s.weight/total)*width;
        acc += s.weight;
        return <rect key={i} x={x} y={0} width={w} height={height} rx={radius} ry={radius} fill={s.color} />;
      })}
    </svg>
  );
}

// ── Vault card ──────────────────────────────────────────────────────────
function VaultCard({
  name,
  segments = [],     // allocation bar
  width = 168,
  state = 'healthy', // 'healthy' | 'impacted' | 'locked' | 'dimmed'
  userLoss = null,   // string like '-30.0%' when impacted
  note = null,       // extra right-side tag e.g. 'INTACT'
  style = {},
}) {
  const colorMap = {
    healthy:  { bg: MORPHO.card,      bd: MORPHO.border,       text: MORPHO.text,      ring: 'transparent' },
    impacted: { bg: MORPHO.card,      bd: MORPHO.danger,       text: MORPHO.text,      ring: MORPHO.danger },
    locked:   { bg: '#F2F4F9',        bd: MORPHO.borderStrong, text: MORPHO.textMuted, ring: 'transparent' },
    dimmed:   { bg: MORPHO.cardMuted, bd: MORPHO.border,       text: MORPHO.textFaint, ring: 'transparent' },
  }[state];

  return (
    <div style={{
      width, height: 74,
      background: colorMap.bg,
      border: `1px solid ${colorMap.bd}`,
      boxShadow: state === 'impacted'
        ? `0 0 0 4px ${MORPHO.dangerBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : '0 1px 0 rgba(21,24,26,0.04)',
      borderRadius: 10,
      padding: '12px 14px',
      position: 'relative',
      fontFamily: FONTS.body,
      transition: 'border-color 300ms, box-shadow 300ms, background 300ms',
      ...style,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.12em',
        color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 4,
      }}>
        <span>Vault</span>
        {userLoss ? (
          <span style={{color: MORPHO.danger, fontFamily: FONTS.mono}}>
            {userLoss}
          </span>
        ) : note ? (
          <span style={{display:'inline-flex', alignItems:'center', gap: 4, color: MORPHO.success}}>
            <span style={{width:5,height:5,borderRadius:5,background:MORPHO.success,display:'inline-block'}}/>
            {note}
          </span>
        ) : null}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 500, color: colorMap.text,
        letterSpacing: '-0.01em', marginBottom: 10,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {name}
      </div>
      {segments.length > 0 && (
        <AllocBar segments={segments} width={width - 28} opacity={state === 'dimmed' ? 0.35 : 1}/>
      )}
    </div>
  );
}

// ── Market card ─────────────────────────────────────────────────────────
function MarketCard({
  symbol,
  loan = 'USDC',
  width = 140,
  state = 'healthy', // healthy | impacted | drained | hot
  utilization = null, // 0..1 draws a thin bar
  rate = null,        // string like '3.4%' or '10.2%'
  style = {},
}) {
  const dot = MORPHO.tok[symbol] || MORPHO.textFaint;
  const colorMap = {
    healthy:  { bg: MORPHO.card, bd: MORPHO.border,       ring: 'transparent', accent: MORPHO.brand    },
    impacted: { bg: MORPHO.card, bd: MORPHO.danger,       ring: MORPHO.danger, accent: MORPHO.danger   },
    drained:  { bg: MORPHO.card, bd: MORPHO.warning,      ring: 'transparent', accent: MORPHO.warning  },
    hot:      { bg: MORPHO.card, bd: MORPHO.purple,       ring: MORPHO.purple, accent: MORPHO.purple   },
  }[state];

  return (
    <div style={{
      width, height: 92,
      background: colorMap.bg,
      border: `1px solid ${colorMap.bd}`,
      boxShadow: state === 'impacted'
        ? `0 0 0 4px ${MORPHO.dangerBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : state === 'hot'
        ? `0 0 0 4px ${MORPHO.purpleBg}, 0 1px 0 rgba(21,24,26,0.04)`
        : '0 1px 0 rgba(21,24,26,0.04)',
      borderRadius: 10,
      padding: '12px 14px',
      position: 'relative',
      fontFamily: FONTS.body,
      transition: 'border-color 250ms, box-shadow 250ms',
      ...style,
    }}>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.12em',
        color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 6,
      }}>
        Market
      </div>
      <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 4}}>
        <span style={{
          width: 14, height: 14, borderRadius: 14, background: dot,
          flexShrink: 0,
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)',
        }}/>
        <span style={{fontSize:14, fontWeight:500, color: MORPHO.text, letterSpacing:'-0.01em'}}>{symbol}</span>
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 10, color: MORPHO.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
      }}>
        / {loan}
      </div>
      <div style={{
        position:'absolute', left: 14, right: 14, bottom: 12, height: 2,
        background: MORPHO.border, borderRadius: 2, overflow:'hidden',
      }}>
        {utilization != null && (
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, utilization*100))}%`,
            background: colorMap.accent,
            transition: 'width 400ms cubic-bezier(.2,.8,.2,1), background 250ms',
          }}/>
        )}
      </div>
      {rate && (
        <div style={{
          position: 'absolute', top: 12, right: 14,
          fontFamily: FONTS.mono, fontSize: 11,
          color: state === 'hot' ? MORPHO.purple : MORPHO.textMuted,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {rate}
        </div>
      )}
    </div>
  );
}

// ── Curved connector (SVG path) ─────────────────────────────────────────
// Draws a smooth cubic from (x1,y1) down to (x2,y2) with a droop controlled by sag.
function curvePath(x1, y1, x2, y2, sag = 0.5) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const droop = 40 + Math.abs(dx) * 0.08;
  // cubic through control points above the midpoint for gentle bow
  const c1x = x1 + dx * 0.2;
  const c1y = y1 + (y2 - y1) * 0.55 * sag;
  const c2x = x1 + dx * 0.8;
  const c2y = y1 + (y2 - y1) * (1 - 0.45 * sag);
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

// Reveal a path with stroke-dashoffset, given progress 0..1 and a length
function PathReveal({ d, progress = 1, length = 400, stroke = '#95A1B8', width = 1, opacity = 1, dash = null }) {
  const off = length * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <path d={d} fill="none"
      stroke={stroke} strokeWidth={width} strokeLinecap="round"
      opacity={opacity}
      strokeDasharray={dash || length}
      strokeDashoffset={dash ? 0 : off}
    />
  );
}

// ── Small caption/eyebrow block ─────────────────────────────────────────
function Caption({ eyebrow, title, sub, x, y, width = 720, align = 'center' }) {
  const textAlign = align;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width, textAlign,
      transform: align === 'center' ? 'translateX(-50%)' : 'none',
      fontFamily: FONTS.body, color: MORPHO.text,
    }}>
      {eyebrow && (
        <div style={{
          fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.14em',
          color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 10,
        }}>{eyebrow}</div>
      )}
      {title && (
        <div style={{
          fontFamily: FONTS.display, fontWeight: 400, fontSize: 34,
          letterSpacing: '-0.02em', lineHeight: 1.15, color: MORPHO.text,
          marginBottom: 6,
        }}>{title}</div>
      )}
      {sub && (
        <div style={{
          fontSize: 15, color: MORPHO.textMuted, letterSpacing: '-0.005em',
          lineHeight: 1.4, maxWidth: width, margin: '0 auto',
        }}>{sub}</div>
      )}
    </div>
  );
}

// ── Morpho wordmark (small, muted) ──────────────────────────────────────
function MorphoMark({ x, y }) {
  return (
    <div style={{
      position:'absolute', left:x, top:y, transform:'translateX(-50%)',
      display:'inline-flex', alignItems:'center', gap: 6,
      fontFamily: FONTS.mono, fontSize: 11, color: MORPHO.textFaint,
      letterSpacing: '0.16em', textTransform: 'uppercase',
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke={MORPHO.brand} strokeWidth="1.2"/><circle cx="5" cy="5" r="1.4" fill={MORPHO.brand}/></svg>
      Morpho
    </div>
  );
}

Object.assign(window, {
  MORPHO, FONTS,
  lerp, smooth, window01, mixHex,
  AllocBar, VaultCard, MarketCard,
  curvePath, PathReveal, Caption, MorphoMark,
});
