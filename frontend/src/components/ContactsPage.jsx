/**
 * ContactsPage — Global contact directory across all accounts.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "../context/CrmContext";
import ContactForm from "./ContactForm";

const ROLE_LABELS = {
  sommelier: "Sommelier", beverage_director: "Beverage Director",
  wine_buyer: "Wine Buyer", gm: "General Manager", owner: "Owner",
  bar_manager: "Bar Manager", purchasing: "Purchasing", other: "Other",
};

export default function ContactsPage() {
  const { contacts, accounts, createContact, updateContact, deleteContact } = useCrm();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [formAccountId, setFormAccountId] = useState("");

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.accountName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      list = list.filter((c) => c.role === roleFilter);
    }
    return list;
  }, [contacts, search, roleFilter]);

  const openAdd = () => {
    setEditContact(null);
    setFormAccountId("");
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Contacts</h2>
          <p className="page-subtitle">{contacts.length} contacts across {accounts.length} accounts</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Contact</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="table-controls">
            <input
              className="search-input"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u{1F465}"}</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#334155", marginBottom: 4 }}>No contacts yet</p>
            <p style={{ fontSize: 13 }}>Add contacts from an account detail page or click &quot;+ Add Contact&quot;.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Account</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Primary</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</td>
                  <td>{c.title || ROLE_LABELS[c.role] || formatLabel(c.role || "")}</td>
                  <td>
                    {c.accountId ? (
                      <span
                        className="acct-clickable"
                        onClick={() => navigate(`/accounts/${c.accountId}`)}
                      >
                        {c.accountName}
                      </span>
                    ) : (
                      c.accountName || "--"
                    )}
                  </td>
                  <td>{c.email || "--"}</td>
                  <td>{c.phone || "--"}</td>
                  <td>{c.isPrimary ? "\u2705" : ""}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-small btn-secondary" onClick={() => { setEditContact(c); setFormAccountId(c.accountId); setShowForm(true); }}>Edit</button>
                      <button className="btn btn-small" style={{ color: "#dc2626", background: "none", border: "none" }}
                        onClick={() => { if (window.confirm(`Remove ${c.firstName} ${c.lastName}?`)) deleteContact(c.id); }}
                      >&times;</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <ContactForm
          contact={editContact}
          accountId={editContact?.accountId || formAccountId}
          accountName={editContact?.accountName || ""}
          onSave={async (data) => {
            if (editContact) await updateContact(editContact.id, data);
            else await createContact(data);
          }}
          onClose={() => { setShowForm(false); setEditContact(null); }}
        />
      )}
    </div>
  );
}

function formatLabel(str) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
