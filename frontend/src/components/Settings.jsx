/**
 * Settings tab component (admin only)
 * Extracted from index.html admin-settings tab (lines 1899-2214).
 * Provides platform configuration: branding, users, regions, products,
 * goals, terminology, pipeline stages, channels, tags, features,
 * data upload, billing, and danger zone.
 */

import { useState } from "react";
import TENANT_CONFIG from "../config/tenant";
import { t } from "../utils/terminology";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import useSubscription from "../hooks/useSubscription";
import { PLANS } from "../config/plans";
import DataImport from "./DataImport";
import CloudSyncSettings from "./CloudSyncSettings";
import TeamSettings from "./TeamSettings";
import TeamSetupWizard from "./TeamSetupWizard";

function SettingsSection({ title, children, headerRight, id }) {
  return (
    <div
      id={id}
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2E2E2E", margin: 0 }}>
          {title}
        </h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#6B6B6B",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function PillList({ items = [], onRemove, onAdd, addLabel }) {
  const [newItem, setNewItem] = useState("");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              background: "#F5EDE3",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {item}
            {onRemove && (
              <span
                style={{ cursor: "pointer", color: "#6B6B6B", fontWeight: 700 }}
                onClick={() => onRemove(i)}
              >
                &times;
              </span>
            )}
          </span>
        ))}
      </div>
      {onAdd && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`New ${addLabel || "item"}...`}
            style={{
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
              flex: 1,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                onAdd(newItem.trim());
                setNewItem("");
              }
            }}
          />
          <button
            onClick={() => {
              if (newItem.trim()) {
                onAdd(newItem.trim());
                setNewItem("");
              }
            }}
            style={{
              padding: "6px 14px",
              background: "#1F865A",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        </div>
      )}
    </>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};

const goalInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  fontSize: 13,
};

