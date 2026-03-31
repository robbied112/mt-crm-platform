/**
 * AnalysisSkeleton — step-based loading indicator for AI analysis.
 *
 * Shows a progress list with checkmarks, active dots, and pending dots
 * instead of a generic spinner.
 */

export default function AnalysisSkeleton({ steps }) {
  // Fallback to generic steps if none provided
  const displaySteps = steps?.length > 0 ? steps : [
    { label: "Reading files...", done: false, active: true },
    { label: "Detecting data type", done: false, active: false },
    { label: "Finding patterns across your accounts...", done: false, active: false },
    { label: "Building charts and writing your briefing", done: false, active: false },
  ];

  return (
    <div className="analysis-skeleton" aria-label="Analysis in progress" role="status">
      <ol className="analysis-skeleton__list">
        {displaySteps.map((step, i) => {
          let stateClass = "";
          if (step.done) stateClass = "analysis-skeleton__step--done";
          else if (step.active) stateClass = "analysis-skeleton__step--active";

          return (
            <li key={i} className={`analysis-skeleton__step ${stateClass}`}>
              <span className="analysis-skeleton__indicator" aria-hidden="true">
                {step.done ? "\u2713" : ""}
              </span>
              <span className="analysis-skeleton__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
