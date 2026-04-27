// module0.jsx — Morpho Vault, simplified intro (≈20s)
//
// Single entry point into the USDC Vault:
//   • Lenders → Vault                       (direct depositors)
// The vault allocates across three markets, borrowers post collateral & draw USDC,
// interest flows back up.

const M0 = {
  W: 1600, H: 900,
  userRowY:        220,
  vaultRowY:       390,
  marketRowY:      580,
  borrowerRowY:    780,
  vaultW: 260,
  marketW: 190,
  // entry groups
  groupW: 220,
  borrowerGroupW: 260,
};

// Beat windows (module-local time)
const B0 = {
  title:     [0.3, 3.0],
  appear:    [1.5, 4.0],
  // Step 1 — Lenders → Vault
  deposit:   [4.0, 12.0],
  // Step 2 — Vault → Markets
  alloc:     [12.0, 18.0],
  // Step 3 — Borrowers draw
  borrow:    [15.0, 21.0],
  // Step 4 — Interest flows back
  yield:     [20.0, 27.0],
  steady:    [26.0, 30.0],
};

function m0Positions() {
  const vaultX  = (M0.W - M0.vaultW) / 2;
  const vaultCX = vaultX + M0.vaultW / 2;

  // Single Lenders entry, centered directly above the vault
  const lendersCX   = vaultCX;
  const lendersX    = lendersCX - M0.groupW / 2;

  // Markets — 3, centered
  const marketGap = 130;
  const marketTotalW = 3 * M0.marketW + 2 * marketGap;
  const marketStartX = (M0.W - marketTotalW) / 2;
  const marketX  = (i) => marketStartX + i * (M0.marketW + marketGap);
  const marketCX = (i) => marketX(i) + M0.marketW / 2;

  // Single Borrowers group centered at bottom
  const borrowersCX = M0.W / 2;
  const borrowersX  = borrowersCX - M0.borrowerGroupW / 2;

  return {
    vaultX, vaultCX,
    lendersX, lendersCX,
    marketX, marketCX,
    borrowersX, borrowersCX,
  };
}

/* ──────────────────────────────────────────────────────────────
   GroupChip — stacked avatar motif representing a population
   (users, lenders, borrowers).
   ────────────────────────────────────────────────────────────── */
