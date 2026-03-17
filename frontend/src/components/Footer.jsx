/**
 * Footer component
 * Extracted from index.html lines 2217-2219.
 */

export default function Footer({ companyName, dataThrough }) {
  return (
    <footer role="contentinfo">
      <span>{companyName || "CruFolio"}</span>
      {dataThrough && <> - Data through: <span>{dataThrough}</span></>}
    </footer>
  );
}
