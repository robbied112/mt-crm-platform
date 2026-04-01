/**
 * Aggregation Engine — executes blueprint dataSource specs against raw data.
 *
 * Pure-function module that computes tab/section data from raw import rows
 * using declarative aggregation specs from AI-generated blueprints.
 *
 * Runs server-side during blueprint generation; results are stored in
 * Firestore computedData/{tabId} for fast frontend reads.
 */

// ─── Aggregation Functions ──────────────────────────────────────────────────

function aggSum(values) {
  let total = 0;
  for (const v of values) {
    const n = typeof v === "number" ? v : parseFloat(v);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function aggAvg(values) {
  const filtered = values.filter((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n);
  });
  if (filtered.length === 0) return 0;
  return aggSum(filtered) / filtered.length;
}

function aggMin(values) {
  let min = Infinity;
  for (const v of values) {
    const n = typeof v === "number" ? v : parseFloat(v);
    if (Number.isFinite(n) && n < min) min = n;
  }
  return min === Infinity ? 0 : min;
}

function aggMax(values) {
  let max = -Infinity;
  for (const v of values) {
    const n = typeof v === "number" ? v : parseFloat(v);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max === -Infinity ? 0 : max;
}

function aggCount(values) {
  return values.length;
}

function aggCountDistinct(values) {
  return new Set(values.filter((v) => v != null && v !== "")).size;
}

function aggMedian(values) {
  const nums = values
    .map((v) => (typeof v === "number" ? v : parseFloat(v)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

const AGG_FNS = {
  sum: aggSum,
  avg: aggAvg,
  min: aggMin,
  max: aggMax,
  count: aggCount,
  countDistinct: aggCountDistinct,
  median: aggMedian,
};

// ─── Core Engine ────────────────────────────────────────────────────────────

/**
 * Group rows by one or more fields.
 * Returns a Map of groupKey → row array.
 */
function groupByFields(rows, groupBy) {
  if (!groupBy || groupBy.length === 0) {
    return new Map([["__all__", rows]]);
  }

  const groups = new Map();
  for (const row of rows) {
    const key = groupBy.map((f) => String(row[f] ?? "")).join("|||");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

/**
 * Apply filter conditions to rows.
 * Each filter: { field, op, value }
 * Ops: eq, ne, gt, gte, lt, lte, in, contains
 */
function applyFilters(rows, filters) {
  if (!filters || filters.length === 0) return rows;

  return rows.filter((row) =>
    filters.every((f) => {
      const val = row[f.field];
      switch (f.op) {
        case "eq": return val === f.value;
        case "ne": return val !== f.value;
        case "gt": return val > f.value;
        case "gte": return val >= f.value;
        case "lt": return val < f.value;
        case "lte": return val <= f.value;
        case "in": return Array.isArray(f.value) && f.value.includes(val);
        case "contains":
          return typeof val === "string" && val.toLowerCase().includes(String(f.value).toLowerCase());
        default: return true;
      }
    })
  );
}

/**
 * Apply aggregations to a group of rows.
 * Aggregation can be a single object or an array of objects.
 * Each: { fn, field, as? }
 */
function applyAggregations(groupKey, groupRows, aggregations, groupBy) {
  const result = {};

  // Populate group dimension values from the first row
  if (groupBy && groupBy.length > 0 && groupRows.length > 0) {
    for (const field of groupBy) {
      result[field] = groupRows[0][field];
    }
  }

  const aggList = Array.isArray(aggregations) ? aggregations : [aggregations];
  for (const agg of aggList) {
    const fn = AGG_FNS[agg.fn];
    if (!fn) continue;
    const values = groupRows.map((r) => r[agg.field]);
    const outputField = agg.as || `_${agg.fn}_${agg.field}`;
    result[outputField] = fn(values);
  }

  return result;
}

/**
 * Sort rows by a field.
 * @param {object[]} rows
 * @param {{ field: string, dir?: "asc"|"desc" }} sort
 */
function sortRows(rows, sort) {
  if (!sort || !sort.field) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[sort.field];
    const vb = b[sort.field];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

/**
 * Build a case-insensitive field lookup for a row.
 * Returns the actual key name in the row that matches the requested field.
 */
function resolveField(row, field) {
  if (field in row) return field;
  const lower = field.toLowerCase().trim();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().trim() === lower) return key;
  }
  return field; // Return original (will result in undefined value)
}

/**
 * Build a field resolution map from a sample row.
 * Maps requested field names to actual row keys (case-insensitive, trimmed).
 */
function buildFieldMap(sampleRow, requestedFields) {
  const map = {};
  for (const field of requestedFields) {
    map[field] = resolveField(sampleRow, field);
  }
  return map;
}

/**
 * Compute data for a single section's dataSource spec.
 *
 * @param {object} dataSource - Blueprint section dataSource
 * @param {object} rawDataBySource - Map of source name → raw row arrays
 * @returns {object[]} Computed rows for this section
 */
function computeSection(dataSource, rawDataBySource) {
  if (!dataSource) return [];

  const { source, groupBy, aggregation, sort, limit, filter } = dataSource;

  // Select rows from the specified source.
  // Fallback: if the requested source has no rows, try _all (merged pool).
  let rows = rawDataBySource[source] || [];
  if (rows.length === 0 && rawDataBySource._all) {
    rows = rawDataBySource._all;
    if (rows.length > 0) {
      console.warn(`[aggregationEngine] Source "${source}" empty, using _all fallback (${rows.length} rows)`);
    }
  }
  if (rows.length === 0) {
    console.warn(`[aggregationEngine] No rows for source "${source}" — section will be empty`);
    return [];
  }

  // Build field resolution map from a sample row for fuzzy field matching.
  // This handles case mismatches between what Claude generates and actual column names.
  const allFields = [
    ...(groupBy || []),
    ...(Array.isArray(aggregation) ? aggregation.map((a) => a.field) : aggregation?.field ? [aggregation.field] : []),
    ...(sort?.field ? [sort.field] : []),
    ...(Array.isArray(filter) ? filter.map((f) => f.field) : []),
  ];
  const sampleRow = rows[0];
  const fieldMap = sampleRow ? buildFieldMap(sampleRow, allFields) : {};

  // Remap field references using the resolution map
  const resolvedGroupBy = groupBy?.map((f) => fieldMap[f] || f);
  const resolvedAgg = aggregation
    ? Array.isArray(aggregation)
      ? aggregation.map((a) => ({ ...a, field: fieldMap[a.field] || a.field }))
      : { ...aggregation, field: fieldMap[aggregation.field] || aggregation.field }
    : null;
  const resolvedSort = sort?.field ? { ...sort, field: fieldMap[sort.field] || sort.field } : sort;
  const resolvedFilter = Array.isArray(filter)
    ? filter.map((f) => ({ ...f, field: fieldMap[f.field] || f.field }))
    : filter;

  // Apply filters
  if (resolvedFilter) {
    rows = applyFilters(rows, Array.isArray(resolvedFilter) ? resolvedFilter : [resolvedFilter]);
  }

  // If no aggregation, just filter/sort/limit the raw rows
  if (!resolvedAgg) {
    let result = sortRows(rows, resolvedSort);
    if (limit) result = result.slice(0, limit);
    return result;
  }

  // Group and aggregate
  const groups = groupByFields(rows, resolvedGroupBy);
  const aggregated = [];

  for (const [key, groupRows] of groups) {
    aggregated.push(applyAggregations(key, groupRows, resolvedAgg, resolvedGroupBy));
  }

  // Sort and limit
  let result = sortRows(aggregated, resolvedSort);
  if (limit) result = result.slice(0, limit);

  return result;
}

/**
 * Compute data for an entire blueprint — all tabs, all sections.
 *
 * @param {object} blueprint - Full blueprint with tabs[].sections[]
 * @param {object} rawDataBySource - Map of source name → raw row arrays
 * @returns {object} Map of tabId → { sections: { sectionId → rows } }
 */
function computeBlueprint(blueprint, rawDataBySource) {
  const result = {};

  for (const tab of blueprint.tabs || []) {
    const tabData = { sections: {} };

    for (const section of tab.sections || []) {
      if (section.dataSource) {
        tabData.sections[section.id] = computeSection(section.dataSource, rawDataBySource);
      }

      // KPI rows have items with individual aggregations
      if (section.type === "kpiRow" && section.items) {
        tabData.sections[section.id] = section.items.map((item) => {
          if (!item.aggregation) return { label: item.label, value: null };
          let rows = rawDataBySource[item.aggregation.source] || [];
          if (rows.length === 0 && rawDataBySource._all) {
            rows = rawDataBySource._all;
          }
          const fn = AGG_FNS[item.aggregation.fn];
          if (!fn || rows.length === 0) return { label: item.label, value: 0, format: item.format || "number" };
          // Resolve field name with fuzzy matching
          const resolved = rows[0] ? resolveField(rows[0], item.aggregation.field) : item.aggregation.field;
          const values = rows.map((r) => r[resolved]);
          return {
            label: item.label,
            value: fn(values),
            format: item.format || "number",
          };
        });
      }

      // Grid sections have nested sub-sections
      if (section.type === "grid" && section.sections) {
        for (const sub of section.sections) {
          if (sub.dataSource) {
            tabData.sections[sub.id] = computeSection(sub.dataSource, rawDataBySource);
          }
        }
      }
    }

    result[tab.id] = tabData;
  }

  return result;
}

/**
 * Build a data profile from raw imports for sending to Claude.
 * Summarizes columns, cardinality, value ranges — NOT raw rows.
 *
 * @param {object[]} imports - Array of { fileName, fileType, headers, columnTypes, rows }
 * @returns {object} Data profile suitable for AI blueprint generation prompt
 */
function buildDataProfile(imports) {
  const profiles = [];
  const crossFileKeys = {};

  for (const imp of imports) {
    const profile = {
      fileName: imp.fileName,
      fileType: imp.fileType || "unknown",
      rowCount: imp.rows ? imp.rows.length : imp.rowCount || 0,
      headers: imp.headers || [],
      columns: {},
    };

    if (imp.rows && imp.rows.length > 0) {
      for (const header of profile.headers) {
        const values = imp.rows.map((r) => r[header]).filter((v) => v != null && v !== "");
        const numericValues = values
          .map((v) => (typeof v === "number" ? v : parseFloat(v)))
          .filter(Number.isFinite);

        const col = {
          nonNullCount: values.length,
          cardinality: new Set(values.map(String)).size,
          samples: [...new Set(values.map(String))].slice(0, 5),
        };

        if (numericValues.length > values.length * 0.5) {
          col.dataType = "number";
          col.min = Math.min(...numericValues);
          col.max = Math.max(...numericValues);
          col.sum = numericValues.reduce((a, b) => a + b, 0);
          col.mean = col.sum / numericValues.length;
        } else {
          col.dataType = "string";
        }

        // Track semantic type from columnTypes if available
        if (imp.columnTypes && imp.columnTypes[header]) {
          col.semantic = imp.columnTypes[header].semantic || imp.columnTypes[header].field;
        }

        profile.columns[header] = col;

        // Track cross-file join candidates (low cardinality string fields)
        if (col.dataType === "string" && col.cardinality > 1 && col.cardinality < values.length * 0.3) {
          const key = col.semantic || header.toLowerCase().replace(/\s+/g, "_");
          if (!crossFileKeys[key]) crossFileKeys[key] = { files: [], valueOverlap: {} };
          crossFileKeys[key].files.push(imp.fileName);
          for (const v of col.samples) {
            crossFileKeys[key].valueOverlap[v] = (crossFileKeys[key].valueOverlap[v] || 0) + 1;
          }
        }
      }
    }

    profiles.push(profile);
  }

  // Compute cross-file join quality
  const crossFileJoins = [];
  for (const [key, info] of Object.entries(crossFileKeys)) {
    if (info.files.length > 1) {
      const overlapCount = Object.values(info.valueOverlap).filter((c) => c > 1).length;
      const totalValues = Object.keys(info.valueOverlap).length;
      crossFileJoins.push({
        key,
        files: [...new Set(info.files)],
        overlapPct: totalValues > 0 ? Math.round((overlapCount / totalValues) * 100) : 0,
      });
    }
  }

  return { imports: profiles, crossFileJoins };
}

/**
 * Extract unique filter values from raw data for a given blueprint filter definition.
 *
 * @param {object} filterDef - Blueprint globalFilter definition
 * @param {object} rawDataBySource - Map of source → rows
 * @returns {string[]} Sorted unique values
 */
function extractFilterValues(filterDef, rawDataBySource) {
  const values = new Set();
  for (const rows of Object.values(rawDataBySource)) {
    for (const row of rows) {
      const val = row[filterDef.sourceColumn];
      if (val != null && val !== "") values.add(String(val));
    }
  }
  return [...values].sort();
}

module.exports = {
  // Core computation
  computeSection,
  computeBlueprint,

  // Profile building
  buildDataProfile,

  // Utilities
  groupByFields,
  applyFilters,
  applyAggregations,
  sortRows,
  extractFilterValues,

  // Individual aggregation functions (for testing)
  AGG_FNS,
};
