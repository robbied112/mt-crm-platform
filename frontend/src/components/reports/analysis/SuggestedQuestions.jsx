/**
 * SuggestedQuestions — interactive question chips + free-form input for AI Analyst.
 *
 * Questions are real <button> elements with hover/focus states.
 * onClick calls onAsk(question) which triggers AskPanel.
 * Also includes a text input for custom questions.
 */

import { useState } from "react";

export default function SuggestedQuestions({ questions, onAsk }) {
  const [customQ, setCustomQ] = useState("");

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customQ.trim()) {
      onAsk?.(customQ.trim());
      setCustomQ("");
    }
  };

  return (
    <div className="suggested-questions">
      <p className="suggested-questions__label">ASK ABOUT YOUR DATA</p>

      {questions?.length > 0 && (
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
      )}

      <form className="suggested-questions__custom" onSubmit={handleCustomSubmit}>
        <input
          className="suggested-questions__input"
          type="text"
          value={customQ}
          onChange={(e) => setCustomQ(e.target.value)}
          placeholder="Or type your own question..."
          maxLength={500}
          aria-label="Type a custom question about your data"
        />
        <button
          className="suggested-questions__submit"
          type="submit"
          disabled={!customQ.trim()}
          aria-label="Ask question"
        >
          Ask &rarr;
        </button>
      </form>
    </div>
  );
}
