/**
 * GridSection — renders a CSS grid layout of sub-sections.
 */
import SectionRenderer from "../SectionRenderer";

export default function GridSection({ section }) {
  if (!section.sections || section.sections.length === 0) return null;

  const colCount = Math.min(section.sections.length, 3);

  return (
    <div
      className="blueprint-section blueprint-section--grid"
      style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
    >
      {section.sections.map((sub) => (
        <SectionRenderer key={sub.id} section={sub} />
      ))}
    </div>
  );
}
