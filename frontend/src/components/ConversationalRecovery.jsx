/**
 * ConversationalRecovery — friendly error recovery for low-confidence imports.
 *
 * When the AI mapper returns confidence < 0.70 on some columns, this component
 * shows a conversational UI asking the user to confirm uncertain mappings.
 * Corrections feed into learned mappings for future auto-detection.
 *
 * TODO-120: Conversational Error Recovery
 */

import { useState, useCallback, useMemo } from "react";

/**
 * INTERNAL_FIELDS for dropdown options (matching helpers.js)
 */
const FIELD_OPTIONS = [
  { value: "acct", label: "Account / Customer Name" },
  { value: "dist", label: "Distributor" },
  { value: "st", label: "State" },
  { value: "ch", label: "Channel" },
  { value: "sku", label: "Product / SKU" },
  { value: "qty", label: "Quantity / Volume" },
  { value: "date", label: "Date" },
  { value: "revenue", label: "Revenue / Amount" },
  { value: "stage", label: "Pipeline Stage" },
  { value: "owner", label: "Owner / Rep" },
  { value: "estValue", label: "Deal Value" },
  { value: "oh", label: "On Hand (Inventory)" },
  { value: "doh", label: "Days on Hand" },
  { value: "lastOrder", label: "Last Order Date" },
  { value: "orderCycle", label: "Order Cycle" },
  { value: "_skip", label: "Skip this column" },
];

const TYPE_OPTIONS = [
  { value: "depletion", label: "Depletion / Sales Report" },
  { value: "inventory", label: "Inventory Report" },
  { value: "purchases", label: "Purchase Orders" },
  { value: "pipeline", label: "Pipeline / Opportunities" },
  { value: "quickbooks", label: "QuickBooks / Accounting" },
  { value: "revenue", label: "Revenue Report" },
  { value: "unknown", label: "I'm not sure" },
];

export default function ConversationalRecovery({
  fileName,
  uncertainColumns,
  currentMapping,
  detectedType,
  sampleRows,
  onConfirm,
  onCancel,
}) {
  const [corrections, setCorrections] = useState({});
  const [selectedType, setSelectedType] = useState(detectedType || "unknown");
  const [step, setStep] = useState("columns"); // "columns" | "type" | "confirming"

  // Build the corrected mapping — remap column headers to new fields
  const correctedMapping = useMemo(() => {
    const result = { ...(currentMapping || {}) };
    for (const [originalField, newField] of Object.entries(corrections)) {
      const columnHeader = (currentMapping || {})[originalField];
      // Remove old field mapping
      delete result[originalField];
      // Add new field mapping (unless skipping)
      if (newField !== "_skip" && columnHeader) {
        result[newField] = columnHeader;
      }
    }
    return result;
  }, [currentMapping, corrections]);

  const handleColumnCorrection = useCallback((field, column) => {
    setCorrections((prev) => ({ ...prev, [field]: column }));
  }, []);

  const handleConfirm = useCallback(async () => {
    setStep("confirming");
    try {
      await onConfirm({
        mapping: correctedMapping,
        type: selectedType,
        corrections,
      });
    } catch (err) {
      setStep("columns");
    }
  }, [correctedMapping, selectedType, corrections, onConfirm]);

  // Sample data for column preview
  const sampleValues = useCallback(
    (column) => {
      if (!sampleRows?.length || !column) return [];
      return sampleRows
        .slice(0, 3)
        .map((row) => String(row[column] || "").slice(0, 40))
        .filter(Boolean);
    },
    [sampleRows],
  );

  if (step === "confirming") {
    return (
      <div className="conv-recovery">
        <div className="conv-recovery__message">
          <div className="conv-recovery__avatar">AI</div>
          <div className="conv-recovery__bubble">
            <p className="conv-recovery__bubble-title">Got it! Saving your corrections...</p>
            <p className="conv-recovery__bubble-subtitle">
              I'll remember this for next time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conv-recovery">
      {/* AI message */}
      <div className="conv-recovery__message">
        <div className="conv-recovery__avatar">AI</div>
        <div className="conv-recovery__bubble">
          <p className="conv-recovery__bubble-title">
            I need a little help with <span className="conv-recovery__filename">{fileName}</span>
          </p>
          <p className="conv-recovery__bubble-subtitle">
            I'm not confident about {uncertainColumns.length} column{uncertainColumns.length > 1 ? "s" : ""}.
            Can you tell me what these are?
          </p>
        </div>
      </div>

      {/* Uncertain columns */}
      <div className="conv-recovery__columns">
        {uncertainColumns.map(({ field, column, confidence }) => {
          const samples = sampleValues(column);
          return (
            <div key={field} className="conv-recovery__column-card">
              <div className="conv-recovery__column-header">
                <span className="conv-recovery__column-name">"{column}"</span>
                <span className={`conv-recovery__confidence ${confidence < 0.4 ? "conv-recovery__confidence--low" : "conv-recovery__confidence--medium"}`}>
                  {Math.round(confidence * 100)}% sure
                </span>
              </div>
              {samples.length > 0 && (
                <div className="conv-recovery__samples">
                  {samples.map((v, i) => (
                    <span key={i} className="conv-recovery__sample">{v}</span>
                  ))}
                </div>
              )}
              <select
                className="conv-recovery__select"
                value={corrections[field] || field}
                onChange={(e) => handleColumnCorrection(field, e.target.value)}
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* File type question */}
      <div className="conv-recovery__message conv-recovery__message--spaced">
        <div className="conv-recovery__avatar">AI</div>
        <div className="conv-recovery__bubble">
          <p className="conv-recovery__bubble-subtitle">What type of report is this?</p>
          <select
            className="conv-recovery__select conv-recovery__select--full"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="conv-recovery__actions">
        <button className="btn btn-primary" onClick={handleConfirm}>
          Looks good — import it
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Skip this file
        </button>
      </div>
    </div>
  );
}
