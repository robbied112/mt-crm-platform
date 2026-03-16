/**
 * SetupAssistant — guided onboarding flow at /setup.
 *
 * Multi-section page:
 *   1. Role confirmation (pre-filled from signup)
 *   2. Distributor selector — which distributors do you work with?
 *   3. Report guide viewer — step-by-step instructions per distributor
 *   4. Upload launcher — links to DataImport in settings
 *   5. Data Health Card — what's loaded, what's missing
 *
 * Onboarding state lives on tenants/{id}/config/main.onboarding.
 * Always writes the full onboarding{} object (never partial patches).
 *
 * DistributorSelector and ReportGuide are inline — only used here.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  DISTRIBUTOR_SYSTEMS,
  ONBOARDING_STEPS,
  ROLE_RECOMMENDATIONS,
  getReportGuide,
  getDistributorSystemIds,
} from "../config/reportGuides";
import DataHealthCard from "./DataHealthCard";
import { logSetupEvent } from "../services/setupAnalytics";

const STEP_LABELS = {
  role: "Your Role",
  distributors: "Your Distributors",
  guides: "Report Guides",
  upload: "Upload Data",
  health: "Data Health",
};

const ROLES = ["Winery", "Importer", "Distributor", "Retailer"];

export default function SetupAssistant() {
  const { tenantConfig, updateTenantConfig, tenantId, availability } = useData();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Onboarding state from Firestore (or fresh default)
  const onboarding = tenantConfig?.onboarding || {
    distributors: [],
    completedSteps: [],
    dataHealth: {},
    dismissedAt: null,
  };

  const [selectedRole, setSelectedRole] = useState(
    currentUser?.businessType || tenantConfig?.userRole || "Winery"
  );
  const [selectedDistributors, setSelectedDistributors] = useState(
    onboarding.distributors || []
  );
  const [otherDistributor, setOtherDistributor] = useState("");
  const [activeGuide, setActiveGuide] = useState(null);
  const [activeReportType, setActiveReportType] = useState("depletion");
  const [saving, setSaving] = useState(false);

  // Determine current step based on what's been completed
  const currentStep = useMemo(() => {
    const completed = onboarding.completedSteps || [];
    for (const step of ONBOARDING_STEPS) {
      if (!completed.includes(step)) return step;
    }
    return "health"; // All done
  }, [onboarding.completedSteps]);

  // Track setup_started event on mount
  useEffect(() => {
    logSetupEvent(tenantId, "setup_started", { role: selectedRole, source: "direct" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save full onboarding state to Firestore
  const saveOnboarding = useCallback(
    async (patch) => {
      const updated = {
        distributors: selectedDistributors,
        completedSteps: onboarding.completedSteps || [],
        dataHealth: {
          depletions: !!availability?.depletions,
          inventory: !!availability?.inventory,
          pipeline: !!availability?.pipeline,
          accounts: !!availability?.accounts,
          distributorHealth: !!availability?.distributorHealth,
        },
        dismissedAt: onboarding.dismissedAt || null,
        ...patch,
      };
      setSaving(true);
      try {
        await updateTenantConfig({ onboarding: updated });
      } catch {
        // Non-critical — user can continue without persistence
        console.warn("Failed to save onboarding state");
      } finally {
        setSaving(false);
      }
    },
    [selectedDistributors, onboarding, availability, updateTenantConfig]
  );

  const completeStep = useCallback(
    (step) => {
      const completed = [...(onboarding.completedSteps || [])];
      if (!completed.includes(step)) completed.push(step);
      saveOnboarding({ completedSteps: completed });
    },
    [onboarding.completedSteps, saveOnboarding]
  );

  // ── Role Confirmation ──
  function handleRoleConfirm() {
    completeStep("role");
    logSetupEvent(tenantId, "role_confirmed", { role: selectedRole });
  }

  // ── Distributor Selection ──
  function toggleDistributor(id) {
    setSelectedDistributors((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function handleDistributorsConfirm() {
    const distributors = [...selectedDistributors];
    if (otherDistributor.trim()) {
      distributors.push(`other:${otherDistributor.trim()}`);
      logSetupEvent(tenantId, "guide_not_found", {
        distributorName: otherDistributor.trim(),
      });
    }
    saveOnboarding({
      distributors,
      completedSteps: [...(onboarding.completedSteps || []), "distributors"],
    });
    logSetupEvent(tenantId, "distributor_selected", {
      distributors,
      count: distributors.length,
    });
    // Auto-select first distributor for guide view
    if (distributors.length > 0) {
      const firstReal = distributors.find((d) => !d.startsWith("other:"));
      setActiveGuide(firstReal || "generic");
    }
  }

  // ── Guide Viewer ──
  function handleGuideView(systemId) {
    setActiveGuide(systemId);
    setActiveReportType("depletion");
    logSetupEvent(tenantId, "guide_viewed", { distributorId: systemId });
  }

  function handleGuideDone() {
    completeStep("guides");
  }

  // ── Upload ──
  function handleGoToUpload() {
    logSetupEvent(tenantId, "upload_started_from_guide", {});
    completeStep("upload");
    navigate("/settings");
  }

  // ── Completion check ──
  const allComplete = ONBOARDING_STEPS.every((s) => (onboarding.completedSteps || []).includes(s));
  useEffect(() => {
    if (allComplete && availability?.hasAnyData) {
      logSetupEvent(tenantId, "setup_completed", {});
    }
  }, [allComplete, availability?.hasAnyData, tenantId]);

  const roleRec = ROLE_RECOMMENDATIONS[selectedRole] || ROLE_RECOMMENDATIONS.Winery;
  const systemIds = getDistributorSystemIds();

  return (
    <div className="setup-assistant">
      <div className="setup-assistant__header">
        <h1 className="setup-assistant__title">Get Started</h1>
        <p className="setup-assistant__subtitle">
          Let's set up your territory in a few quick steps.
        </p>

        {/* Progress bar */}
        <div className="setup-assistant__progress">
          {ONBOARDING_STEPS.map((step, i) => {
            const done = (onboarding.completedSteps || []).includes(step);
            const active = step === currentStep;
            return (
              <div
                key={step}
                className={`setup-assistant__progress-step ${done ? "setup-assistant__progress-step--done" : ""} ${active ? "setup-assistant__progress-step--active" : ""}`}
              >
                <div className="setup-assistant__progress-dot">
                  {done ? "\u2713" : i + 1}
                </div>
                <span className="setup-assistant__progress-label">
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step 1: Role ── */}
      <section className="setup-assistant__section">
        <h2 className="setup-assistant__section-title">1. Your Business Type</h2>
        <p className="setup-assistant__section-desc">
          This helps us show the right reports and terminology for your business.
        </p>
        <div className="setup-assistant__role-grid">
          {ROLES.map((role) => (
            <button
              key={role}
              className={`setup-assistant__role-btn ${selectedRole === role ? "setup-assistant__role-btn--selected" : ""}`}
              onClick={() => setSelectedRole(role)}
            >
              {role}
            </button>
          ))}
        </div>
        {!(onboarding.completedSteps || []).includes("role") && (
          <button
            className="setup-assistant__action-btn"
            onClick={handleRoleConfirm}
            disabled={saving}
          >
            Confirm &amp; Continue
          </button>
        )}
      </section>

      {/* ── Step 2: Distributors ── */}
      <section className="setup-assistant__section">
        <h2 className="setup-assistant__section-title">2. Your Distributors</h2>
        <p className="setup-assistant__section-desc">
          Which distributors do you work with? We'll show you exactly how to pull reports from their portals.
        </p>
        <div className="setup-assistant__distributor-grid">
          {systemIds.map((id) => {
            const sys = DISTRIBUTOR_SYSTEMS[id];
            const checked = selectedDistributors.includes(id);
            return (
              <label
                key={id}
                className={`setup-assistant__distributor-option ${checked ? "setup-assistant__distributor-option--checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDistributor(id)}
                  className="setup-assistant__distributor-checkbox"
                />
                <div>
                  <span className="setup-assistant__distributor-name">{sys.name}</span>
                  <span className="setup-assistant__distributor-portal">{sys.portalName}</span>
                </div>
              </label>
            );
          })}
          <div className="setup-assistant__distributor-other">
            <label className="setup-assistant__distributor-other-label">
              Other distributor:
            </label>
            <input
              type="text"
              className="setup-assistant__distributor-other-input"
              value={otherDistributor}
              onChange={(e) => setOtherDistributor(e.target.value)}
              placeholder="e.g., Martignetti, Opici, LibDib..."
            />
          </div>
        </div>
        {!(onboarding.completedSteps || []).includes("distributors") && (
          <button
            className="setup-assistant__action-btn"
            onClick={handleDistributorsConfirm}
            disabled={saving || (selectedDistributors.length === 0 && !otherDistributor.trim())}
          >
            Continue to Report Guides
          </button>
        )}
      </section>

      {/* ── Step 3: Report Guides ── */}
      <section className="setup-assistant__section">
        <h2 className="setup-assistant__section-title">3. How to Pull Your Reports</h2>
        <p className="setup-assistant__section-desc">
          Select a distributor below to see step-by-step instructions for downloading the right report.
        </p>

        {/* Distributor tabs */}
        <div className="setup-assistant__guide-tabs">
          {(selectedDistributors.length > 0 ? selectedDistributors : systemIds).map((id) => {
            const displayId = id.startsWith("other:") ? "generic" : id;
            const sys = DISTRIBUTOR_SYSTEMS[displayId] || DISTRIBUTOR_SYSTEMS.generic;
            return (
              <button
                key={id}
                className={`setup-assistant__guide-tab ${activeGuide === displayId ? "setup-assistant__guide-tab--active" : ""}`}
                onClick={() => handleGuideView(displayId)}
              >
                {sys.shortName}
              </button>
            );
          })}
        </div>

        {/* Guide content */}
        {activeGuide && (
          <ReportGuidePanel
            systemId={activeGuide}
            reportType={activeReportType}
            onReportTypeChange={setActiveReportType}
          />
        )}

        {!(onboarding.completedSteps || []).includes("guides") && activeGuide && (
          <button
            className="setup-assistant__action-btn"
            onClick={handleGuideDone}
            disabled={saving}
          >
            I've got my report — let's upload
          </button>
        )}
      </section>

      {/* ── Step 4: Upload ── */}
      <section className="setup-assistant__section">
        <h2 className="setup-assistant__section-title">4. Upload Your Data</h2>
        <p className="setup-assistant__section-desc">
          {roleRec.primaryWhy}. Start with a <strong>{roleRec.primaryLabel}</strong>.
        </p>
        {isAdmin ? (
          <button
            className="setup-assistant__action-btn setup-assistant__action-btn--primary"
            onClick={handleGoToUpload}
          >
            Go to Data Import
          </button>
        ) : (
          <p className="setup-assistant__hint">
            Ask your admin to upload data in Settings.
          </p>
        )}
      </section>

      {/* ── Step 5: Data Health ── */}
      <section className="setup-assistant__section">
        <h2 className="setup-assistant__section-title">5. Your Data Health</h2>
        <p className="setup-assistant__section-desc">
          Here's what the system has so far — and what's still missing.
        </p>
        <DataHealthCard onUploadClick={() => navigate("/settings")} />

        {allComplete && availability?.hasAnyData && (
          <div className="setup-assistant__complete">
            <h3>You're all set!</h3>
            <p>Your territory is ready. Head to your dashboard to explore your data.</p>
            <button
              className="setup-assistant__action-btn setup-assistant__action-btn--primary"
              onClick={() => navigate("/")}
            >
              Go to My Territory
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── ReportGuidePanel (inline) ── */

function ReportGuidePanel({ systemId, reportType, onReportTypeChange }) {
  const { system, report } = getReportGuide(systemId, reportType);
  const reportTypes = Object.keys(system.reports);

  return (
    <div className="report-guide">
      <div className="report-guide__header">
        <h3 className="report-guide__system-name">{system.name}</h3>
        <span className="report-guide__portal">{system.portalName}</span>
      </div>

      {/* Report type selector */}
      {reportTypes.length > 1 && (
        <div className="report-guide__type-tabs">
          {reportTypes.map((rt) => (
            <button
              key={rt}
              className={`report-guide__type-tab ${reportType === rt ? "report-guide__type-tab--active" : ""}`}
              onClick={() => onReportTypeChange(rt)}
            >
              {system.reports[rt].title}
            </button>
          ))}
        </div>
      )}

      <div className="report-guide__content">
        <h4 className="report-guide__title">{report.title}</h4>
        <p className="report-guide__description">{report.description}</p>

        <ol className="report-guide__steps">
          {report.steps.map((step, i) => (
            <li key={i} className="report-guide__step">
              {step}
            </li>
          ))}
        </ol>

        {report.tips && report.tips.length > 0 && (
          <div className="report-guide__tips">
            <h5 className="report-guide__tips-title">Tips</h5>
            <ul className="report-guide__tips-list">
              {report.tips.map((tip, i) => (
                <li key={i} className="report-guide__tip">{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {report.expectedColumns && report.expectedColumns.length > 0 && (
          <div className="report-guide__columns">
            <h5 className="report-guide__columns-title">Expected Columns</h5>
            <div className="report-guide__column-tags">
              {report.expectedColumns.map((col) => (
                <span key={col} className="report-guide__column-tag">{col}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
