/**
 * EmptyState — smart, contextual empty states that feel like onboarding,
 * not dead ends. Shows what the tab *will* do and guides users to action.
 */

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ILLUSTRATIONS = {
  depletions: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <rect x="10" y="50" width="12" height="20" rx="2" fill="rgba(107, 30, 30, 0.08)" />
      <rect x="28" y="35" width="12" height="35" rx="2" fill="#FDF8F0" />
      <rect x="46" y="20" width="12" height="50" rx="2" fill="#7A2530" />
      <rect x="64" y="40" width="12" height="30" rx="2" fill="#FDF8F0" />
      <rect x="82" y="15" width="12" height="55" rx="2" fill="#8B6A4C" />
      <rect x="100" y="25" width="12" height="45" rx="2" fill="#6B1E1E" />
      <path d="M16 48L34 33L52 18L70 38L88 13L106 23" stroke="#6B1E1E" strokeWidth="2" strokeDasharray="4 2" opacity="0.5" />
    </svg>
  ),
  distributors: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <rect x="5" y="10" width="50" height="60" rx="4" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <rect x="15" y="22" width="30" height="3" rx="1.5" fill="#FDF8F0" />
      <rect x="15" y="30" width="22" height="3" rx="1.5" fill="rgba(107, 30, 30, 0.08)" />
      <rect x="15" y="38" width="26" height="3" rx="1.5" fill="#FDF8F0" />
      <rect x="65" y="10" width="50" height="60" rx="4" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <circle cx="90" cy="35" r="12" fill="#F5EDE3" stroke="#7A2530" strokeWidth="1.5" />
      <path d="M85 35l3 3 7-7" stroke="#6B1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  inventory: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <rect x="20" y="15" width="80" height="50" rx="4" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <rect x="30" y="25" width="24" height="14" rx="2" fill="#F5EDE3" />
      <rect x="60" y="25" width="24" height="14" rx="2" fill="rgba(107, 30, 30, 0.08)" />
      <rect x="30" y="45" width="24" height="14" rx="2" fill="#FDF8F0" />
      <rect x="60" y="45" width="24" height="14" rx="2" fill="#F5EDE3" />
      <path d="M94 20l8-6v52l-8-6" stroke="#7A2530" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  accounts: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <circle cx="35" cy="30" r="12" fill="#F5EDE3" stroke="#7A2530" strokeWidth="1.5" />
      <circle cx="60" cy="25" r="15" fill="rgba(107, 30, 30, 0.08)" stroke="#8B6A4C" strokeWidth="1.5" />
      <circle cx="85" cy="32" r="10" fill="#F5EDE3" stroke="#7A2530" strokeWidth="1.5" />
      <path d="M20 65c0-8 7-14 15-14s15 6 15 14" stroke="#FDF8F0" strokeWidth="1.5" />
      <path d="M40 60c0-10 9-18 20-18s20 8 20 18" stroke="#8B6A4C" strokeWidth="1.5" />
      <path d="M68 63c0-7 7-12 17-12s17 5 17 12" stroke="#FDF8F0" strokeWidth="1.5" />
    </svg>
  ),
  opportunities: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <path d="M60 8l7 14 15.5 2.3-11.2 10.9 2.7 15.3L60 43.5l-14 7.5 2.7-15.3L37.5 24.3 53 22 60 8z" fill="#F5EDE3" stroke="#7A2530" strokeWidth="1.5" />
      <path d="M30 65h60" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 72h40" stroke="#F5EDE3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  reorder: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <circle cx="60" cy="40" r="28" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <path d="M60 20v20l12 8" stroke="#6B1E1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M85 25l5-8M90 45h10M82 60l7 5" stroke="#7A2530" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pipeline: (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <path d="M10 15h100l-15 25 15 25H10l15-25L10 15z" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <path d="M25 25h70" stroke="#F5EDE3" strokeWidth="8" strokeLinecap="round" />
      <path d="M30 40h55" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="8" strokeLinecap="round" />
      <path d="M35 55h35" stroke="#FDF8F0" strokeWidth="8" strokeLinecap="round" />
    </svg>
  ),
  welcome: (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      <rect x="10" y="10" width="120" height="80" rx="8" fill="#FDF8F0" stroke="rgba(107, 30, 30, 0.08)" strokeWidth="1.5" />
      <rect x="22" y="25" width="40" height="25" rx="4" fill="#F5EDE3" />
      <rect x="22" y="56" width="40" height="25" rx="4" fill="rgba(107, 30, 30, 0.08)" />
      <rect x="70" y="25" width="48" height="56" rx="4" fill="#FDF8F0" />
      <circle cx="94" cy="48" r="10" fill="#6B1E1E" opacity="0.3" />
      <path d="M90 48l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const EMPTY_STATE_CONFIG = {
  depletions: {
    title: "Track Your Depletions",
    description: "See velocity trends, weekly volume charts, distributor scorecards, and SKU mix analysis. Upload a depletion report to get started.",
    features: ["Weekly CE trending", "Distributor scorecards", "SKU mix breakdown", "Momentum tracking"],
  },
  distributorHealth: {
    title: "Monitor Distributor Health",
    description: "Drill into each distributor's sell-in vs sell-through, account penetration, and inventory health.",
    features: ["Sell-in / sell-through comparison", "Account penetration rates", "Inventory health by SKU", "Performance rankings"],
  },
  inventory: {
    title: "Manage Your Inventory",
    description: "Track stock levels, days on hand, and get reorder alerts before you run out.",
    features: ["Real-time stock levels", "Days on hand analysis", "Reorder status tracking", "SKU-level detail"],
  },
  accounts: {
    title: "Understand Your Accounts",
    description: "See which accounts are growing, declining, or need attention. Identify concentration risks.",
    features: ["Account momentum scores", "Growth trend analysis", "Concentration insights", "Territory breakdowns"],
  },
  opportunities: {
    title: "Find Growth Opportunities",
    description: "Discover re-engagement targets, celebrate new wins, and track net door placement.",
    features: ["Re-engagement targets", "New account wins", "Net placement tracking", "Whitespace analysis"],
  },
  reorder: {
    title: "Forecast Reorders",
    description: "Predict when accounts will reorder based on purchase history. Never miss a follow-up.",
    features: ["Predicted reorder dates", "Overdue account alerts", "Priority scoring", "SKU-level forecasts"],
  },
  pipeline: {
    title: "Manage Your Pipeline",
    description: "Track deals from lead to close. See your funnel, forecast revenue, and prioritize follow-ups.",
    features: ["Visual sales funnel", "Deal stage tracking", "Revenue forecasting", "Owner breakdowns"],
  },
};

