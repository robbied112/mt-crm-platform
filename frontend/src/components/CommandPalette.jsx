/**
 * CommandPalette — ⌘K search overlay for navigation, accounts, and actions.
 * Lightweight, no external dependencies.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../config/routes";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";

function fuzzyMatch(query, text) {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple character-by-character fuzzy
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="cmdpal__highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { distScorecard, accountsTop, pipelineAccounts, availability, tenantConfig } = useData();
  const { isAdmin, logout } = useAuth();

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items
  const items = useMemo(() => {
    const results = [];

    // Navigation
    ROUTES.forEach((route) => {
      if (route.hidden) return;
      if (route.adminOnly && !isAdmin) return;
      if (route.section === "billbacks" && !tenantConfig?.features?.billbacks) return;
      results.push({
        id: `nav-${route.key}`,
        group: "Navigation",
        label: route.label,
        description: route.description,
        icon: "nav",
        action: () => navigate(route.path),
      });
    });

    // Accounts from data
    if (availability?.accounts) {
      const seen = new Set();
      accountsTop.slice(0, 50).forEach((a) => {
        if (seen.has(a.acct)) return;
        seen.add(a.acct);
        results.push({
          id: `acct-${a.acct}`,
          group: "Accounts",
          label: a.acct,
          description: a.st ? `${a.st} — ${(a.ce || 0).toFixed(0)} CE` : "",
          icon: "account",
          action: () => navigate("/accounts"),
        });
      });
    }

    // Distributors
    if (availability?.depletions) {
      const seen = new Set();
      distScorecard.slice(0, 30).forEach((d) => {
        if (seen.has(d.name)) return;
        seen.add(d.name);
        results.push({
          id: `dist-${d.name}`,
          group: "Distributors",
          label: d.name,
          description: d.st || "",
          icon: "distributor",
          action: () => navigate("/distributors"),
        });
      });
    }

    // Pipeline
    if (availability?.pipeline) {
      const seen = new Set();
      pipelineAccounts.slice(0, 30).forEach((p) => {
        if (seen.has(p.acct)) return;
        seen.add(p.acct);
        results.push({
          id: `pipe-${p.acct}`,
          group: "Pipeline",
          label: p.acct,
          description: p.stage || "",
          icon: "pipeline",
          action: () => navigate("/pipeline"),
        });
      });
    }

    // Quick actions
    if (isAdmin) {
      results.push({
        id: "action-upload",
        group: "Actions",
        label: "Upload Data",
        description: "Import CSV, Excel, or QuickBooks files",
        icon: "action",
        action: () => navigate("/settings"),
      });
    }
    results.push({
      id: "action-logout",
      group: "Actions",
      label: "Sign Out",
      description: "Log out of your account",
      icon: "action",
      action: () => logout(),
    });

    return results;
  }, [navigate, isAdmin, accountsTop, distScorecard, pipelineAccounts, availability, logout]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show nav + actions when no query
      return items.filter((i) => i.group === "Navigation" || i.group === "Actions");
    }
    return items.filter((i) => fuzzyMatch(query, i.label) || fuzzyMatch(query, i.description || ""));
  }, [items, query]);

  // Group results
  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach((item) => {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    });
    return groups;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const list = [];
    grouped.forEach((items) => list.push(...items));
    return list;
  }, [grouped]);

  // Clamp selection
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(flatList.length - 1, 0)));
  }, [flatList.length]);

  const executeItem = useCallback((item) => {
    onClose();
    item.action();
  }, [onClose]);

  // Keyboard handling
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatList[selectedIndex]) executeItem(flatList[selectedIndex]);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatList, selectedIndex, executeItem, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(".cmdpal__item--selected");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  let flatIdx = -1;

  return (
    <div className="cmdpal__overlay" onClick={onClose}>
      <div className="cmdpal" onClick={(e) => e.stopPropagation()}>
        <div className="cmdpal__input-row">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="8" r="5" />
            <path d="M12 12l4 4" />
          </svg>
          <input
            ref={inputRef}
            className="cmdpal__input"
            type="text"
            placeholder="Search pages, accounts, distributors..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmdpal__esc">ESC</kbd>
        </div>

        <div className="cmdpal__results" ref={listRef}>
          {flatList.length === 0 && (
            <div className="cmdpal__empty">No results for "{query}"</div>
          )}
          {Array.from(grouped.entries()).map(([group, groupItems]) => (
            <div key={group} className="cmdpal__group">
              <div className="cmdpal__group-label">{group}</div>
              {groupItems.map((item) => {
                flatIdx++;
                const idx = flatIdx;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    className={`cmdpal__item ${isSelected ? "cmdpal__item--selected" : ""}`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="cmdpal__item-content">
                      <span className="cmdpal__item-label">{highlightMatch(item.label, query)}</span>
                      {item.description && (
                        <span className="cmdpal__item-desc">{item.description}</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="cmdpal__item-hint">↵</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
