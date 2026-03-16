/**
 * CRM Service — CRUD operations for accounts, contacts, activities, tasks.
 *
 * Unlike firestoreService.js (chunked bulk datasets), this handles
 * individual document CRUD for CRM entities.
 *
 * Storage: tenants/{tenantId}/{collection}/{docId}
 */
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc,
  collection, addDoc, getDocs,
  query, orderBy, where, limit as fbLimit,
  serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ─── Helpers ──────────────────────────────────────────────────

function tenantCol(tenantId, col) {
  return collection(db, "tenants", tenantId, col);
}

function tenantDoc(tenantId, col, docId) {
  return doc(db, "tenants", tenantId, col, docId);
}

function stripUndefined(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

// ─── Accounts ─────────────────────────────────────────────────

export async function loadAccounts(tenantId) {
  const q = query(tenantCol(tenantId, "accounts"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAccount(tenantId, data) {
  const ref = await addDoc(tenantCol(tenantId, "accounts"), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccount(tenantId, id, patch) {
  await updateDoc(tenantDoc(tenantId, "accounts", id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAccount(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "accounts", id));
}

// ─── Contacts ─────────────────────────────────────────────────

export async function loadContacts(tenantId) {
  const q = query(tenantCol(tenantId, "contacts"), orderBy("lastName"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createContact(tenantId, data) {
  const ref = await addDoc(tenantCol(tenantId, "contacts"), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateContact(tenantId, id, patch) {
  await updateDoc(tenantDoc(tenantId, "contacts", id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContact(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "contacts", id));
}

// ─── Activities ───────────────────────────────────────────────

export async function loadActivities(tenantId, { accountId, limitCount = 100 } = {}) {
  let q;
  if (accountId) {
    q = query(
      tenantCol(tenantId, "activityLog"),
      where("accountId", "==", accountId),
      orderBy("date", "desc"),
      fbLimit(limitCount)
    );
  } else {
    q = query(
      tenantCol(tenantId, "activityLog"),
      orderBy("date", "desc"),
      fbLimit(limitCount)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function logActivity(tenantId, data) {
  const ref = await addDoc(tenantCol(tenantId, "activityLog"), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteActivity(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "activityLog", id));
}

// ─── Tasks ────────────────────────────────────────────────────

export async function loadTasks(tenantId) {
  const q = query(tenantCol(tenantId, "tasks"), orderBy("dueDate"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createTask(tenantId, data) {
  const ref = await addDoc(tenantCol(tenantId, "tasks"), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(tenantId, id, patch) {
  await updateDoc(tenantDoc(tenantId, "tasks", id), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "tasks", id));
}

// ─── Notes (subcollection under accounts) ─────────────────────

export async function loadNotes(tenantId, accountId) {
  const notesCol = collection(db, "tenants", tenantId, "accounts", accountId, "notes");
  const q = query(notesCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addNote(tenantId, accountId, data) {
  const notesCol = collection(db, "tenants", tenantId, "accounts", accountId, "notes");
  const ref = await addDoc(notesCol, {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteNote(tenantId, accountId, noteId) {
  const noteRef = doc(db, "tenants", tenantId, "accounts", accountId, "notes", noteId);
  await deleteDoc(noteRef);
}

// ─── Real-time Listeners ──────────────────────────────────────

export function subscribeAccounts(tenantId, callback, onError) {
  const q = query(tenantCol(tenantId, "accounts"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("subscribeAccounts error:", err);
    if (onError) onError(err);
  });
}

export function subscribeContacts(tenantId, callback, onError) {
  const q = query(tenantCol(tenantId, "contacts"), orderBy("lastName"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("subscribeContacts error:", err);
    if (onError) onError(err);
  });
}

export function subscribeActivities(tenantId, callback, onError) {
  const q = query(tenantCol(tenantId, "activityLog"), orderBy("date", "desc"), fbLimit(200));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("subscribeActivities error:", err);
    if (onError) onError(err);
  });
}

export function subscribeTasks(tenantId, callback, onError) {
  const q = query(tenantCol(tenantId, "tasks"), orderBy("dueDate"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error("subscribeTasks error:", err);
    if (onError) onError(err);
  });
}
