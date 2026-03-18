/**
 * DailyActions — "What should I do today?" card.
 * Computes up to 3 prioritized action items from CRM data.
 */

import { useMemo } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { matchesUserTerritory } from "../utils/territory";

const PRIORITY_COLORS = {
  urgent: "#C53030",
  moderate: "#C07B01",
  info: "#8B6A4C",
};

const PRIORITY_ICONS = {
  urgent: "\u{1F6A8}",
  moderate: "\u26A0\uFE0F",
  info: "\u{1F4CB}",
};

export default function DailyActions() {
  const { reorderData, accountsTop, distScorecard, pipelineAccounts, pipelineMeta } = useData();
  const { currentUser: user } = useAuth();

  const actions = useMemo(() => {
    const items = [];
    const today = new Date();

    // 1. Overdue reorders — accounts past 120% of their order cycle
    if (Array.isArray(reorderData)) {
      reorderData
        .filter(
          (r) =>
            r.cycle > 0 &&
            r.days > r.cycle * 1.2 &&
            matchesUserTerritory(r.st, user)
        )
        .sort((a, b) => (b.days - b.cycle) - (a.days - a.cycle))
        .slice(0, 3)
        .forEach((r) => {
          items.push({
            priority: "urgent",
            description: `Follow up with ${r.acct}`,
            detail: `${r.days} days since last order (usually every ${r.cycle} days)`,
          });
        });
    }

    // 2. Declining/inactive accounts — recent velocity well below average
    if (Array.isArray(accountsTop)) {
      accountsTop
        .filter((a) => {
          const avg13w = (a.ce || 0) / 13;
          return (
            (a.w4 || 0) < avg13w * 0.5 &&
            (a.ce || 0) > 1 &&
            matchesUserTerritory(a.st, user)
          );
        })
        .slice(0, 3)
        .forEach((a) => {
          items.push({
            priority: "moderate",
            description: `Check on ${a.acct}`,
            detail: `Volume down significantly (${(a.w4 || 0).toFixed(1)} recent vs ${((a.ce || 0) / 13).toFixed(1)} avg)`,
          });
        });
    }

    // 3. Distributor health drops — score below 60
    if (Array.isArray(distScorecard)) {
      distScorecard
        .filter(
          (d) =>
            typeof d.healthScore === "number" &&
            d.healthScore < 60 &&
            matchesUserTerritory(d.st, user)
        )
        .sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0))
        .slice(0, 3)
        .forEach((d) => {
          items.push({
            priority: "moderate",
            description: `Review ${d.dist || d.acct || "distributor"} performance`,
            detail: `Health score ${d.healthScore}`,
          });
        });
    }

    // 4. Pipeline follow-ups — deals stalling in a stage (>21 days)
    if (Array.isArray(pipelineAccounts)) {
      const meta = pipelineMeta || {};
      pipelineAccounts
        .filter((p) => {
          if (
            !p.acct ||
            p.stage === "Identified" ||
            p.stage === "Closed Won" ||
            p.stage === "Closed Lost"
          )
            return false;
          const m = meta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
          const st = m.state || p.state || "";
          return matchesUserTerritory(st, user);
        })
        .filter((p) => {
          const m = meta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
          const stageDate = m.stageDate ? new Date(m.stageDate) : null;
          if (!stageDate) return false;
          const daysSince = Math.floor((today - stageDate) / 86400000);
          return daysSince > 21;
        })
        .slice(0, 3)
        .forEach((p) => {
          const m = meta[p.acct.replace(/[^a-zA-Z0-9]/g, "_")] || {};
          const resolvedStage = m.stage || p.stage;
          items.push({
            priority: "info",
            description: `Move ${p.acct} forward`,
            detail: `Been in ${resolvedStage} stage`,
          });
        });
    }

    return items.slice(0, 3);
  }, [reorderData, accountsTop, distScorecard, pipelineAccounts, pipelineMeta, user]);

  return (
    <div className="daily-actions">
      <div className="daily-actions__header">
        <h3 className="daily-actions__title">Daily Actions</h3>
        <span className="daily-actions__subtitle">What should I do today?</span>
      </div>

      {actions.length === 0 ? (
        <div className="daily-actions__empty">
          <span className="daily-actions__empty-icon">&#10003;</span>
          <span className="daily-actions__empty-text">
            Looking good! All accounts are on track.
          </span>
        </div>
      ) : (
        <div className="daily-actions__list">
          {actions.map((action, i) => (
            <div
              key={i}
              className="daily-actions__item"
              style={{ borderLeftColor: PRIORITY_COLORS[action.priority] }}
            >
              <span className="daily-actions__item-icon">
                {PRIORITY_ICONS[action.priority]}
              </span>
              <div className="daily-actions__item-content">
                <span className="daily-actions__item-desc">
                  {action.description}
                </span>
                <span className="daily-actions__item-detail">
                  {action.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
