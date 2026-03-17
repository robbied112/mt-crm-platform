/**
 * WineList — wine catalog extracted from billback imports.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function WineList({ wines = [] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = wines;
    if (q) {
      list = list.filter(
        (w) =>
          (w.name || "").toLowerCase().includes(q) ||
          (w.producer || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sortBy] || "";
      const bv = b[sortBy] || "";
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [wines, search, sortBy, sortDir]);

  if (!wines.length) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#127863;</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>
          No wines found
        </h3>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          Wines are automatically extracted when you import billback PDFs.
        </p>
      </div>
    );
  }

  const sortIcon = (col) =>
    sortBy === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Wines</h3>
          <span style={{ background: "#FDF8F0", color: "#6B1E1E", padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
            {wines.length}
          </span>
        </div>
        <input
          type="text"
          placeholder="Search wines or producers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.searchInput}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: "#FDF8F0" }}>
              <th style={{ ...s.th, cursor: "pointer" }} onClick={() => toggleSort("name")}>
                Name{sortIcon("name")}
              </th>
              <th style={{ ...s.th, cursor: "pointer" }} onClick={() => toggleSort("producer")}>
                Producer{sortIcon("producer")}
              </th>
              <th style={{ ...s.th, cursor: "pointer" }} onClick={() => toggleSort("vintage")}>
                Vintage{sortIcon("vintage")}
              </th>
              <th style={s.th}>Distributors</th>
              <th style={s.th}>First Seen</th>
              <th style={s.th}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((wine) => (
              <tr
                key={wine.id}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onClick={() => navigate(`/wines/${wine.id}`)}
              >
                <td style={{ ...s.td, fontWeight: 600, color: "#6B1E1E" }}>{wine.displayName || wine.name}</td>
                <td style={s.td}>{wine.producer || "--"}</td>
                <td style={s.td}>
                  {wine.vintage ? (
                    <span style={{ background: "#FDF8F0", color: "#6B1E1E", padding: "1px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                      {wine.vintage}
                    </span>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>--</span>
                  )}
                </td>
                <td style={{ ...s.td, fontSize: 11, color: "#6B7280" }}>
                  {wine.metadata?.distributors?.join(", ") || "--"}
                </td>
                <td style={{ ...s.td, fontSize: 11, color: "#9CA3AF" }}>
                  {wine.firstSeen?.toDate?.()?.toLocaleDateString?.() || "--"}
                </td>
                <td style={{ ...s.td, fontSize: 11, color: "#9CA3AF" }}>
                  {wine.lastSeen?.toDate?.()?.toLocaleDateString?.() || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  emptyState: {
    textAlign: "center",
    padding: 48,
    background: "#FDF8F0",
    borderRadius: 12,
    border: "1px solid #E5E0DA",
  },
  searchInput: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    minWidth: 220,
    background: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "8px 10px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    color: "#6B7280",
    letterSpacing: "0.3px",
  },
  td: {
    padding: "8px 10px",
  },
};
