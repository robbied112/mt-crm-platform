/**
 * CRM Context — provides accounts, contacts, activities, and tasks
 * with real-time Firestore listeners and CRUD operations.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  subscribeAccounts, subscribeContacts, subscribeActivities, subscribeTasks,
  createAccount as _createAccount, updateAccount as _updateAccount, deleteAccount as _deleteAccount,
  createContact as _createContact, updateContact as _updateContact, deleteContact as _deleteContact,
  logActivity as _logActivity, deleteActivity as _deleteActivity,
  createTask as _createTask, updateTask as _updateTask, deleteTask as _deleteTask,
  loadNotes, addNote as _addNote, deleteNote as _deleteNote,
} from "../services/crmService";

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
  const [loading, setLoading] = useState(true);

  // Real-time listeners
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let loadCount = 0;
    const checkLoaded = () => { if (++loadCount >= 4) setLoading(false); };

    const unsubs = [
      subscribeAccounts(tenantId, (data) => { setAccounts(data); checkLoaded(); }, checkLoaded),
      subscribeContacts(tenantId, (data) => { setContacts(data); checkLoaded(); }, checkLoaded),
      subscribeActivities(tenantId, (data) => { setActivities(data); checkLoaded(); }, checkLoaded),
      subscribeTasks(tenantId, (data) => { setTasks(data); checkLoaded(); }, checkLoaded),
    ];

    return () => unsubs.forEach((u) => u());
  }, [tenantId]);

  // ─── Account CRUD ─────────────────────────────────────────

  const createAccount = useCallback(async (data) => {
    return _createAccount(tenantId, { ...data, createdBy: currentUser?.uid });
  }, [tenantId, currentUser]);

  const updateAccount = useCallback(async (id, patch) => {
    return _updateAccount(tenantId, id, patch);
  }, [tenantId]);

  const deleteAccount = useCallback(async (id) => {
    // Cascade-delete related contacts, activities, tasks, and notes
    const relatedContacts = contacts.filter((c) => c.accountId === id);
    const relatedActivities = activities.filter((a) => a.accountId === id);
    const relatedTasks = tasks.filter((t) => t.accountId === id);

    // Load and delete notes subcollection
    let relatedNotes = [];
    try { relatedNotes = await loadNotes(tenantId, id); } catch { /* no notes */ }

    await Promise.all([
      ...relatedContacts.map((c) => _deleteContact(tenantId, c.id)),
      ...relatedActivities.map((a) => _deleteActivity(tenantId, a.id)),
      ...relatedTasks.map((t) => _deleteTask(tenantId, t.id)),
      ...relatedNotes.map((n) => _deleteNote(tenantId, id, n.id)),
    ]);

    return _deleteAccount(tenantId, id);
  }, [tenantId, contacts, activities, tasks]);

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
    accounts, contacts, activities, tasks, loading,
    createAccount, updateAccount, deleteAccount,
    createContact, updateContact, deleteContact,
    logActivity, deleteActivity,
    createTask, updateTask, deleteTask,
    fetchNotes, addNote, deleteNote,
  };

  return (
    <CrmContext.Provider value={value}>
      {children}
    </CrmContext.Provider>
  );
}
