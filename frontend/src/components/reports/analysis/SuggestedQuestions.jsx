/**
 * SuggestedQuestions — interactive question chips for AI Analyst.
 *
 * Questions are real <button> elements with hover/focus states.
 * onClick calls onAsk(question) — PR 3 will wire this to chat.
 */

export default function SuggestedQuestions({ questions, onAsk }) {
  if (!questions?.length) return null;

  return (
    <div className="suggested-questions">
      <p className="suggested-questions__label">ASK ABOUT YOUR DATA</p>
      <div className="suggested-questions__list">
        {questions.map((q, i) => (
          <button
            key={i}
            className="suggested-questions__item"
            onClick={() => onAsk?.(q)}
            type="button"
          >
            <span className="suggested-questions__text">{q}</span>
            <span className="suggested-questions__arrow" aria-hidden="true">&rarr;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
