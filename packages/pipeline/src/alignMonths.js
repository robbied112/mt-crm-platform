/**
 * Temporal month alignment — aligns _months arrays across imports
 * that may cover different time periods.
 *
 * When multiple files are combined, their _months arrays are positional
 * (index 0, 1, 2...) not temporal ("Nov 2025", "Dec 2025"...).
 * This module parses month labels from column headers and re-indexes
 * rows onto a unified chronological axis.
 */

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a month label string into { year, month } or null.
 *
 * Supported formats:
 *   "Nov 2025", "November 2025", "Nov-25", "Jan-26",
 *   "Nov2025", "11/2025", "2025-11",
 *   "Case Equivs [1M Dec 2025]", "Cases [1M Jan 2026]"
 *
 * @param {string} label - Column header string
 * @returns {{ year: number, month: number } | null}
 */
function parseMonthLabel(label) {
  if (!label || typeof label !== "string") return null;

  const s = label.trim();

  // Extract from pivot period brackets: "Case Equivs [1M Dec 2025]"
  const bracketMatch = s.match(/\[1M\s+([A-Za-z]+)\s+(\d{4})\]/);
  if (bracketMatch) {
    const month = MONTH_NAMES[bracketMatch[1].toLowerCase()];
    const year = parseInt(bracketMatch[2], 10);
    if (month !== undefined && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  // "Nov 2025", "November 2025", "Nov-2025", "Nov2025"
  const monthYearFull = s.match(/^([A-Za-z]+)[\s\-]?(\d{4})$/);
  if (monthYearFull) {
    const month = MONTH_NAMES[monthYearFull[1].toLowerCase()];
    const year = parseInt(monthYearFull[2], 10);
    if (month !== undefined && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  // "Nov-25", "Jan-26" (2-digit year)
  const monthYearShort = s.match(/^([A-Za-z]+)[\s\-](\d{2})$/);
  if (monthYearShort) {
    const month = MONTH_NAMES[monthYearShort[1].toLowerCase()];
    let year = parseInt(monthYearShort[2], 10);
    if (month !== undefined && year >= 0 && year <= 99) {
      year += year < 50 ? 2000 : 1900;
      return { year, month };
    }
  }

  // "11/2025" or "2025-11"
  const numericSlash = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (numericSlash) {
    const month = parseInt(numericSlash[1], 10) - 1;
    const year = parseInt(numericSlash[2], 10);
    if (month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  const numericDash = s.match(/^(\d{4})-(\d{1,2})$/);
  if (numericDash) {
    const year = parseInt(numericDash[1], 10);
    const month = parseInt(numericDash[2], 10) - 1;
    if (month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
      return { year, month };
    }
  }

  return null;
}

/**
 * Convert { year, month } to a sortable key and display label.
 */
function monthKey(ym) {
  return ym.year * 12 + ym.month;
}

function monthLabel(ym) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[ym.month]} ${ym.year}`;
}

/**
 * Build a unified chronological axis from rows with _monthLabels,
 * then re-index each row's _months to align with that axis.
 *
 * Per-import fallback: rows are grouped by their _monthLabels signature.
 * If an import group has <50% parseable labels, it uses positional indexing
 * (appended at the end of the axis) so one bad file doesn't poison others.
 *
 * @param {object[]} rows - Normalized rows with _months and _monthLabels
 * @returns {{ axis: string[], rows: object[] }}
 */
function buildUnifiedAxis(rows) {
  if (!rows || rows.length === 0) return { axis: [], rows: [] };

  // Check if any rows have _monthLabels
  const hasLabels = rows.some((r) => Array.isArray(r._monthLabels) && r._monthLabels.length > 0);
  if (!hasLabels) {
    // No labels at all — return as-is (positional, current behavior)
    return { axis: [], rows };
  }

  // Group rows by their _monthLabels signature (same labels = same import file)
  const groups = new Map();
  for (const row of rows) {
    const sig = Array.isArray(row._monthLabels) ? row._monthLabels.join("||") : "__no_labels__";
    if (!groups.has(sig)) groups.set(sig, { labels: row._monthLabels || [], rows: [] });
    groups.get(sig).rows.push(row);
  }

  // Parse each group's labels and classify as parseable or positional
  const parseableGroups = [];
  const positionalGroups = [];

  for (const [, group] of groups) {
    if (!group.labels.length) {
      positionalGroups.push(group);
      continue;
    }

    const parsed = group.labels.map(parseMonthLabel);
    const parseableCount = parsed.filter((p) => p !== null).length;

    if (parseableCount / group.labels.length >= 0.5) {
      parseableGroups.push({ ...group, parsed });
    } else {
      positionalGroups.push(group);
    }
  }

  // Build the unified axis from parseable groups
  const axisMap = new Map(); // monthKey → { year, month }
  for (const group of parseableGroups) {
    for (const p of group.parsed) {
      if (p) {
        const key = monthKey(p);
        if (!axisMap.has(key)) axisMap.set(key, p);
      }
    }
  }

  // Sort chronologically
  const sortedKeys = [...axisMap.keys()].sort((a, b) => a - b);

  // Append positional slots for unparseable groups
  let positionalOffset = sortedKeys.length;
  const positionalSlots = new Map(); // group sig → starting index
  for (const group of positionalGroups) {
    const maxMonths = group.rows.reduce((m, r) =>
      Math.max(m, Array.isArray(r._months) ? r._months.length : 0), 0);
    if (maxMonths > 0) {
      positionalSlots.set(group, positionalOffset);
      positionalOffset += maxMonths;
    }
  }

  const totalSlots = positionalOffset;
  const axis = sortedKeys.map((k) => monthLabel(axisMap.get(k)));
  // Add generic labels for positional slots
  for (const group of positionalGroups) {
    const maxMonths = group.rows.reduce((m, r) =>
      Math.max(m, Array.isArray(r._months) ? r._months.length : 0), 0);
    for (let i = 0; i < maxMonths; i++) {
      axis.push(`M${axis.length + 1}`);
    }
  }

  // Re-index all rows
  const reindexed = [];
  for (const group of parseableGroups) {
    // Build index map: original position → unified axis position
    const indexMap = [];
    for (let i = 0; i < group.parsed.length; i++) {
      if (group.parsed[i]) {
        const key = monthKey(group.parsed[i]);
        const axisIdx = sortedKeys.indexOf(key);
        indexMap.push(axisIdx);
      } else {
        indexMap.push(-1); // unparseable individual label — zero out
      }
    }

    for (const row of group.rows) {
      const newMonths = new Array(totalSlots).fill(0);
      if (Array.isArray(row._months)) {
        for (let i = 0; i < row._months.length; i++) {
          if (i < indexMap.length && indexMap[i] >= 0) {
            newMonths[indexMap[i]] = row._months[i];
          }
        }
      }
      reindexed.push({ ...row, _months: newMonths, _monthLabels: undefined });
    }
  }

  for (const group of positionalGroups) {
    const offset = positionalSlots.get(group) || 0;
    for (const row of group.rows) {
      const newMonths = new Array(totalSlots).fill(0);
      if (Array.isArray(row._months)) {
        for (let i = 0; i < row._months.length; i++) {
          newMonths[offset + i] = row._months[i];
        }
      }
      reindexed.push({ ...row, _months: newMonths, _monthLabels: undefined });
    }
  }

  return { axis, rows: reindexed };
}

module.exports = {
  parseMonthLabel,
  buildUnifiedAxis,
  // Exported for testing
  monthKey,
  monthLabel,
};
