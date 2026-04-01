/**
 * AskPanel — inline Q&A conversation with the AI Wine Analyst.
 *
 * Shows conversation history and a text input. Questions can come from
 * SuggestedQuestions clicks or typed directly. Answers stream in from
 * the askAnalyst Cloud Function.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "../../../context/AuthContext";

// Bold-text formatting adapted from NarrativeSection
function parseInlineFormatting(text) {
  if (!text) return text;
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function AskPanel({ initialQuestion, onQuestionAsked }) {
  const { tenantId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Handle initial question from SuggestedQuestions click
  useEffect(() => {
    if (initialQuestion && !loading) {
      askQuestion(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const askQuestion = useCallback(
    async (question) => {
      if (!question?.trim() || loading) return;

      setError("");
      const userMsg = { role: "user", content: question.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      onQuestionAsked?.();

      try {
        const fns = getFunctions();
        const askAnalystFn = httpsCallable(fns, "askAnalyst");
        const result = await askAnalystFn({
          tenantId,
          question: question.trim(),
          history: historyRef.current,
        });

        const assistantMsg = { role: "assistant", content: result.data.answer };
        setMessages((prev) => [...prev, assistantMsg]);

        // Update history ref for next call
        historyRef.current = [...historyRef.current, userMsg, assistantMsg];
      } catch (err) {
        const msg =
          err?.code === "functions/resource-exhausted"
            ? "You've asked a lot of questions — take a breather and try again in a few minutes."
            : "Something went wrong. Try asking again.";
        setError(msg);
        // Remove the user message on error so they can retry
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [tenantId, loading, onQuestionAsked]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    askQuestion(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion(input);
    }
  };

  if (messages.length === 0 && !loading) return null;

  return (
    <div className="ask-panel">
      <div className="ask-panel__messages" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ask-panel__message ask-panel__message--${msg.role}`}
          >
            {msg.role === "assistant" && (
              <span className="ask-panel__avatar" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1.5" />
                </svg>
              </span>
            )}
            <div className="ask-panel__bubble">
              {msg.role === "assistant"
                ? parseInlineFormatting(msg.content)
                : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ask-panel__message ask-panel__message--assistant">
            <span className="ask-panel__avatar" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 1.5" />
              </svg>
            </span>
            <div className="ask-panel__bubble ask-panel__bubble--loading">
              <span className="ask-panel__dot" />
              <span className="ask-panel__dot" />
              <span className="ask-panel__dot" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="ask-panel__error">{error}</p>}

      <form className="ask-panel__input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="ask-panel__input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data..."
          disabled={loading}
          maxLength={500}
          aria-label="Ask a question about your data"
        />
        <button
          className="ask-panel__send"
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9h12M11 5l4 4-4 4" />
          </svg>
        </button>
      </form>
    </div>
  );
}
