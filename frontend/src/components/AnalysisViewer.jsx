/**
 * AnalysisViewer — AI Wine Analyst homepage.
 *
 * Upload zone at top, narrative analysis in the middle, BlueprintRenderer
 * dashboard below. Reads from BlueprintContext (zero context changes).
 * State machine: no-data -> uploading -> analyzing -> ready.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useBlueprint } from "../context/BlueprintContext";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import BlueprintRenderer from "./reports/BlueprintRenderer";
import NarrativeSection from "./reports/analysis/NarrativeSection";
import UploadStrip from "./reports/analysis/UploadStrip";
import AnalysisSkeleton from "./reports/analysis/AnalysisSkeleton";
import SuggestedQuestions from "./reports/analysis/SuggestedQuestions";
import ActionsRail from "./reports/analysis/ActionsRail";
import parseFile from "../utils/parseFile";
import { autoDetectMapping, detectUploadType } from "../utils/semanticMapper";
import { getFunctions, httpsCallable } from "firebase/functions";

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalysisViewer() {
  const { blueprint, hasBlueprint, loading } = useBlueprint();
  const { importDatasets } = useData();
  const { tenantId } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysisSteps, setAnalysisSteps] = useState([]);
  const [fadeIn, setFadeIn] = useState(false);
  const prevBlueprintRef = useRef(blueprint);

  // Detect new blueprint arrival for crossfade
  useEffect(() => {
    if (blueprint && blueprint !== prevBlueprintRef.current && prevBlueprintRef.current) {
      setFadeIn(true);
      const timer = setTimeout(() => setFadeIn(false), 400);
      return () => clearTimeout(timer);
    }
    prevBlueprintRef.current = blueprint;
  }, [blueprint]);

  const handleFiles = useCallback(
    async (files) => {
      setError("");
      setAnalyzing(true);
      setAnalysisSteps([
        {
          label: `Reading ${files.length} file${files.length > 1 ? "s" : ""}...`,
          done: false,
          active: true,
        },
        { label: "Detecting data type", done: false, active: false },
        { label: "Finding patterns across your accounts...", done: false, active: false },
        { label: "Building charts and writing your briefing", done: false, active: false },
      ]);

      try {
        let totalRows = 0;
        let lastType = "unknown";

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

          totalRows += parsed.rows.length;

          // Detect type so analyzeUpload can route rows to the correct source bucket
          const { mapping: autoMap } = autoDetectMapping(parsed.headers, parsed.rows);
          const { type: detectedType } = detectUploadType(parsed.headers, parsed.rows, autoMap);
          lastType = detectedType || "unknown";

          // Save import with skipRebuild + skipAnalysis (batch pattern)
          await importDatasets(
            {}, // empty datasets (normalized model writes rows directly)
            "", // no summary
            {
              fileName: file.name,
              type: detectedType || "unknown",
              mapping: autoMap || {},
              originalHeaders: parsed.headers,
              rowCount: parsed.rows.length,
            },
            { skipRebuild: true, skipAnalysis: true, rawRows: parsed.rows },
          );
        }

        // Step 1 done
        setAnalysisSteps((prev) =>
          prev.map((s, i) =>
            i === 0
              ? {
                  ...s,
                  label: `Read ${files.length} file${files.length > 1 ? "s" : ""} (${totalRows.toLocaleString()} rows)`,
                  done: true,
                  active: false,
                }
              : i === 1
                ? { ...s, active: true }
                : s,
          ),
        );

        // Step 2 done
        setAnalysisSteps((prev) =>
          prev.map((s, i) =>
            i === 1
              ? { ...s, label: `Identified ${lastType} data`, done: true, active: false }
              : i === 2
                ? { ...s, active: true }
                : s,
          ),
        );

        // After all files imported, trigger single analysis
        const fns = getFunctions();
        const analyzeUploadFn = httpsCallable(fns, "analyzeUpload");

        await analyzeUploadFn({ tenantId });

        // Step 3 done, step 4 active (blueprint write)
        setAnalysisSteps((prev) =>
          prev.map((s, i) =>
            i === 2
              ? { ...s, done: true, active: false }
              : i === 3
                ? { ...s, active: true }
                : s,
          ),
        );

        // Step 4 done — blueprint will arrive via real-time listener
        setAnalysisSteps((prev) => prev.map((s) => ({ ...s, done: true, active: false })));
      } catch (err) {
        console.error("[AnalysisViewer] Analysis failed:", err);
        setError(err.message || "Analysis failed. Your data is saved, try again.");
      } finally {
        setAnalyzing(false);
      }
    },
    [importDatasets, tenantId],
  );

  const handleAsk = useCallback((question) => {
    // PR 3 will wire this to chat panel
    console.log("[AnalysisViewer] Question asked:", question);
  }, []);

  // Loading state
  if (loading) return <AnalysisSkeleton steps={[]} />;

  // No data yet — empty state
  if (!hasBlueprint && !analyzing) {
    return (
      <div className="analysis-viewer__empty">
        <h1 className="analysis-viewer__empty-headline">Your AI Wine Analyst</h1>
        <p className="analysis-viewer__empty-copy">
          Drop your distributor reports — depletions from iDig, VIP, SGWS, Breakthru, RNDC,
          inventory, or accounts — and I&apos;ll build your dashboard.
        </p>
        <UploadStrip onFiles={handleFiles} hasData={false} disabled={false} />
        {error && <p className="analysis-viewer__error">{error}</p>}
      </div>
    );
  }

  // Ready state — show narrative + dashboard
  const narrative = blueprint?.narrative;
  const isReUpload = hasBlueprint && analyzing;

  return (
    <div className="analysis-viewer">
      {/* Re-upload banner */}
      {isReUpload && (
        <div className="analysis-viewer__banner" role="status">
          Re-analyzing with new data...
        </div>
      )}

      {/* Compact upload strip */}
      <UploadStrip onFiles={handleFiles} hasData={true} disabled={analyzing} />

      {error && <p className="analysis-viewer__error">{error}</p>}

      {/* Show skeleton only on first analysis (no existing blueprint) */}
      {analyzing && !hasBlueprint && <AnalysisSkeleton steps={analysisSteps} />}

      {/* Narrative + sidebar layout */}
      {hasBlueprint && (
        <div
          className={`analysis-viewer__layout ${fadeIn ? "analysis-viewer__layout--fade" : ""}`}
        >
          <div className="analysis-viewer__main">
            <NarrativeSection narrative={narrative} updatedAt={blueprint?.updatedAt} />
            <SuggestedQuestions questions={narrative?.suggestedQuestions} onAsk={handleAsk} />
          </div>
          <div className="analysis-viewer__sidebar">
            <ActionsRail actions={narrative?.actions} />
            {blueprint?.dataSources?.length > 0 && (
              <div className="analysis-viewer__sources">
                <p className="analysis-viewer__sources-label">DATA SOURCES</p>
                {blueprint.dataSources.map((ds, i) => (
                  <p key={i} className="analysis-viewer__sources-file">
                    {ds.fileName}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dashboard — existing BlueprintRenderer, zero changes */}
      {hasBlueprint && !analyzing && <BlueprintRenderer />}
    </div>
  );
}
