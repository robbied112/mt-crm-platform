/**
 * DataGate — wraps page content and shows EmptyState when data is missing.
 * Replaces the inline ternary checks that were scattered through App.jsx.
 */

import { useData } from "../context/DataContext";
import EmptyState, { WelcomeState } from "./EmptyState";

export default function DataGate({ dataKey, tabLabel, children }) {
  const { availability } = useData();

  // If the view needs data but has none, show contextual empty state
  // dataKey can be a string or an array (OR semantics: any key present = show content)
  if (dataKey) {
    const keys = Array.isArray(dataKey) ? dataKey : [dataKey];
    const hasData = keys.some((k) => availability[k]);
    if (!hasData) {
      const displayKey = Array.isArray(dataKey) ? dataKey[0] : dataKey;
      return <EmptyState dataKey={displayKey} tabLabel={tabLabel} />;
    }
  }

  // If there's no data at all and no specific dataKey, show welcome
  if (!dataKey && !availability.hasAnyData) {
    return <WelcomeState />;
  }

  return children;
}
