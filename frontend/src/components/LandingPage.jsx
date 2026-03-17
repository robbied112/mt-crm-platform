import { useEffect } from "react";

/* ──────────────────────────────────────────────
   Dashboard Mockup — pure styled-div product UI
   ────────────────────────────────────────────── */
function DashboardMockup() {
  const kpis = [
    { label: "Revenue", value: "12.4k", sub: "cases this quarter", color: "#6B1E1E" },
    { label: "Accounts", value: "847", sub: "active accounts", color: "#2563EB" },
    { label: "Sell-Thru", value: "94.2%", sub: "avg across distros", color: "#059669" },
  ];
  const bars = [
    { label: "Annual Volume Goal", pct: 72, color: "#6B1E1E" },
    { label: "Distribution Target", pct: 58, color: "#2563EB" },
  ];
  const rows = [
    { name: "Premium Wine Distributors", state: "CA", dot: "#059669" },
    { name: "Atlantic Beverage Co.", state: "NY", dot: "#D97706" },
    { name: "Midwest Spirits Group", state: "IL", dot: "#059669" },
  ];

  return (
    <div style={{
      background: "#1A1F3E", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)",
      padding: 24, maxWidth: 720, margin: "0 auto",
      boxShadow: "0 0 80px rgba(107,30,30,0.18), 0 20px 60px rgba(0,0,0,0.4)",
      animation: "float 6s ease-in-out infinite",
      transform: "perspective(1200px) rotateX(2deg)",
    }}>
      {/* KPI row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{
            flex: 1, background: "#0f172a", borderRadius: 8, padding: "16px 16px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1.2, marginTop: 4, fontFeatureSettings: "'tnum'" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {/* Progress bars */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#6B6B6B", fontWeight: 500 }}>{b.label}</span>
              <span style={{ fontSize: 12, color: b.color, fontWeight: 700 }}>{b.pct}%</span>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${b.pct}%`, height: "100%", background: b.color, borderRadius: 6, transition: "width 400ms ease-out" }} />
            </div>
          </div>
        ))}
      </div>
      {/* Mini scorecard table */}
      <div style={{ background: "#0f172a", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ flex: 2, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase" }}>Distributor</span>
          <span style={{ flex: 0.5, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>State</span>
          <span style={{ flex: 0.5, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Health</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", padding: "10px 16px",
            borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}>
            <span style={{ flex: 2, fontSize: 13, color: "#D2C78A", fontWeight: 500 }}>{r.name}</span>
            <span style={{ flex: 0.5, fontSize: 12, color: "#6B6B6B", textAlign: "center" }}>{r.state}</span>
            <span style={{ flex: 0.5, textAlign: "center" }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: r.dot }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   SVG Check icon for pricing
   ────────────────────────────────────────────── */
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#6B1E1E" opacity="0.15" />
      <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="#6B1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   Mini feature mockups
   ────────────────────────────────────────────── */
function ScorecardMockup() {
  const rows = [
    { name: "Valley Wine Group", score: 92, dot: "#059669" },
    { name: "Coastal Spirits", score: 78, dot: "#D97706" },
    { name: "Metro Beverage", score: 45, dot: "#ef4444" },
  ];
  return (
    <div style={{ background: "#FDF8F0", borderRadius: 12, padding: 20, border: "1px solid #E5E0DA" }}>
      <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid #E5E0DA", marginBottom: 4 }}>
        <span style={{ flex: 2, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase" }}>Distributor</span>
        <span style={{ flex: 0.6, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Score</span>
        <span style={{ flex: 0.4, fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Status</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
          <span style={{ flex: 2, fontSize: 14, color: "#2E2E2E", fontWeight: 500 }}>{r.name}</span>
          <span style={{ flex: 0.6, fontSize: 14, color: "#2E2E2E", fontWeight: 700, textAlign: "center" }}>{r.score}</span>
          <span style={{ flex: 0.4, textAlign: "center" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: r.dot }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function TerritoryMockup() {
  const states = [
    { abbr: "CA", rep: "Sarah M.", color: "#6B1E1E" },
    { abbr: "NY", rep: "James K.", color: "#2563EB" },
    { abbr: "TX", rep: "Maria L.", color: "#7c3aed" },
    { abbr: "IL", rep: "David P.", color: "#D97706" },
  ];
  return (
    <div style={{ background: "#FDF8F0", borderRadius: 12, padding: 20, border: "1px solid #E5E0DA" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {states.map((s, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: 8, padding: "12px 14px",
            border: `2px solid ${s.color}20`, display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: `${s.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: s.color,
            }}>{s.abbr}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2E2E2E" }}>{s.rep}</div>
              <div style={{ fontSize: 11, color: "#6B6B6B" }}>Territory Rep</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineMockup() {
  const stages = [
    { label: "Prospect", count: 24, pct: 100, color: "#6B6B6B" },
    { label: "Outreach", count: 18, pct: 75, color: "#2563EB" },
    { label: "Sampling", count: 12, pct: 50, color: "#6B1E1E" },
    { label: "Closed", count: 8, pct: 33, color: "#059669" },
  ];
  return (
    <div style={{ background: "#FDF8F0", borderRadius: 12, padding: 20, border: "1px solid #E5E0DA" }}>
      {stages.map((s, i) => (
        <div key={i} style={{ marginBottom: i < 3 ? 10 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#6B6B6B", fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontSize: 13, color: s.color, fontWeight: 700 }}>{s.count} accounts</span>
          </div>
          <div style={{ background: "#E5E0DA", borderRadius: 6, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main LandingPage
   ────────────────────────────────────────────── */
export default function LandingPage({ onGetStarted, onSignIn }) {
  useEffect(() => {
    const id = "lp-keyframes";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @keyframes float { 0%,100%{transform:perspective(1200px) rotateX(2deg) translateY(0)} 50%{transform:perspective(1200px) rotateX(2deg) translateY(-10px)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }

        /* Landing page interactive states */
        .lp-btn-primary { transition: background-color 200ms ease-out, box-shadow 200ms ease-out, transform 200ms ease-out; }
        .lp-btn-primary:hover { background-color: #8A2035 !important; }
        .lp-btn-primary:focus-visible { box-shadow: 0 0 0 3px rgba(210,199,138,0.3); outline: none; }
        .lp-btn-primary:active { transform: scale(0.98); }

        .lp-btn-ghost { transition: border-color 200ms ease-out, color 200ms ease-out, background-color 200ms ease-out; }
        .lp-btn-ghost:hover { border-color: rgba(255,255,255,0.5) !important; color: #fff !important; background-color: rgba(255,255,255,0.05) !important; }
        .lp-btn-ghost:focus-visible { box-shadow: 0 0 0 3px rgba(210,199,138,0.3); outline: none; }

        .lp-btn-white { transition: background-color 200ms ease-out, box-shadow 200ms ease-out, transform 200ms ease-out; }
        .lp-btn-white:hover { background-color: #FDF8F0 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .lp-btn-white:focus-visible { box-shadow: 0 0 0 3px rgba(210,199,138,0.3); outline: none; }
        .lp-btn-white:active { transform: scale(0.98); }

        .lp-nav-link { transition: color 200ms ease-out; }
        .lp-nav-link:hover { color: #fff !important; }

        .lp-nav-cta { transition: background-color 200ms ease-out, box-shadow 200ms ease-out; }
        .lp-nav-cta:hover { background-color: #8A2035 !important; }
        .lp-nav-cta:focus-visible { box-shadow: 0 0 0 3px rgba(210,199,138,0.3); outline: none; }

        .lp-price-card { transition: transform 200ms ease-out, box-shadow 200ms ease-out; }
        .lp-price-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(0,0,0,0.1); }

        .lp-footer-link { transition: color 200ms ease-out; }
        .lp-footer-link:hover { color: #fff !important; }

        .lp-contact-btn { transition: border-color 200ms ease-out, color 200ms ease-out, background-color 200ms ease-out; }
        .lp-contact-btn:hover { background-color: #f9fafb !important; border-color: #6B1E1E !important; color: #6B1E1E !important; }
        .lp-contact-btn:focus-visible { box-shadow: 0 0 0 3px rgba(210,199,138,0.3); outline: none; }

        @media (prefers-reduced-motion: reduce) {
          .lp-btn-primary, .lp-btn-ghost, .lp-btn-white, .lp-nav-link, .lp-nav-cta,
          .lp-price-card, .lp-footer-link, .lp-contact-btn { transition: none !important; }
          @keyframes float { 0%,100%,50%{transform:perspective(1200px) rotateX(2deg) translateY(0)} }
          @keyframes fadeInUp { from{opacity:1;transform:none} to{opacity:1;transform:none} }
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: "#1a1a2e", lineHeight: 1.6 }}>

      {/* ── Nav ──────────────────────────────── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <span style={s.navLogo}>CruFolio</span>
          <div style={s.navLinks}>
            <a href="#features" className="lp-nav-link" style={s.navLink}>Features</a>
            <a href="#pricing" className="lp-nav-link" style={s.navLink}>Pricing</a>
            <button onClick={onSignIn} className="lp-nav-link" style={s.navLinkBtn}>Sign In</button>
            <button onClick={onGetStarted} className="lp-nav-cta" style={s.navCta}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────── */}
      <section style={s.hero}>
        <div style={{ maxWidth: 900, margin: "0 auto", animation: "fadeInUp 0.8s ease-out" }}>
          <h1 style={s.heroH1}>
            Your sales data,{" "}
            <span style={{
              background: "linear-gradient(135deg, #6B1E1E, #8A2035)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>finally useful.</span>
          </h1>
          <p style={s.heroSub}>
            The BI platform built for suppliers who sell through distributors.
          </p>
          <div style={s.heroCtas}>
            <button onClick={onGetStarted} className="lp-btn-primary" style={s.btnTeal}>Start Free Trial</button>
            <a href="#features" className="lp-btn-ghost" style={s.btnGhost}>See How It Works</a>
          </div>
        </div>

        {/* Product mockup */}
        <div style={{ marginTop: 64, animation: "fadeInUp 1s ease-out 0.3s both" }}>
          <DashboardMockup />
        </div>

        <p style={s.socialProof}>Trusted by wine &amp; spirits suppliers across 12 states</p>
      </section>

      {/* ── Why CruFolio (stat cards) ────────── */}
      <section style={{ ...s.sectionWhite, paddingTop: 48, paddingBottom: 48 }}>
        <div style={s.statsRow}>
          {[
            { num: "5 min", label: "Setup Time", desc: "Upload a spreadsheet and see insights immediately" },
            { num: "10x", label: "Faster Than Spreadsheets", desc: "Auto-scored distributors, not manual vlookups" },
            { num: "$0", label: "To Start", desc: "Free tier with no credit card required" },
          ].map((item, i) => (
            <div key={i} style={s.statCard}>
              <div style={s.statNum}>{item.num}</div>
              <div style={s.statLabel}>{item.label}</div>
              <div style={s.statDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────── */}
      <section id="features" style={{ ...s.sectionWhite, paddingTop: 80, paddingBottom: 80 }}>
        <h2 style={{ ...s.sectionH2, textAlign: "left", maxWidth: 1200 }}>Built for how you actually sell</h2>
        <p style={{ ...s.sectionSub, textAlign: "left", margin: "0 0 56px" }}>Every feature is designed for suppliers who sell through distributors, brokers, and reps.</p>

        {/* Feature 1: Scorecard — text left, mockup right */}
        <div style={s.featureRow}>
          <div style={s.featureText}>
            <div style={s.featureTag}>Distributor Scorecard</div>
            <h3 style={s.featureH3}>Know which distributors need attention — before problems start</h3>
            <p style={s.featureP}>
              Automatic health scores based on velocity, sell-through, and inventory turns.
              Green, yellow, and red at a glance.
            </p>
          </div>
          <div style={s.featureMockup}><ScorecardMockup /></div>
        </div>

        {/* Feature 2: Territory — mockup left, text right */}
        <div style={{ ...s.featureRow, flexDirection: "row-reverse" }}>
          <div style={s.featureText}>
            <div style={s.featureTag}>Territory Intelligence</div>
            <h3 style={s.featureH3}>Every rep sees their world, with action items built in</h3>
            <p style={s.featureP}>
              Assign reps to states, regions, or custom territories. Each rep sees only their
              accounts with personalized insights.
            </p>
          </div>
          <div style={s.featureMockup}><TerritoryMockup /></div>
        </div>

        {/* Feature 3: Pipeline — text left, mockup right */}
        <div style={s.featureRow}>
          <div style={s.featureText}>
            <div style={s.featureTag}>Pipeline &amp; Forecasting</div>
            <h3 style={s.featureH3}>Track every deal from prospect to placement</h3>
            <p style={s.featureP}>
              Visual pipeline with customizable stages. Reorder forecasting tells you who's
              due before they go dark.
            </p>
          </div>
          <div style={s.featureMockup}><PipelineMockup /></div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────── */}
      <section style={{ ...s.sectionGray, paddingTop: 80, paddingBottom: 80 }}>
        <h2 style={s.sectionH2}>Up and running in minutes</h2>
        <div style={s.stepsFlow}>
          {[
            { step: "1", title: "Upload", desc: "Drag & drop a distributor report — Excel, CSV, or depletion file." },
            { step: "2", title: "Auto-Map", desc: "We detect your columns and map them to the right fields automatically." },
            { step: "3", title: "Insights", desc: "Scorecards, health scores, and rep dashboards — live in minutes." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 200 }}>
              <div style={s.stepFlowItem}>
                <div style={s.stepFlowNumber}>{item.step}</div>
                <div>
                  <div style={s.stepFlowTitle}>{item.title}</div>
                  <div style={s.stepFlowDesc}>{item.desc}</div>
                </div>
              </div>
              {i < 2 && (
                <div style={s.stepFlowArrow}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────── */}
      <section id="pricing" style={s.sectionWhite}>
        <h2 style={s.sectionH2}>Simple, transparent pricing</h2>
        <p style={s.sectionSub}>Start free. Upgrade when you're ready.</p>
        <div style={s.pricingGrid}>
          {pricingTiers.map((tier, i) => (
            <div key={i} className="lp-price-card" style={{
              ...s.priceCard,
              ...(tier.popular ? s.priceCardPop : {}),
            }}>
              {tier.popular && <div style={s.popBadge}>Most Popular</div>}
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "#2E2E2E", fontFamily: "'Inter Tight', Inter, sans-serif" }}>{tier.name}</h3>
              <div style={s.priceAmount}>
                {tier.price}<span style={s.priceUnit}>{tier.unit}</span>
              </div>
              <div style={s.priceDesc}>{tier.desc}</div>
              <ul style={s.priceList}>
                {tier.features.map((feat, j) => (
                  <li key={j} style={s.priceLi}>
                    <Check />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              {tier.cta === "contact" ? (
                <a href="mailto:hello@crufolio.com" className="lp-contact-btn" style={{ ...s.btnGhost, display: "block", textAlign: "center", color: "#2E2E2E", borderColor: "#E5E0DA" }}>Contact Sales</a>
              ) : (
                <button onClick={onGetStarted} className="lp-btn-primary" style={{ ...s.btnTeal, width: "100%" }}>
                  {tier.popular ? "Start Free Trial" : "Get Started"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────── */}
      <section style={s.ctaSection}>
        <h2 style={s.ctaH2}>Start making better decisions today</h2>
        <p style={s.ctaSub}>Join hundreds of suppliers replacing spreadsheets with real intelligence.</p>
        <button onClick={onGetStarted} className="lp-btn-white" style={s.btnCtaWhite}>Get Started Free</button>
        <p style={s.ctaNote}>No credit card required</p>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer style={s.footer}>
        <p>&copy; 2026 CruFolio. All rights reserved. | <a href="mailto:hello@crufolio.com" className="lp-footer-link" style={{ color: "#D2C78A", textDecoration: "none", padding: "10px 4px" }}>hello@crufolio.com</a></p>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Data
   ────────────────────────────────────────────── */
const pricingTiers = [
  {
    name: "Starter", price: "$49", unit: "/mo", desc: "For small teams getting started",
    features: ["Up to 5 users", "Distributor health scores", "Territory management", "Pipeline tracking", "Excel data uploads", "Email support"],
  },
  {
    name: "Growth", price: "$99", unit: "/mo", desc: "For growing sales organizations", popular: true,
    features: ["Up to 15 users", "Everything in Starter", "Account CRM with files", "Email logging", "Reorder forecasting", "Priority support"],
  },
  {
    name: "Enterprise", price: "Custom", unit: "", desc: "For large teams with custom needs", cta: "contact",
    features: ["Unlimited users", "Everything in Growth", "Custom integrations", "API access", "Dedicated support", "Custom onboarding"],
  },
];

/* ──────────────────────────────────────────────
   Styles
   ────────────────────────────────────────────── */
const s = {
  /* Nav */
  nav: {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
    background: "rgba(10,15,26,0.85)", backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  navInner: {
    maxWidth: 1200, margin: "0 auto", padding: "16px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  navLogo: { fontSize: 22, fontWeight: 400, color: "#D2C78A", fontFamily: "'Libre Baskerville', Georgia, serif", letterSpacing: "2px" },
  navLinks: { display: "flex", gap: 24, alignItems: "center" },
  navLink: { textDecoration: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500, padding: "10px 12px" },
  navLinkBtn: {
    background: "none", border: "none", color: "rgba(255,255,255,0.7)",
    fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "10px 12px",
  },
  navCta: {
    background: "#6B1E1E", color: "#fff", padding: "8px 20px",
    borderRadius: 7, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },

  /* Hero */
  hero: {
    padding: "140px 24px 80px", textAlign: "center",
    background: "linear-gradient(180deg, #0a0f1a 0%, #111827 60%, #1A1F3E 100%)",
    overflow: "hidden",
  },
  heroH1: {
    fontSize: 60, fontWeight: 700, lineHeight: 1.3,
    color: "#f1f5f9", marginBottom: 20, letterSpacing: "-0.02em",
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  heroSub: {
    fontSize: 20, color: "#6B6B6B", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6,
  },
  heroCtas: { display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" },
  socialProof: {
    fontSize: 14, color: "#6B6B6B", marginTop: 48, letterSpacing: "0.02em",
  },

  /* Buttons */
  btnTeal: {
    background: "#6B1E1E", color: "#fff", padding: "12px 24px", borderRadius: 7,
    fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
    fontFamily: "'Inter Tight', Inter, sans-serif",
    textDecoration: "none", display: "inline-block",
  },
  btnGhost: {
    background: "transparent", color: "#fff", padding: "12px 24px", borderRadius: 7,
    fontSize: 14, fontWeight: 600, border: "2px solid rgba(255,255,255,0.2)",
    fontFamily: "'Inter Tight', Inter, sans-serif",
    cursor: "pointer", textDecoration: "none", display: "inline-block",
  },

  /* Sections */
  sectionWhite: { padding: "60px 24px 80px", maxWidth: 1200, margin: "0 auto" },
  sectionGray: { padding: "60px 24px", background: "#f9fafb" },
  sectionH2: {
    fontSize: 38, fontWeight: 400, textAlign: "center", marginBottom: 16,
    color: "#0f172a", letterSpacing: "-0.01em",
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  sectionSub: {
    fontSize: 18, color: "#6B6B6B", textAlign: "center", maxWidth: 560,
    margin: "0 auto 56px", lineHeight: 1.6,
  },

  /* Why CruFolio stats */
  statsRow: {
    display: "flex", gap: 32, maxWidth: 1000, margin: "0 auto", flexWrap: "wrap",
    justifyContent: "center",
  },
  statCard: {
    flex: "1 1 260px", textAlign: "center", padding: 24,
    background: "#fff", borderRadius: 8, border: "1px solid #E5E0DA",
  },
  statNum: {
    fontSize: 48, fontWeight: 700, color: "#6B1E1E", lineHeight: 1,
    background: "linear-gradient(135deg, #6B1E1E, #8A2035)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  },
  statLabel: { fontSize: 16, fontWeight: 700, color: "#2E2E2E", marginTop: 8 },
  statDesc: { fontSize: 14, color: "#6B6B6B", marginTop: 4, lineHeight: 1.5 },

  /* Feature rows */
  featureRow: {
    display: "flex", gap: 48, alignItems: "center", marginBottom: 64,
    flexWrap: "wrap",
  },
  featureText: { flex: "1 1 320px", minWidth: 280 },
  featureMockup: { flex: "1 1 340px", minWidth: 300 },
  featureTag: {
    display: "inline-block", fontSize: 12, fontWeight: 700, color: "#6B1E1E",
    background: "rgba(107, 30, 30, 0.08)", padding: "4px 12px", borderRadius: 20,
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12,
  },
  featureH3: {
    fontSize: 24, fontWeight: 400, color: "#0f172a", lineHeight: 1.35, marginBottom: 12,
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  featureP: { fontSize: 16, color: "#6B6B6B", lineHeight: 1.7 },

  /* How It Works — horizontal flow */
  stepsFlow: {
    display: "flex", gap: 0, maxWidth: 900, margin: "40px auto 0",
    flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start",
  },
  stepFlowItem: {
    display: "flex", gap: 16, alignItems: "flex-start", flex: 1,
  },
  stepFlowNumber: {
    fontSize: 28, fontWeight: 700, color: "#6B1E1E", flexShrink: 0,
    fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1,
    minWidth: 28,
  },
  stepFlowTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 },
  stepFlowDesc: { fontSize: 14, color: "#6B6B6B", lineHeight: 1.6 },
  stepFlowArrow: {
    flexShrink: 0, padding: "8px 12px", display: "flex", alignItems: "center",
  },

  /* Pricing */
  pricingGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24, maxWidth: 1000, margin: "0 auto",
  },
  priceCard: {
    background: "#fff", borderRadius: 8, padding: 24, textAlign: "center",
    position: "relative", border: "2px solid #E5E0DA",
  },
  priceCardPop: {
    borderColor: "#6B1E1E",
    boxShadow: "0 0 40px rgba(107,30,30,0.15), 0 8px 30px rgba(0,0,0,0.08)",
    transform: "scale(1.04)",
    zIndex: 1,
  },
  popBadge: {
    position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
    background: "#6B1E1E", color: "#fff", padding: "5px 18px", borderRadius: 20,
    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
  },
  priceAmount: { fontSize: 48, fontWeight: 700, color: "#2E2E2E", margin: "16px 0 4px", fontFeatureSettings: "'tnum'" },
  priceUnit: { fontSize: 16, fontWeight: 500, color: "#6B6B6B" },
  priceDesc: { fontSize: 14, color: "#6B6B6B", marginBottom: 24 },
  priceList: { listStyle: "none", textAlign: "left", marginBottom: 28, padding: 0 },
  priceLi: {
    padding: "7px 0", fontSize: 14, color: "#2E2E2E",
    display: "flex", alignItems: "center", gap: 10,
  },

  /* Final CTA */
  ctaSection: {
    padding: "100px 24px", textAlign: "center",
    background: "linear-gradient(180deg, #0a0f1a 0%, #1A1F3E 100%)",
  },
  ctaH2: { fontSize: 38, fontWeight: 400, color: "#f1f5f9", marginBottom: 16, fontFamily: "'Libre Baskerville', Georgia, serif" },
  ctaSub: {
    fontSize: 18, color: "#6B6B6B", maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.6,
  },
  btnCtaWhite: {
    background: "#fff", color: "#6B1E1E", padding: "12px 24px", borderRadius: 7,
    fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
    fontFamily: "'Inter Tight', Inter, sans-serif",
  },
  ctaNote: { fontSize: 13, color: "#6B6B6B", marginTop: 14 },

  /* Footer */
  footer: {
    padding: "40px 24px", textAlign: "center", background: "#0a0f1a",
    color: "#6B6B6B", fontSize: 13, borderTop: "1px solid rgba(255,255,255,0.06)",
  },
};