export default function EmptyState({ dataKey, tabLabel }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const config = EMPTY_STATE_CONFIG[dataKey] || {};
  const illustration = ILLUSTRATIONS[dataKey] || ILLUSTRATIONS.welcome;

  return (
    <div className="empty-state">
      <div className="empty-state__illustration">
        {illustration}
      </div>
      <h2 className="empty-state__title">{config.title || `${tabLabel} Coming Soon`}</h2>
      <p className="empty-state__description">{config.description || "Upload your data to unlock this view."}</p>

      {config.features && (
        <div className="empty-state__features">
          {config.features.map((feature) => (
            <div key={feature} className="empty-state__feature">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="#F5EDE3" stroke="#6B1E1E" strokeWidth="1" />
                <path d="M4.5 7l2 2 3.5-3.5" stroke="#6B1E1E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}

      <div className="empty-state__actions">
        {isAdmin ? (
          <button
            className="btn btn-primary"
            onClick={() => navigate("/settings")}
          >
            Upload Data
          </button>
        ) : (
          <p className="empty-state__admin-note">Ask your admin to upload data to unlock this view.</p>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/")}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

/**
 * WelcomeState — shown when the user has no data at all.
 */
export function WelcomeState() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  return (
    <div className="empty-state empty-state--welcome">
      <div className="empty-state__illustration">
        {ILLUSTRATIONS.welcome}
      </div>
      <h2 className="empty-state__title">Welcome to CruFolio</h2>
      <p className="empty-state__description">
        Your sales intelligence platform is ready. Upload a distributor depletion report,
        QuickBooks export, or any sales data — the system will automatically detect
        and map your columns.
      </p>

      <div className="empty-state__steps">
        <div className="empty-state__step">
          <div className="empty-state__step-num">1</div>
          <div>
            <strong>Upload your data</strong>
            <span>Drop a CSV, Excel, or QuickBooks file</span>
          </div>
        </div>
        <div className="empty-state__step">
          <div className="empty-state__step-num">2</div>
          <div>
            <strong>Auto-map columns</strong>
            <span>We detect and map your fields automatically</span>
          </div>
        </div>
        <div className="empty-state__step">
          <div className="empty-state__step-num">3</div>
          <div>
            <strong>See your insights</strong>
            <span>KPIs, charts, and forecasts populate instantly</span>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <button
          className="btn btn-primary"
          style={{ padding: "14px 32px", fontSize: 15 }}
          onClick={() => navigate("/settings")}
        >
          Get Started — Upload Data
        </button>
      ) : (
        <p className="empty-state__admin-note">Ask your admin to upload data to get started.</p>
      )}
    </div>
  );
}
