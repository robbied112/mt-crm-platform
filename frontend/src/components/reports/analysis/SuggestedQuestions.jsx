/**
 * SuggestedQuestions — interactive question chips + free-form input for AI Analyst.
 *
 * Questions are real <button> elements with hover/focus states.
 * onClick calls onAsk(question) which triggers AskPanel.
 * Also includes a text input for custom questions.
 */

import { useState } from "react";

const DEFAULT_QUESTIONS = [
  "How are my top accounts performing?",
  "Which distributors need attention?",
  "What trends do you see in my data?",
];

export default function SuggestedQuestions({ questions, onAsk }) {
  const [customQ, setCustomQ] = useState("");
  const displayQuestions = questions?.length > 0 ? questions : DEFAULT_QUESTIONS;

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

      <div className="suggested-questions__list">
        {displayQuestions.map((q, i) => (
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
