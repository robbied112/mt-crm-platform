/**
 * AnalysisViewer — AI Wine Analyst homepage.
 *
 * Upload zone at top, narrative analysis in the middle, BlueprintRenderer
 * dashboard below. Reads from BlueprintContext (zero context changes).
 * State machine: no-data → uploading → analyzing → ready.
 */

import { useState, useCallback, useRef } from "react";
import { useBlueprint } from "../context/BlueprintContext";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import BlueprintRenderer from "./reports/BlueprintRenderer";
import parseFile from "../utils/parseFile";
import { getFunctions, httpsCallable } from "firebase/functions";

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ onFiles, isAnalyzing }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !isAnalyzing && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? "#6B1E1E" : "#E5E0DA"}`,
        borderRadius: 12,
        padding: "32px 24px",
        textAlign: "center",
        cursor: isAnalyzing ? "default" : "pointer",
        background: dragOver ? "rgba(107, 30, 30, 0.03)" : "#FFFFFF",
        transition: "all 150ms",
        marginBottom: 32,
      }}
    >
      {isAnalyzing ? (
        <>
          <div style={{
            width: 24, height: 24, border: "3px solid #E5E0DA",
            borderTopColor: "#6B1E1E", borderRadius: "50%",
            animation: "spin 800ms linear infinite",
            margin: "0 auto 12px",
          }} />
          <p style={{
            fontFamily: "'Inter Tight', sans-serif", fontSize: 15,
            color: "#6B1E1E", margin: 0, fontWeight: 500,
          }}>
            Analyzing your data...
          </p>
          <p style={{ fontSize: 13, color: "#6B6B6B", margin: "8px 0 0" }}>
            Building charts, finding insights, and writing your briefing.
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>+</div>
          <p style={{
            fontFamily: "'Inter Tight', sans-serif", fontSize: 15,
            color: "#2E2E2E", margin: 0, fontWeight: 500,
          }}>
            Drop your distributor reports here
          </p>
          <p style={{ fontSize: 13, color: "#6B6B6B", margin: "8px 0 0" }}>
            Excel, CSV — iDig, VIP, QuickBooks, inventory reports. Drop multiple files at once.
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.tsv"
        multiple
        onChange={(e) => {
          if (e.target.files.length > 0) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </div>
  );
}

// ─── Narrative Section ───────────────────────────────────────────────────────

function NarrativeSection({ narrative }) {
  if (!narrative?.segments?.length) return null;

  const hookLine = narrative.segments[0]?.content || "";
  const bodySegments = narrative.segments.slice(1);

  return (
    <div style={{ maxWidth: 720, marginBottom: 32 }}>
      <p style={{
        fontFamily: "'Inter', sans-serif", fontSize: 12, textTransform: "uppercase",
        letterSpacing: "0.5px", color: "#6B6B6B", marginBottom: 8,
      }}>
        AI ANALYSIS
      </p>
      <h1 style={{
        fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 28,
        color: "#6B1E1E", fontWeight: 400, lineHeight: 1.3, marginBottom: 24,
      }}>
        {hookLine}
      </h1>
      {bodySegments.map((seg, i) => (
        <p key={i} style={{
          fontSize: 15, lineHeight: 1.7, color: "#2E2E2E", marginBottom: 16,
          fontFamily: "'Inter', sans-serif",
        }}>
          {seg.content}
        </p>
      ))}
    </div>
  );
}

// ─── Suggested Questions ─────────────────────────────────────────────────────

function SuggestedQuestions({ questions }) {
  if (!questions?.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
        color: "#6B6B6B", marginBottom: 12, fontFamily: "'Inter', sans-serif",
      }}>
        ASK ABOUT YOUR DATA
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {questions.map((q, i) => (
          <span key={i} style={{
            display: "inline-block", padding: "8px 14px", fontSize: 13,
            background: "#FDF8F0", border: "1px solid #E5E0DA", borderRadius: 20,
            color: "#2E2E2E", fontFamily: "'Inter', sans-serif",
          }}>
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Actions Rail ────────────────────────────────────────────────────────────

function ActionsRail({ actions }) {
  if (!actions?.length) return null;

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E5E0DA", borderRadius: 8,
      padding: 16, marginBottom: 24,
    }}>
      <p style={{
        fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
        color: "#6B6B6B", marginBottom: 12, fontFamily: "'Inter', sans-serif",
      }}>
        DO NEXT
      </p>
      {actions.map((action, i) => (
        <div key={i} style={{
          padding: "8px 0",
          borderBottom: i < actions.length - 1 ? "1px solid #E5E0DA" : "none",
        }}>
          <p style={{
            fontSize: 14, color: "#2E2E2E", margin: 0,
            fontFamily: "'Inter', sans-serif",
          }}>
            {action.text}
          </p>
          {action.relatedAccount && (
            <p style={{ fontSize: 12, color: "#6B6B6B", margin: "2px 0 0" }}>
              {action.relatedAccount}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Analysis Skeleton ───────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div style={{ maxWidth: 720, padding: "48px 0" }}>
      <div style={{ width: 120, height: 14, background: "#E5E0DA", borderRadius: 4, marginBottom: 12 }} />
      <div style={{ width: "80%", height: 28, background: "#E5E0DA", borderRadius: 6, marginBottom: 32 }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ width: `${70 + i * 8}%`, height: 16, background: "#F0EBE4", borderRadius: 4 }} />
        </div>
      ))}
      <p style={{ color: "#6B6B6B", fontSize: 13, marginTop: 24 }}>Analyzing your data...</p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalysisViewer() {
  const { blueprint, hasBlueprint, loading } = useBlueprint();
  const { importDatasets, tenantConfig } = useData();
  const { tenantId } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = useCallback(async (files) => {
    setError("");
    setAnalyzing(true);

    try {
      // Parse and import each file
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large (max 10MB).`);
          setAnalyzing(false);
          return;
        }
        if (file.size === 0) {
          setError(`${file.name} is empty.`);
          setAnalyzing(false);
          return;
        }

        const parsed = await parseFile(file);
        if (!parsed.rows || parsed.rows.length === 0) {
          setError(`${file.name} has no data rows.`);
          setAnalyzing(false);
          return;
        }

        // Save import with skipRebuild + skipAnalysis (batch pattern)
        await importDatasets(
          {}, // empty datasets (normalized model writes rows directly)
          "", // no summary
          {
            fileName: file.name,
            type: "unknown",
            mapping: {},
            originalHeaders: parsed.headers,
            rowCount: parsed.rows.length,
          },
          { skipRebuild: true, skipAnalysis: true, rawRows: parsed.rows }
        );
      }

      // After all files imported, trigger single analysis
      const fns = getFunctions();
      const analyzeUploadFn = httpsCallable(fns, "analyzeUpload");
      await analyzeUploadFn({ tenantId });
    } catch (err) {
      console.error("[AnalysisViewer] Analysis failed:", err);
      setError(err.message || "Analysis failed. Your data is saved, try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [importDatasets, tenantId]);

  // Loading state
  if (loading) return <AnalysisSkeleton />;

  // No data yet — just show upload zone
  if (!hasBlueprint && !analyzing) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{
          fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 32,
          color: "#6B1E1E", fontWeight: 400, marginBottom: 8,
        }}>
          Your AI Wine Analyst
        </h1>
        <p style={{
          fontSize: 16, color: "#6B6B6B", marginBottom: 32, lineHeight: 1.6,
          fontFamily: "'Inter', sans-serif",
        }}>
          Drop your distributor reports and I'll analyze them — depletions, inventory,
          accounts, trends. Charts, KPIs, and specific actions, tailored to your data.
        </p>
        <UploadZone onFiles={handleFiles} isAnalyzing={false} />
        {error && (
          <p style={{ color: "#C53030", fontSize: 14, marginTop: 12 }}>{error}</p>
        )}
      </div>
    );
  }

  // Ready state — show narrative + dashboard
  const narrative = blueprint?.narrative;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 0" }}>
      {/* Upload zone — always visible */}
      <UploadZone onFiles={handleFiles} isAnalyzing={analyzing} />

      {error && (
        <p style={{ color: "#C53030", fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {analyzing && <AnalysisSkeleton />}

      {!analyzing && hasBlueprint && (
        <>
          {/* Narrative + Actions layout */}
          <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NarrativeSection narrative={narrative} />
              <SuggestedQuestions questions={narrative?.suggestedQuestions} />
            </div>
            <div style={{ width: 280, flexShrink: 0 }}>
              <ActionsRail actions={narrative?.actions} />
              {blueprint?.dataSources?.length > 0 && (
                <div style={{
                  background: "#FFFFFF", border: "1px solid #E5E0DA", borderRadius: 8,
                  padding: 16,
                }}>
                  <p style={{
                    fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px",
                    color: "#6B6B6B", marginBottom: 8, fontFamily: "'Inter', sans-serif",
                  }}>
                    DATA SOURCES
                  </p>
                  {blueprint.dataSources.map((ds, i) => (
                    <p key={i} style={{ fontSize: 13, color: "#2E2E2E", margin: "4px 0" }}>
                      {ds.fileName}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dashboard — existing BlueprintRenderer, zero changes */}
          <BlueprintRenderer />
        </>
      )}
    </div>
  );
}
