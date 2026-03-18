/**
 * CRM Context — provides accounts, contacts, activities, tasks,
 * opportunities, and products with real-time Firestore listeners and CRUD.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeAccounts, subscribeContacts, subscribeActivities, subscribeTasks,
  subscribeOpportunities, subscribeProducts,
  createAccount as _createAccount, updateAccount as _updateAccount, deleteAccount as _deleteAccount,
  createContact as _createContact, updateContact as _updateContact, deleteContact as _deleteContact,
  logActivity as _logActivity, deleteActivity as _deleteActivity,
  createTask as _createTask, updateTask as _updateTask, deleteTask as _deleteTask,
  createOpportunity as _createOpportunity, updateOpportunity as _updateOpportunity, deleteOpportunity as _deleteOpportunity,
  createProduct as _createProduct, updateProduct as _updateProduct, deleteProduct as _deleteProduct,
  loadNotes, addNote as _addNote, deleteNote as _deleteNote,
} from "../services/crmService";
import TENANT_CONFIG from "../config/tenant";

const CrmContext = createContext(null);

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used within CrmProvider");
  return ctx;
}

export default function CrmProvider({ children }) {
  const { tenantId, currentUser } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real-time listeners
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let loadCount = 0;
    const total = 6;
    const checkLoaded = () => { if (++loadCount >= total) setLoading(false); };

    const unsubs = [
      subscribeAccounts(tenantId, (data) => { setAccounts(data); checkLoaded(); }, checkLoaded),
      subscribeContacts(tenantId, (data) => { setContacts(data); checkLoaded(); }, checkLoaded),
      subscribeActivities(tenantId, (data) => { setActivities(data); checkLoaded(); }, checkLoaded),
      subscribeTasks(tenantId, (data) => { setTasks(data); checkLoaded(); }, checkLoaded),
      subscribeOpportunities(tenantId, (data) => { setOpportunities(data); checkLoaded(); }, checkLoaded),
      subscribeProducts(tenantId, (data) => { setProducts(data); checkLoaded(); }, checkLoaded),
    ];

    return () => unsubs.forEach((u) => u());
  }, [tenantId]);

  // ─── Opportunity type helpers ───────────────────────────────

  const oppTypes = TENANT_CONFIG.opportunityTypes || [];

  const getStagesForType = useCallback((typeKey) => {
    const type = oppTypes.find((t) => t.key === typeKey);
    return type ? type.stages : ["Identified", "Won", "Lost"];
  }, [oppTypes]);

  const getDefaultValueForType = useCallback((typeKey) => {
    const type = oppTypes.find((t) => t.key === typeKey);
    return type ? type.defaultValue : 0;
  }, [oppTypes]);

  // ─── Account CRUD ─────────────────────────────────────────

  const createAccount = useCallback(async (data) => {
    return _createAccount(tenantId, {
      ...data,
      createdBy: currentUser?.uid,
      ownerId: data.ownerId || currentUser?.uid || null,
    });
  }, [tenantId, currentUser]);

  const updateAccount = useCallback(async (id, patch) => {
    return _updateAccount(tenantId, id, patch);
  }, [tenantId]);

  const deleteAccount = useCallback(async (id) => {
    // Cascade-delete related contacts, activities, tasks, opportunities, and notes
    const relatedContacts = contacts.filter((c) => c.accountId === id);
    const relatedActivities = activities.filter((a) => a.accountId === id);
    const relatedTasks = tasks.filter((t) => t.accountId === id);
    const relatedOpps = opportunities.filter((o) => o.accountId === id);

    // Load and delete notes subcollection
    let relatedNotes = [];
    try { relatedNotes = await loadNotes(tenantId, id); } catch { /* no notes */ }

    await Promise.all([
      ...relatedContacts.map((c) => _deleteContact(tenantId, c.id)),
      ...relatedActivities.map((a) => _deleteActivity(tenantId, a.id)),
      ...relatedTasks.map((t) => _deleteTask(tenantId, t.id)),
      ...relatedOpps.map((o) => _deleteOpportunity(tenantId, o.id)),
      ...relatedNotes.map((n) => _deleteNote(tenantId, id, n.id)),
    ]);

    return _deleteAccount(tenantId, id);
  }, [tenantId, contacts, activities, tasks, opportunities]);

  // ─── Contact CRUD ─────────────────────────────────────────

  const createContact = useCallback(async (data) => {
    return _createContact(tenantId, data);
  }, [tenantId]);

  const updateContact = useCallback(async (id, patch) => {
    return _updateContact(tenantId, id, patch);
  }, [tenantId]);

  const deleteContact = useCallback(async (id) => {
    return _deleteContact(tenantId, id);
  }, [tenantId]);

  // ─── Activity CRUD ────────────────────────────────────────

  const logActivity = useCallback(async (data) => {
    return _logActivity(tenantId, {
      ...data,
      loggedBy: currentUser?.uid,
      loggedByName: currentUser?.displayName || currentUser?.email,
    });
  }, [tenantId, currentUser]);

  const deleteActivity = useCallback(async (id) => {
    return _deleteActivity(tenantId, id);
  }, [tenantId]);

  // ─── Task CRUD ────────────────────────────────────────────

  const createTask = useCallback(async (data) => {
    return _createTask(tenantId, {
      ...data,
      createdBy: currentUser?.uid,
      status: data.status || "open",
    });
  }, [tenantId, currentUser]);

  const updateTask = useCallback(async (id, patch) => {
    return _updateTask(tenantId, id, patch);
  }, [tenantId]);

  const deleteTask = useCallback(async (id) => {
    return _deleteTask(tenantId, id);
  }, [tenantId]);

  // ─── Opportunity CRUD ─────────────────────────────────────

  const createOpportunity = useCallback(async (data) => {
    const stages = getStagesForType(data.type);
    const stage = data.stage || stages[0];
    return _createOpportunity(tenantId, {
      ...data,
      stage,
      estValue: data.estValue ?? getDefaultValueForType(data.type),
      createdBy: currentUser?.uid,
    });
  }, [tenantId, currentUser, getStagesForType, getDefaultValueForType]);

  const updateOpportunity = useCallback(async (id, patch) => {
    return _updateOpportunity(tenantId, id, patch);
  }, [tenantId]);

  const deleteOpportunity = useCallback(async (id) => {
    return _deleteOpportunity(tenantId, id);
  }, [tenantId]);

  /**
   * Advance an opportunity to a new stage.
   * Validates the stage is valid for the opportunity type.
   * Appends to stageHistory.
   * If stage is "Won" or "Completed", auto-promotes the account to active.
   */
  const advanceStage = useCallback(async (oppId, newStage) => {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) throw new Error("Opportunity not found");

    const validStages = getStagesForType(opp.type);
    if (!validStages.includes(newStage)) {
      throw new Error(`Invalid stage "${newStage}" for type "${opp.type}"`);
    }

    const closedStages = ["Won", "Lost", "Completed"];
    const currentIsClosed = closedStages.includes(opp.stage);
    if (currentIsClosed) {
      throw new Error(`Opportunity is already closed (${opp.stage})`);
    }

    const historyEntry = {
      stage: newStage,
      date: new Date().toISOString(),
      by: currentUser?.uid || null,
    };

    const patch = {
      stage: newStage,
      stageHistory: [...(opp.stageHistory || []), historyEntry],
    };

    if (newStage === "Won" || newStage === "Completed") {
      patch.closedAt = new Date().toISOString();
      patch.outcome = newStage === "Won" ? "won" : "completed";
    }
    if (newStage === "Lost") {
      patch.closedAt = new Date().toISOString();
      patch.outcome = "lost";
    }

    await _updateOpportunity(tenantId, oppId, patch);

    // Auto-promote account to active on Won/Completed
    let accountPromoted = false;
    if (newStage === "Won" || newStage === "Completed") {
      const account = accounts.find((a) => a.id === opp.accountId);
      if (account && account.status === "prospect") {
        await _updateAccount(tenantId, opp.accountId, { status: "active" });
        accountPromoted = true;
      }
    }

    // Auto-log activity for all closed stages (Won, Lost, Completed)
    if (newStage === "Won" || newStage === "Completed" || newStage === "Lost") {
      await _logActivity(tenantId, {
        type: "note",
        accountId: opp.accountId,
        accountName: opp.accountName,
        subject: `Opportunity ${newStage}: ${opp.title}`,
        notes: `${opp.title} (${opp.type ? oppTypes.find((t) => t.key === opp.type)?.label || opp.type : "opportunity"}) closed as ${newStage.toLowerCase()}.`,
        outcome: newStage === "Won" || newStage === "Completed" ? "positive" : "negative",
        date: new Date().toISOString().slice(0, 10),
        loggedBy: currentUser?.uid,
        loggedByName: currentUser?.displayName || currentUser?.email,
        createdAt: new Date(),
      });
    }

    return { newStage, accountPromoted };
  }, [tenantId, currentUser, opportunities, accounts, getStagesForType, oppTypes]);

  // ─── Product CRUD ─────────────────────────────────────────

  const createProduct = useCallback(async (data) => {
    return _createProduct(tenantId, data);
  }, [tenantId]);

  const updateProduct = useCallback(async (id, patch) => {
    return _updateProduct(tenantId, id, patch);
  }, [tenantId]);

  const deleteProduct = useCallback(async (id) => {
    return _deleteProduct(tenantId, id);
  }, [tenantId]);

  // ─── Notes (lazy-loaded per account) ──────────────────────

  const fetchNotes = useCallback(async (accountId) => {
    return loadNotes(tenantId, accountId);
  }, [tenantId]);

  const addNote = useCallback(async (accountId, data) => {
    return _addNote(tenantId, accountId, {
      ...data,
      authorId: currentUser?.uid,
      authorName: currentUser?.displayName || currentUser?.email,
    });
  }, [tenantId, currentUser]);

  const deleteNote = useCallback(async (accountId, noteId) => {
    return _deleteNote(tenantId, accountId, noteId);
  }, [tenantId]);

  const value = {
    accounts, contacts, activities, tasks, opportunities, products, loading,
    oppTypes, getStagesForType, getDefaultValueForType,
    createAccount, updateAccount, deleteAccount,
    createContact, updateContact, deleteContact,
    logActivity, deleteActivity,
    createTask, updateTask, deleteTask,
    createOpportunity, updateOpportunity, deleteOpportunity, advanceStage,
    createProduct, updateProduct, deleteProduct,
    fetchNotes, addNote, deleteNote,
  };

  return (
    <CrmContext.Provider value={value}>
      {children}
    </CrmContext.Provider>
  );
}