export default function Settings({
  config = TENANT_CONFIG,
  onSaveBranding,
  onSaveTerminology,
  onSaveGoals,
  onChangePassword,
  onResetSettings,
  onDeleteAllData,
  onManageBilling,
  onOpenBillingPortal,
}) {
  const { updateTenantConfig } = useData();
  const { isAdmin } = useAuth();
  const sub = useSubscription();
  const [showWizard, setShowWizard] = useState(false);
  const [userRole, setUserRole] = useState(config.userRole || "supplier");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);

  const saveRole = async () => {
    setRoleSaving(true);
    try {
      await updateTenantConfig({ userRole });
      // DataContext syncs TENANT_CONFIG automatically via useEffect
      setRoleSaved(true);
      setTimeout(() => setRoleSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save role:", err);
    } finally {
      setRoleSaving(false);
    }
  };

  const [branding, setBranding] = useState({
    companyName: config.companyName || "",
    logo: config.logo || "",
    primaryColor: config.primaryColor || "#6B1E1E",
    accentColor: config.accentColor || "#14B8A6",
  });

  const [terminology, setTerminology] = useState({
    volume: config.terminology?.volume || "CE",
    longPeriod: config.terminology?.longPeriod || "13W",
    shortPeriod: config.terminology?.shortPeriod || "4W",
    distributor: config.terminology?.distributor || "Distributor",
    account: config.terminology?.account || "Account",
    depletion: config.terminology?.depletion || "Depletion",
  });

  const [goals, setGoals] = useState(config.goals || {});
  const [stages, setStages] = useState(config.pipelineStages || []);
  const [channels, setChannels] = useState(config.channels || []);
  const [tags, setTags] = useState(config.tags || []);

  const [features, setFeatures] = useState(config.features || {});

  const featureList = [
    { key: "fileAttachments", label: "File Attachments" },
    { key: "emailLogging", label: "Email Logging" },
    { key: "activityTimeline", label: "Activity Timeline" },
    { key: "pipeline", label: "Pipeline" },
    { key: "distributorHealth", label: `${t("distributor")} Health` },
    { key: "reorderForecast", label: "Reorder Forecast" },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "#2E2E2E" }}>
        Platform Settings
      </h2>

      {/* Account Security */}
      <SettingsSection title="Account Security">
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 12 }}>
          Manage your account password and security settings.
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: "10px 20px" }}
          onClick={onChangePassword}
        >
          Change Password
        </button>
      </SettingsSection>

      {/* Team Setup Wizard (modal) */}
      {showWizard && <TeamSetupWizard onClose={() => setShowWizard(false)} />}

      {/* Team Management (2nd section per design review) */}
      {isAdmin && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "rgba(107, 30, 30, 0.04)",
          border: "1px solid #E5E0DA", borderRadius: 8, marginBottom: 20,
        }}>
          <span style={{ fontSize: 14, color: "#2E2E2E", flex: 1 }}>
            Need to set up your team? The wizard walks you through naming your company, defining territories, and inviting your first teammate.
          </span>
          <button className="btn btn-primary" onClick={() => setShowWizard(true)} style={{ whiteSpace: "nowrap" }}>
            Launch Setup Wizard
          </button>
        </div>
      )}
      <TeamSettings
        territories={config.territories || {}}
        onSaveTerritories={(territories) => updateTenantConfig({ territories })}
      />

      {/* Business Role */}
      <SettingsSection
        title="Business Role"
        headerRight={
          <button
            className="btn btn-primary"
            onClick={saveRole}
            disabled={roleSaving}
          >
            {roleSaving ? "Saving..." : roleSaved ? "Saved!" : "Save Role"}
          </button>
        }
      >
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 12 }}>
          Set your business type. This controls how data is interpreted, what labels appear throughout the dashboard, and how the AI mapper processes your uploads.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { value: "supplier", label: "Supplier / Brand", desc: "You sell products through distributors to retail accounts" },
            { value: "distributor", label: "Distributor / Wholesaler", desc: "You source from suppliers and sell through your own stores/locations" },
          ].map(({ value, label, desc }) => (
            <label
              key={value}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 16,
                background: userRole === value ? "rgba(31, 134, 90, 0.08)" : "#FDF8F0",
                borderRadius: 10,
                border: `2px solid ${userRole === value ? "#1F865A" : "#E5E0DA"}`,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="userRole"
                value={value}
                checked={userRole === value}
                onChange={(e) => setUserRole(e.target.value)}
                style={{ marginTop: 2, accentColor: "#1F865A" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#2E2E2E" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 2 }}>{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </SettingsSection>

      {/* Company Branding */}
      <SettingsSection
        title="Company Branding"
        headerRight={
          <button
            className="btn btn-primary"
            onClick={() => onSaveBranding?.(branding)}
          >
            Save Branding
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="Company Name">
            <input
              type="text"
              style={inputStyle}
              value={branding.companyName}
              onChange={(e) =>
                setBranding((b) => ({ ...b, companyName: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Logo URL">
            <input
              type="text"
              style={inputStyle}
              value={branding.logo}
              onChange={(e) =>
                setBranding((b) => ({ ...b, logo: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Primary Color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                style={{ width: 40, height: 36, border: "1px solid #D1D5DB", borderRadius: 6, cursor: "pointer" }}
                value={branding.primaryColor}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, primaryColor: e.target.value }))
                }
              />
              <span style={{ fontSize: 13, color: "#6B6B6B", fontFamily: "monospace" }}>
                {branding.primaryColor}
              </span>
            </div>
          </FormField>
          <FormField label="Accent Color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                style={{ width: 40, height: 36, border: "1px solid #D1D5DB", borderRadius: 6, cursor: "pointer" }}
                value={branding.accentColor}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, accentColor: e.target.value }))
                }
              />
              <span style={{ fontSize: 13, color: "#6B6B6B", fontFamily: "monospace" }}>
                {branding.accentColor}
              </span>
            </div>
          </FormField>
        </div>
      </SettingsSection>

      {/* Goals & Targets */}
      <SettingsSection
        title="Goals & Targets"
        headerRight={
          <button className="btn btn-primary" onClick={() => onSaveGoals?.(goals)}>
            Save
          </button>
        }
      >
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16 }}>
          Set volume, account, and distribution goals. Progress is tracked on the Overview dashboard.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { key: "annualVolume", label: "Annual Volume Target (cases)", placeholder: "e.g. 50000" },
            { key: "totalAccounts", label: "Total Active Accounts Target", placeholder: "e.g. 500" },
            { key: "newAccountsPerQuarter", label: "New Accounts Per Quarter", placeholder: "e.g. 50" },
            { key: "totalStates", label: "Total States Target", placeholder: "e.g. 15" },
            { key: "totalDistributors", label: `Total ${t("distributor")}s Target`, placeholder: "e.g. 30" },
            { key: "annualRevenue", label: "Annual Revenue Target ($)", placeholder: "e.g. 500000" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 3 }}>
                {label}
              </label>
              <input
                type="number"
                placeholder={placeholder}
                style={goalInputStyle}
                value={goals[key] || ""}
                onChange={(e) =>
                  setGoals((g) => ({ ...g, [key]: Number(e.target.value) || 0 }))
                }
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Terminology */}
      <SettingsSection
        title="Terminology & Labels"
        headerRight={
          <button className="btn btn-primary" onClick={() => onSaveTerminology?.(terminology)}>
            Save
          </button>
        }
      >
        <p style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 12 }}>
          Customize what things are called throughout your dashboard.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { key: "volume", label: "Volume Metric Name", placeholder: "e.g. CE, Units" },
            { key: "longPeriod", label: "Long Period Label", placeholder: "e.g. 13W, Quarterly" },
            { key: "shortPeriod", label: "Short Period Label", placeholder: "e.g. 4W, Monthly" },
            { key: "distributor", label: "Distribution Partner", placeholder: "e.g. Distributor" },
            { key: "account", label: "End Customer", placeholder: "e.g. Account, Outlet" },
            { key: "depletion", label: "Product Movement", placeholder: "e.g. Depletion, Sales" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", display: "block", marginBottom: 2 }}>
                {label}
              </label>
              <input
                type="text"
                placeholder={placeholder}
                style={{ ...goalInputStyle, boxSizing: "border-box" }}
                value={terminology[key] || ""}
                onChange={(e) =>
                  setTerminology((t) => ({ ...t, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Pipeline Stages */}
      <SettingsSection title="Pipeline Stages">
        <PillList
          items={stages}
          onRemove={(i) => setStages((s) => s.filter((_, idx) => idx !== i))}
          onAdd={(item) => setStages((s) => [...s, item])}
          addLabel="stage"
        />
      </SettingsSection>

      {/* Channel Types */}
      <SettingsSection title="Channel Types">
        <PillList
          items={channels}
          onRemove={(i) => setChannels((c) => c.filter((_, idx) => idx !== i))}
          onAdd={(item) => setChannels((c) => [...c, item])}
          addLabel="channel"
        />
      </SettingsSection>

      {/* Account Tags */}
      <SettingsSection title="Account Tags">
        <PillList
          items={tags}
          onRemove={(i) => setTags((t) => t.filter((_, idx) => idx !== i))}
          onAdd={(item) => setTags((t) => [...t, item])}
          addLabel="tag"
        />
      </SettingsSection>

      {/* Features */}
      <SettingsSection title="Features">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {featureList.map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                cursor: "pointer",
                padding: "8px 12px",
                background: features[key] ? "rgba(31, 134, 90, 0.08)" : "#FDF8F0",
                borderRadius: 8,
                border: `1px solid ${features[key] ? "#1F865A" : "#E5E0DA"}`,
              }}
            >
              <input
                type="checkbox"
                checked={!!features[key]}
                onChange={(e) =>
                  setFeatures((f) => ({ ...f, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </SettingsSection>

      {/* Data Upload */}
      <SettingsSection title="Data Upload">
        <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 16 }}>
          {t("uploadHint")}
        </p>
        <DataImport />
      </SettingsSection>

      {/* Cloud Sync (Premium) */}
      <SettingsSection title="Cloud Sync">
        <CloudSyncSettings />
      </SettingsSection>

      {/* Billing */}
      <SettingsSection title="Billing & Subscription" id="settings-billing">
        <p style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 16 }}>
          Manage your subscription plan and payment details.
        </p>

        {/* Current plan status */}
        <div
          style={{
            background: sub.isActive
              ? "rgba(31, 134, 90, 0.08)"
              : sub.isTrial
              ? "rgba(192, 123, 1, 0.08)"
              : "rgba(197, 48, 48, 0.06)",
            border: `1px solid ${
              sub.isActive ? "#1F865A" : sub.isTrial ? "#C07B01" : "#C53030"
            }`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>
            {sub.isActive && !sub.isTrial ? "\u2705" : sub.isTrial ? "\u23F3" : "\u26A0\uFE0F"}
          </span>
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: sub.isActive ? "#1F865A" : sub.isTrial ? "#C07B01" : "#C53030",
              }}
            >
              {sub.isTrial
                ? `Free Trial — ${sub.daysLeft} day${sub.daysLeft !== 1 ? "s" : ""} remaining`
                : sub.isActive
                ? `${PLANS[sub.plan]?.name || "Active"} Plan`
                : sub.status === "cancelled"
                ? "Subscription Cancelled"
                : "Trial Expired"}
            </span>
            <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 2 }}>
              {sub.isTrial
                ? "Full access to all features during your trial."
                : sub.isActive
                ? `${PLANS[sub.plan]?.description || "Full access to all features."}`
                : "Upgrade to restore full access. Your data is safe."}
            </div>
            {sub.subscription?.nextBilling && sub.isActive && !sub.isTrial && (
              <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 4 }}>
                Next billing: {sub.subscription.nextBilling}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {(!sub.isActive || sub.isTrial) && onManageBilling && (
            <button className="btn btn-primary" onClick={onManageBilling}>
              {sub.isTrial ? "Upgrade Now" : "Choose a Plan"}
            </button>
          )}
          {sub.isActive && !sub.isTrial && onManageBilling && (
            <button className="btn btn-secondary" onClick={onManageBilling}>
              Change Plan
            </button>
          )}
          {sub.subscription?.customerId && onOpenBillingPortal && (
            <button className="btn btn-secondary" onClick={onOpenBillingPortal}>
              Manage Billing
            </button>
          )}
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <div
        style={{
          background: "rgba(197, 48, 48, 0.05)",
          border: "1px solid rgba(197, 48, 48, 0.2)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#C53030", marginBottom: 12 }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: 13, color: "#C53030", marginBottom: 12 }}>
          These actions cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            style={{
              padding: "8px 16px",
              background: "#C53030",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={onResetSettings}
          >
            Reset All Settings to Defaults
          </button>
          <button
            style={{
              padding: "8px 16px",
              background: "#C53030",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={onDeleteAllData}
          >
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  );
}
