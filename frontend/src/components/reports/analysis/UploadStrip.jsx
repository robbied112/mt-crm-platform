/**
 * UploadStrip — compact upload zone for AI Analyst.
 *
 * Compact single-line strip when data exists ("Add more reports"),
 * or full empty-state prompt ("Drop your first reports here").
 */

import { useState, useCallback, useRef } from "react";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".tsv"];

function filterValidFiles(files) {
  return files.filter((f) => {
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  });
}

export default function UploadStrip({ onFiles, hasData, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const valid = filterValidFiles(Array.from(e.dataTransfer.files));
    if (valid.length > 0) onFiles(valid);
  }, [onFiles, disabled]);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const className = [
    "upload-strip",
    hasData ? "upload-strip--compact" : "",
    dragOver ? "upload-strip--drag-over" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Upload distributor reports"
      aria-disabled={disabled || undefined}
    >
      <span className="upload-strip__icon" aria-hidden="true">+</span>
      <span className="upload-strip__text">
        {hasData ? "Add more reports" : "Drop your first reports here"}
      </span>
      {!hasData && (
        <span className="upload-strip__hint">
          Excel, CSV — iDig, VIP, SGWS, Breakthru, RNDC, inventory, accounts
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.tsv"
        multiple
        onChange={(e) => {
          if (!disabled && e.target.files.length > 0) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
