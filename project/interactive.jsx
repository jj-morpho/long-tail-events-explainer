// interactive.jsx — Scroll-driven interactive version of both modules.
//
// Each module is a sticky viewport; scrolling within the section advances
// the module's local time. This turns the videos into explorable explainers.

function clampI(v, min, max) {return v < min ? min : v > max ? max : v;}

function useScrollProgress(ref) {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        const el = ref.current;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // Progress = how far we've scrolled past the section start,
        // normalized over its total scrollable range.
        const total = el.offsetHeight - vh;
        const scrolled = -rect.top;
        const prog = total > 0 ? clampI(scrolled / total, 0, 1) : 0;
        setP(prog);
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

// A sticky section that pipes scroll-progress → timeline time.
function ScrollStage({ duration, scrollHeight, children, background = MORPHO.bg, label }) {
  const sectionRef = React.useRef(null);
  const progress = useScrollProgress(sectionRef);
  const t = progress * duration;

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        height: scrollHeight, // e.g. '400vh' for 4 screens of scroll
        background
      }}>
      
      <div style={{
        position: 'sticky', top: 0,
        height: '100vh', width: '100%',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <ScrollStageInner t={t} duration={duration} label={label} progress={progress}>
          {children}
        </ScrollStageInner>
      </div>
    </section>);

}

// Inner: scales a 1600×900 stage to fit, injects a <TimelineContext> so
// existing Module components drive off our scroll-time.
function ScrollStageInner({ t, duration, children, label, progress }) {
  const frameRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    function fit() {
      const pad = 72; // breathing room
      const w = Math.max(300, window.innerWidth - pad * 2);
      const h = Math.max(300, window.innerHeight - pad * 2);
      const s = Math.min(w / 1600, h / 900);
      setScale(s);
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const timelineValue = React.useMemo(() => ({
    time: t,
    duration,
    playing: false,
    play: () => {}, pause: () => {}, seek: () => {}, toggle: () => {}
  }), [t, duration]);

  return (
    <TimelineContext.Provider value={timelineValue}>
      {/* Top-left label */}
      {label &&
      <div style={{
        position: 'absolute', top: 24, left: 32, zIndex: 5,
        fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.18em',
        color: MORPHO.textFaint, textTransform: 'uppercase',
        pointerEvents: 'none'
      }}>{label}</div>
      }

      {/* Scrubber bar */}
      <div style={{
        position: 'absolute', top: 24, right: 32, zIndex: 5,
        width: 220, height: 3, background: MORPHO.border, borderRadius: 2,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: MORPHO.brandDeep,
          transition: 'width 60ms linear'
        }} />
      </div>

      <div ref={frameRef} style={{
        width: 1600, height: 900,
        minWidth: 1600, minHeight: 900,
        flex: '0 0 auto',
        position: 'relative',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        background: MORPHO.bg,
        borderRadius: 12,
        boxShadow: '0 30px 80px rgba(15,20,40,0.08)',
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </TimelineContext.Provider>);

}

/* ─────────────────────────────────────────────────────────────
   Page layout
   ──────────────────────────────────────────────────────────── */
function InteractiveApp() {
  return (
    <div style={{ background: MORPHO.bg, color: MORPHO.text, fontFamily: FONTS.body }}>
      {/* Hero */}
      <section style={{
        minHeight: '100vh', padding: '140px 72px 120px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        maxWidth: 1200, margin: '0 auto'
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.22em',
          color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 24
        }}>

        </div>
        <h1 style={{
          fontFamily: FONTS.display, fontWeight: 400,
          fontSize: 'clamp(44px, 6.5vw, 96px)',
          lineHeight: 1.02, letterSpacing: '-0.025em',
          color: MORPHO.text, margin: 0, maxWidth: 1100
        }}>
          How markets &amp; vaults behave <span style={{ color: MORPHO.textMuted }}>during long tail events.</span>
        </h1>
        <p style={{
          marginTop: 36, fontSize: 20, lineHeight: 1.55,
          color: MORPHO.textMuted, maxWidth: 720
        }}>An interactive explainer.

        </p>
        <div style={{
          marginTop: 72,
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.18em',
          color: MORPHO.textFaint, textTransform: 'uppercase'
        }}>
          <span style={{ width: 24, height: 1, background: MORPHO.borderStrong }} />
          Scroll to start
          <DownCaret />
        </div>
      </section>

      {/* Chapter 1 — Overview */}
      <ChapterHeader
        num="01"
        title="How lending works on Morpho"
        rest={"End users deposit into distributors — fintechs, exchanges, custodians, enterprises — who help their users deposit into curated Morpho Vaults. \n\nCurators design allocation strategies for vault deposits across isolated markets, where borrowers post collateral against loans. Interest flows back from borrowers to vaults to depositors."} />
      
      <ScrollStage duration={30} scrollHeight="420vh" background="#F9FAFB" label="Module 01 · Overview">
        <Module0 />
      </ScrollStage>

      {/* Chapter 2 — Credit Risk Isolation */}
      <ChapterHeader
        num="02"
        title="Credit risk is isolated"
        rest="A credit event in one market stays in that specific market. Vaults exposed to it will incur bad debts, while vaults that don't allocate to the specific market are exposed to 0 additional credit risk." />
      
      <ScrollStage duration={20} scrollHeight="320vh" background="#F9FAFB" label="Module 02 · Credit risk isolation">
        <Module1 />
      </ScrollStage>

      {/* Chapter 3 — Liquidity Correlations + IRM */}
      <ScrollStage duration={75} scrollHeight="900vh" background="#F9FAFB" label="Module 03 · Liquidity correlations & IRM">
        <Module2 />
      </ScrollStage>

      {/* Outro */}
      <section style={{
        minHeight: '60vh', padding: '120px 72px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        maxWidth: 1100, margin: '0 auto'
      }}>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.22em',
          color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 18
        }}>
          Takeaway
        </div>
        <div style={{
          fontFamily: FONTS.display, fontWeight: 400,
          fontSize: 'clamp(28px, 3.4vw, 48px)',
          lineHeight: 1.15, letterSpacing: '-0.02em',
          color: MORPHO.text, maxWidth: 900, whiteSpace: 'pre-line'
        }}>
          {"Credit risk remains isolated.\nLiquidity can be temporarily impacted.\nRates adapt to new market conditions.\nA new equilibrium is found."}
        </div>
      </section>
    </div>);

}

function ChapterHeader({ num, title, rest }) {
  return (
    <section style={{
      padding: '120px 72px 40px',
      maxWidth: 1100, margin: '0 auto'
    }}>
      <div style={{
        fontFamily: FONTS.mono, fontSize: 12, letterSpacing: '0.22em',
        color: MORPHO.textFaint, textTransform: 'uppercase', marginBottom: 20
      }}></div>
      <h2 style={{
        fontFamily: FONTS.display, fontWeight: 400,
        fontSize: 'clamp(36px, 4.2vw, 64px)',
        lineHeight: 1.08, letterSpacing: '-0.02em',
        color: MORPHO.text, margin: 0, maxWidth: 880
      }}>{title}</h2>
      <p style={{
        marginTop: 22, fontSize: 19, lineHeight: 1.55,
        color: MORPHO.textMuted, maxWidth: 720, whiteSpace: 'pre-line'
      }}>{rest}</p>
    </section>);

}

function DownCaret() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5 L7 9 L11 5" stroke={MORPHO.textFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<InteractiveApp />);