function GroupChip({ label, count = 5, width = 200, accent = MORPHO.textMuted, state = 'healthy', sublabel }) {
  const active = state === 'active';
  return (
    <div style={{
      width, padding: '16px 18px',
      background: MORPHO.card,
      border: `1px solid ${active ? accent : MORPHO.border}`,
      boxShadow: active
        ? `0 0 0 3px ${hexA(accent, 0.12)}, 0 1px 0 rgba(21,24,26,0.03)`
        : '0 1px 0 rgba(21,24,26,0.03)',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: FONTS.body,
      transition: 'border-color 300ms, box-shadow 300ms',
    }}>
      {/* stacked avatars */}
      <div style={{
        position: 'relative', flex: 'none',
        width: 46, height: 28,
      }}>
        {Array.from({ length: count }).map((_, i) => {
          const z = count - i;
          const left = i * 9;
          return (
            <span key={i} style={{
              position: 'absolute', left, top: 0,
              width: 28, height: 28, borderRadius: 14,
              background: '#F3F4F8',
              border: `1.5px solid ${MORPHO.card}`,
              boxShadow: '0 0 0 1px rgba(21,24,26,0.04)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              zIndex: z,
            }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7.2" r="3.4" stroke={MORPHO.textMuted} strokeWidth="1.5" />
                <path d="M4 17c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5"
                      stroke={MORPHO.textMuted} strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize: 15, color: MORPHO.text, fontWeight: 500,
          letterSpacing: '-0.005em', lineHeight: 1.1,
        }}>{label}</span>
        {sublabel && (
          <span style={{
            fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.08em',
            color: MORPHO.textFaint, textTransform: 'uppercase', lineHeight: 1.1,
          }}>{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// small helper: hex to rgba with alpha (supports #rrggbb)
function hexA(hex, a) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ──────────────────────────────────────────────────────────────
   Module 0 root
   ────────────────────────────────────────────────────────────── */
function Module0() {
  const { time: T } = useTimeline();
  const P = m0Positions();

  const appearT  = Easing.easeOutCubic(window01(T, B0.appear[0],  B0.appear[1]));
  const depositT = Easing.easeInOutCubic(window01(T, B0.deposit[0], B0.deposit[1]));
  const allocT   = Easing.easeInOutCubic(window01(T, B0.alloc[0],   B0.alloc[1]));
  const borrowT  = Easing.easeInOutCubic(window01(T, B0.borrow[0],  B0.borrow[1]));
  const yieldT   = Easing.easeInOutCubic(window01(T, B0.yield[0],   B0.yield[1]));
  const steadyT  = Easing.easeInOutCubic(window01(T, B0.steady[0],  B0.steady[1]));

  // Current caption (4 clear phases)
  let captionEm = 'Markets generate yield via interests.';
  let captionRest = '';
  if      (T < 3.5)  { captionEm = 'How lending works on Morpho.'; captionRest = ''; }
  else if (T < 12)   { captionEm = 'Lenders deposit into the USDC vault.'; captionRest = ' The curated vault aggregates supply from depositors.'; }
  else if (T < 18)   { captionEm = 'Vaults allocate to markets.';            captionRest = ''; }
  else               { captionEm = 'Vaults generate yield via interest paid'; captionRest = ''; }

  // Helper: curved connector d-string
  const curve = (x1, y1, x2, y2) => {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  };

  // Card heights (for connector endpoints)
  const groupH = 60;          // approx GroupChip height
  const vaultH = 108;         // VaultCardBig footprint
  const marketH = 100;        // MarketCardBig footprint

  return (
    <>
      {/* Title */}
      <div style={{
        position: 'absolute', left: M0.W / 2, top: 72,
        transform: 'translateX(-50%)',
        textAlign: 'center', fontFamily: FONTS.display,
      }}>
        <div style={{
          fontFamily: FONTS.display, fontWeight: 400, fontSize: 38,
          letterSpacing: '-0.02em', color: MORPHO.text, lineHeight: 1.1,
          width: 800, margin: '0 auto',
        }}>{captionEm}</div>
      </div>

      {/* Caption subrow */}
      <div style={{
        position: 'absolute', left: M0.W / 2, top: M0.H - 44,
        transform: 'translateX(-50%)',
        fontFamily: FONTS.body, fontSize: 14,
        color: MORPHO.textMuted, textAlign: 'center',
        maxWidth: 760,
      }}>{captionRest}</div>

      {/* ═══════════════  SVG layer: connectors + particles  ═══════════════ */}
      <svg width={M0.W} height={M0.H}
           style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>

        {/* ── Lenders → Vault (single, centered) ──────────────── */}
        {(() => {
          const d = curve(P.lendersCX, M0.userRowY + groupH, P.vaultCX, M0.vaultRowY);
          const active = depositT > 0.05;
          const stroke = active ? MORPHO.brand : MORPHO.borderStrong;
          const op = (0.28 + depositT * 0.5 + steadyT * 0.2) * appearT;
          return (
            <>
              <path d={d} fill="none"
                    stroke={stroke} strokeWidth={1 + depositT * 0.8}
                    strokeLinecap="round" opacity={op}
                    style={{ transition: 'stroke 400ms' }} />
              {depositT > 0.05 && (
                <g opacity={depositT * (1 - allocT * 0.3)}>
                  {[0, 1, 2].map(k => (
                    <circle key={k} r={3.4} fill={MORPHO.brand} opacity={0.9}>
                      <animateMotion dur="2s" repeatCount="indefinite" path={d}
                        keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                        begin={`-${(k * 0.66) % 2}s`} />
                    </circle>
                  ))}
                </g>
              )}
            </>
          );
        })()}

        {/* ── Vault → Markets ─────────────────────────────────── */}
        {[0, 1, 2].map(mi => {
          const d = curve(P.vaultCX, M0.vaultRowY + vaultH, P.marketCX(mi), M0.marketRowY);
          const active = allocT > 0.05;
          const stroke = active ? MORPHO.brand : MORPHO.borderStrong;
          const op = (0.25 + allocT * 0.55 + steadyT * 0.2) * appearT;
          return (
            <g key={`vm-${mi}`}>
              <path d={d} fill="none"
                    stroke={stroke} strokeWidth={1 + allocT * 0.8}
                    strokeLinecap="round" opacity={op}
                    style={{ transition: 'stroke 400ms' }} />
              {allocT > 0.05 && (
                <g opacity={allocT * (1 - borrowT * 0.35)}>
                  {[0, 1].map(k => (
                    <circle key={k} r={3} fill={MORPHO.brand} opacity={0.85}>
                      <animateMotion dur="1.6s" repeatCount="indefinite" path={d}
                        keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                        begin={`-${(mi * 0.25 + k * 0.8) % 1.6}s`} />
                    </circle>
                  ))}
                </g>
              )}
            </g>
          );
        })}

        {/* ── Markets → Borrowers (single group) ──────────────── */}
        {[0, 1, 2].map(mi => {
          const d = curve(P.marketCX(mi), M0.marketRowY + marketH, P.borrowersCX, M0.borrowerRowY);
          const active = borrowT > 0.05;
          const stroke = active ? MORPHO.purple : MORPHO.borderStrong;
          const op = (0.25 + borrowT * 0.55 + steadyT * 0.2) * appearT;
          return (
            <g key={`mb-${mi}`}>
              <path d={d} fill="none"
                    stroke={stroke} strokeWidth={1 + borrowT * 0.6}
                    strokeLinecap="round" opacity={op}
                    style={{ transition: 'stroke 400ms' }} />
              {borrowT > 0.05 && (
                <g opacity={borrowT * (1 - yieldT * 0.4)}>
                  {[0, 1].map(k => (
                    <circle key={k} r={3} fill={MORPHO.purple} opacity={0.85}>
                      <animateMotion dur="1.5s" repeatCount="indefinite" path={d}
                        keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                        begin={`-${(mi * 0.3 + k * 0.75) % 1.5}s`} />
                    </circle>
                  ))}
                </g>
              )}
            </g>
          );
        })}

        {/* ── Interest flows UP ($ signs) ─────────────────────── */}
        {yieldT > 0.08 && (
          <g opacity={yieldT * (1 - steadyT * 0.3)}>
            {/* Leg 1: borrowers → markets */}
            {[0, 1, 2].map(mi => {
              const d = curve(P.marketCX(mi), M0.marketRowY + marketH, P.borrowersCX, M0.borrowerRowY);
              return (
                <text key={`y1-${mi}`} fontSize="12" fontWeight="700"
                      fill={MORPHO.success} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="2.2s" repeatCount="indefinite" path={d}
                    keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                    begin={`-${(mi * 0.4) % 2.2}s`} />
                </text>
              );
            })}
            {/* Leg 2: markets → vault */}
            {[0, 1, 2].map(mi => {
              const d = curve(P.vaultCX, M0.vaultRowY + vaultH, P.marketCX(mi), M0.marketRowY);
              return (
                <text key={`y2-${mi}`} fontSize="12" fontWeight="700"
                      fill={MORPHO.success} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="2.2s" repeatCount="indefinite" path={d}
                    keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                    begin={`-${(mi * 0.4 + 0.6) % 2.2}s`} />
                </text>
              );
            })}
            {/* Leg 3: vault → lenders (direct) */}
            {(() => {
              const d = curve(P.lendersCX, M0.userRowY + groupH, P.vaultCX, M0.vaultRowY);
              return (
                <text fontSize="12" fontWeight="700"
                      fill={MORPHO.success} textAnchor="middle"
                      dominantBaseline="central" fontFamily={FONTS.mono}>
                  $
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={d}
                    keyPoints="1;0" keyTimes="0;1" calcMode="linear"
                    begin="-1.6s" />
                </text>
              );
            })()}
          </g>
        )}

        {/* ── Steady-state gentle loop ───────────────────────── */}
        {steadyT > 0.1 && (
          <g opacity={steadyT * 0.5}>
            {[0, 1, 2].map(mi => {
              const d = curve(P.vaultCX, M0.vaultRowY + vaultH, P.marketCX(mi), M0.marketRowY);
              return (
                <circle key={`s-vm-${mi}`} r={2.2} fill={MORPHO.brand}>
                  <animateMotion dur="3.5s" repeatCount="indefinite" path={d}
                    keyPoints="0;1" keyTimes="0;1" calcMode="linear"
                    begin={`-${mi * 1.2}s`} />
                </circle>
              );
            })}
          </g>
        )}
      </svg>

      {/* ═══════════════  Cards  ═══════════════ */}

      {/* Lenders (single entry, centered above vault) */}
      <div style={{
        position: 'absolute',
        left: P.lendersX, top: M0.userRowY,
        opacity: Easing.easeOutCubic(window01(T, B0.appear[0] + 0.1, B0.appear[1] + 0.1)),
        transform: `translateY(${(1 - appearT) * -8}px)`,
      }}>
        <GroupChip
          label="Lenders" sublabel="Depositors" count={3}
          width={M0.groupW} accent={MORPHO.brand}
          state={depositT > 0.15 && depositT < 0.95 ? 'active' : 'healthy'}
        />
      </div>

      {/* USDC Vault (centered) */}
      <div style={{
        position: 'absolute',
        left: P.vaultX, top: M0.vaultRowY,
        opacity: Easing.easeOutCubic(window01(T, B0.appear[0] + 0.3, B0.appear[1] + 0.3)),
        transform: `translateY(${(1 - appearT) * -10}px)`,
      }}>
        <VaultCardBig
          name="USDC Vault" tvl="$100M" state="healthy"
          liquidity={Math.min(1, 0.15 + depositT * 0.7 + steadyT * 0.15)}
          width={M0.vaultW}
        />
      </div>

      {/* Markets */}
      {[{ sym: 'cbBTC' }, { sym: 'wETH' }, { sym: 'wstETH' }].map((m, mi) => {
        const util = 0.25 + 0.25 * allocT + 0.15 * borrowT;
        const clampedUtil = Math.max(0.1, Math.min(0.75, util));
        return (
          <div key={`mkt-${mi}`} style={{
            position: 'absolute',
            left: P.marketX(mi), top: M0.marketRowY,
            opacity: Easing.easeOutCubic(window01(T, B0.appear[0] + 0.5 + mi * 0.08, B0.appear[1] + 0.5 + mi * 0.08)),
            transform: `translateY(${(1 - appearT) * -8}px)`,
          }}>
            <MarketCardBig
              symbol={m.sym} state="healthy"
              utilization={clampedUtil}
              utilLabel={allocT > 0.3 ? `${Math.round(clampedUtil * 100)}%` : null}
              width={M0.marketW}
              subtitle="/ USDC"
            />
          </div>
        );
      })}

      {/* Borrowers (single group) */}
      <div style={{
        position: 'absolute',
        left: P.borrowersX, top: M0.borrowerRowY,
        opacity: Easing.easeOutCubic(window01(T, B0.appear[0] + 0.7, B0.appear[1] + 0.7)),
        transform: `translateY(${(1 - appearT) * 8}px)`,
      }}>
        <GroupChip
          label="Borrowers" sublabel="Collateral posted" count={1}
          width={M0.borrowerGroupW} accent={MORPHO.purple}
          state={borrowT > 0.15 && borrowT < 0.95 ? 'active' : 'healthy'}
        />
      </div>
    </>
  );
}

Object.assign(window, { Module0, M0 });
