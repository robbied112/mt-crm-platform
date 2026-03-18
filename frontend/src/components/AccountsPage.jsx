/**
 * AccountsPage — searchable, filterable list of all CRM accounts.
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import { useData } from "../context/DataContext";
import { useTeam } from "../context/TeamContext";
import AccountForm from "./AccountForm";

const PAGE_SIZE = 50;
const STATUS_COLORS = {
  active: "badge-green",
  prospect: "badge-blue",
  inactive: "badge-yellow",
  churned: "badge-orange",
};

export default function AccountsPage() {
  const { accounts, createAccount, updateAccount, deleteAccount } = useCrm();
  const { tenantConfig } = useData();
  const { members, memberMap } = useTeam();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, accountId }

  const filtered = useMemo(() => {
    let list = accounts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.distributorName?.toLowerCase().includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.buyerName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (typeFilter !== "all") {
      list = list.filter((a) => a.type === typeFilter);
    }
    if (ownerFilter !== "all") {
      list = list.filter((a) => a.ownerId === ownerFilter);
    }
    list = [...list].sort((a, b) => {
      const va = (a[sortKey] || "").toString().toLowerCase();
      const vb = (b[sortKey] || "").toString().toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [accounts, search, statusFilter, typeFilter, ownerFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }, [sortKey]);

  const handleSave = async (data) => {
    if (editAccount) {
      await updateAccount(editAccount.id, data);
    } else {
      await createAccount(data);
    }
  };

  const handleEdit = (e, acct) => {
    e.stopPropagation();
    setEditAccount(acct);
    setShowForm(true);
  };

  const sortArrow = (key) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const handleContextMenu = (e, accountId) => {
    if (members.length <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, accountId });
  };

  const handleAssignRep = async (uid) => {
    if (contextMenu) {
      await updateAccount(contextMenu.accountId, { ownerId: uid || null });
    }
    setContextMenu(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Accounts</h2>
          <p className="page-subtitle">{accounts.length} total accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditAccount(null); setShowForm(true); }}>
          + Add Account
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-controls">
            <input
              className="search-input"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
            <select className="form-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
              <option value="churned">Churned</option>
            </select>
            <select className="form-input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
              <option value="all">All Types</option>
              {(tenantConfig?.accountTypes || ["on-premise", "off-premise", "hybrid"]).map((t) => (
                <option key={t} value={t}>{formatLabel(t)}</option>
              ))}
            </select>
            {members.length > 1 && (
              <select className="form-input" value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setPage(0); }}>
                <option value="all">All Owners</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>{m.displayName || m.email?.split("@")[0]}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {pageData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#6B6B6B" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u{1F4CB}"}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#2E2E2E", marginBottom: 4 }}>No accounts yet</p>
            <p style={{ fontSize: 13 }}>Click &quot;+ Add Account&quot; to create your first account.</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort("name")}>Name{sortArrow("name")}</th>
                  <th className="sortable" onClick={() => toggleSort("type")}>Type{sortArrow("type")}</th>
                  <th className="sortable" onClick={() => toggleSort("status")}>Status{sortArrow("status")}</th>
                  <th className="sortable" onClick={() => toggleSort("distributorName")}>Distributor{sortArrow("distributorName")}</th>
                  <th className="sortable" onClick={() => toggleSort("state")}>State{sortArrow("state")}</th>
                  <th className="sortable" onClick={() => toggleSort("wineProgram")}>Wine Program{sortArrow("wineProgram")}</th>
                  {members.length > 1 && <th>Owner</th>}
                  <th>Tags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((acct) => (
                  <tr
                    key={acct.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/accounts/${acct.id}`)}
                  >
                    <td
                      style={{ fontWeight: 600, color: "var(--accent)" }}
                      onContextMenu={(e) => handleContextMenu(e, acct.id)}
                    >{acct.name}</td>
                    <td>{formatLabel(acct.type || "")}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[acct.status] || "badge-blue"}`}>
                        {formatLabel(acct.status || "prospect")}
                      </span>
                    </td>
                    <td>{acct.distributorName || "--"}</td>
                    <td>{acct.state || "--"}</td>
                    <td>{formatLabel(acct.wineProgram || "none")}</td>
                    {members.length > 1 && (
                      <td>
                        {acct.ownerId ? (
                          <span style={{ fontSize: 12, color: "#2E2E2E" }}>{memberMap[acct.ownerId] || "—"}</span>
                        ) : (
                          <span style={{ fontSize: 11, padding: "2px 8px", background: "rgba(192, 123, 1, 0.1)", color: "#C07B01", borderRadius: 10, fontWeight: 600 }}>Unassigned</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(acct.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className="myacct-tag-sm">{t}</span>
                        ))}
                        {(acct.tags || []).length > 3 && (
                          <span className="myacct-tag-sm">+{acct.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-small btn-secondary" onClick={(e) => handleEdit(e, acct)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 0" }}>
                <button className="btn btn-small btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
                <span style={{ fontSize: 13, color: "#6B6B6B", lineHeight: "28px" }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button className="btn btn-small btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {contextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setContextMenu(null)}
          />
          <div style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
            background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            padding: "4px 0", minWidth: 180,
          }}>
            <div style={{ padding: "6px 12px", fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Assign to Rep
            </div>
            <div
              style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#C07B01" }}
              onClick={() => handleAssignRep(null)}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F5EDE3"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              Unassign
            </div>
            {members.map((m) => (
              <div
                key={m.uid}
                style={{ padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#2E2E2E" }}
                onClick={() => handleAssignRep(m.uid)}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F5EDE3"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {m.displayName || m.email?.split("@")[0]}
                {m.role ? ` (${m.role})` : ""}
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <AccountForm
          account={editAccount}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditAccount(null); }}
        />
      )}
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
