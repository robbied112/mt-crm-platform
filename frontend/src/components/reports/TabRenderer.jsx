/**
 * TabRenderer — renders all sections within a blueprint tab.
 */
import SectionRenderer from "./SectionRenderer";

export default function TabRenderer({ tab }) {
  if (!tab || !tab.sections) return null;

  return (
    <div className="blueprint-tab-content">
      {tab.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </div>
  );
}
