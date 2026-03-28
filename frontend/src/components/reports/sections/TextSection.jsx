/**
 * TextSection — renders AI-generated narrative text from blueprint spec.
 */

export default function TextSection({ section }) {
  if (!section.content) return null;

  return (
    <div className="blueprint-section blueprint-section--text">
      {section.title && <h3>{section.title}</h3>}
      <p className="blueprint-text-content">{section.content}</p>
    </div>
  );
}
