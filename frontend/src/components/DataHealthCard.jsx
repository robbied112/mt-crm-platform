/**
 * DataHealthCard — reusable component showing data completeness.
 *
 * Reads DataContext.availability to determine which data types are loaded.
 * Shows a visual checklist, overall health score, and contextual nudge
 * for the next recommended upload. Role-aware messaging.
 *
 * Used in: SetupAssistant (/setup page), optionally MyTerritory dashboard.
 */

import { useMemo } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { ROLE_RECOMMENDATIONS } from "../config/reportGuides";

const DATA_TYPES = [
  {
    key: "depletions",
    label: "Depletions",
    description: "Volume trends, distributor scorecard, brand performance",
    uploadType: "depletion",
  },
  {
    key: "accounts",
    label: "Accounts",
    description: "Top accounts, trends, concentration analysis",
    uploadType: "depletion",
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock levels, days on hand, reorder alerts",
    uploadType: "inventory",
  },
  {
    key: "pipeline",
    label: "Pipeline",
    description: "Sales funnel, deal tracking, revenue forecasting",
    uploadType: "pipeline",
  },
  {
    key: "distributorHealth",
    label: "Distributor Health",
    description: "Sell-in vs sell-through, health scores, velocity",
    uploadType: "depletion",
  },
];

export default function DataHealthCard({ compact = false, onUploadClick }) {
  const { availability, tenantConfig } = useData();
  const { currentUser, isAdmin } = useAuth();

  const role = currentUser?.businessType || tenantConfig?.userRole || "Winery";
  const roleRec = ROLE_RECOMMENDATIONS[role] || ROLE_RECOMMENDATIONS.Winery;

  const health = useMemo(() => {
    const loaded = DATA_TYPES.filter((dt) => availability?.[dt.key]);
    const score = DATA_TYPES.length > 0
      ? Math.round((loaded.length / DATA_TYPES.length) * 100)
      : 0;

    // Find next recommended upload
    let nextNudge = null;
    if (!availability?.depletions) {
      nextNudge = {
        type: roleRec.primary,
        label: roleRec.primaryLabel,
        why: roleRec.primaryWhy,
      };
    } else if (roleRec.secondary) {
      for (const sec of roleRec.secondary) {
        const matchingType = DATA_TYPES.find((dt) => dt.uploadType === sec);
        if (matchingType && !availability?.[matchingType.key]) {
          nextNudge = {
            type: sec,
            label: roleRec.secondaryLabels?.[sec] || `Upload ${sec} data`,
            why: roleRec.secondaryLabels?.[sec] || "",
          };
          break;
        }
      }
    }

    return { loaded, score, nextNudge, total: DATA_TYPES.length };
  }, [availability, roleRec]);

  if (compact) {
    return (
      <div className="data-health data-health--compact">
        <div className="data-health__score-bar">
          <div
            className="data-health__score-fill"
            style={{ width: `${health.score}%` }}
          />
        </div>
        <span className="data-health__score-label">
          {health.loaded.length}/{health.total} data types loaded
        </span>
      </div>
    );
  }

  return (
    <div className="data-health">
      <div className="data-health__header">
        <h3 className="data-health__title">Data Health</h3>
        <span className="data-health__score">{health.score}%</span>
      </div>

      <div className="data-health__score-bar">
        <div
          className="data-health__score-fill"
          style={{ width: `${health.score}%` }}
        />
      </div>

      <ul className="data-health__checklist">
        {DATA_TYPES.map((dt) => {
          const loaded = availability?.[dt.key];
          return (
            <li
              key={dt.key}
              className={`data-health__item ${loaded ? "data-health__item--loaded" : ""}`}
            >
              <span className="data-health__check">
                {loaded ? "\u2705" : "\u2B1C"}
              </span>
              <div className="data-health__item-text">
                <span className="data-health__item-label">{dt.label}</span>
                {!loaded && (
                  <span className="data-health__item-desc">{dt.description}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {health.score === 100 ? (
        <div className="data-health__complete">
          You're all set! All data types are loaded.
        </div>
      ) : health.nextNudge ? (
        <div className="data-health__nudge">
          <p className="data-health__nudge-text">{health.nextNudge.label}</p>
          {isAdmin && onUploadClick && (
            <button
              className="data-health__nudge-btn"
              onClick={() => onUploadClick(health.nextNudge.type)}
            >
              Upload Data
            </button>
          )}
          {!isAdmin && (
            <p className="data-health__nudge-hint">
              Ask your admin to upload data
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
