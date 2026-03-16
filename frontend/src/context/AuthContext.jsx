import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { seedDemoData } from "../services/demoData";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Fetch the user's profile from Firestore. If it doesn't exist,
 * auto-provision with default tenant and admin role.
 */
async function fetchOrCreateProfile(user, accountType) {
  const profileRef = doc(db, "users", user.uid);
  const snap = await getDoc(profileRef);

  if (snap.exists()) {
    return snap.data();
  }

  // Auto-provision: first-time login creates profile + tenant
  const tenantId = user.uid; // each new user gets their own tenant
  const profile = {
    email: user.email,
    displayName: user.displayName || user.email?.split("@")[0] || "",
    tenantId,
    role: "admin",
    createdAt: serverTimestamp(),
  };

  // Create user profile
  await setDoc(profileRef, profile);

  // Create tenant doc if it doesn't exist
  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) {
    await setDoc(tenantRef, {
      companyName: "",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    if (accountType) {
      await setDoc(doc(db, "tenants", tenantId, "config", "main"), {
        userRole: accountType,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    // Seed demo data for new tenants
    try {
      await seedDemoData(tenantId);
    } catch (err) {
      console.warn("Demo data seeding failed:", err);
    }
  }

  return { ...profile, createdAt: new Date() };
}

export default function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const pendingAccountTypeRef = useRef(null);

  // Derived values from profile
  const tenantId = userProfile?.tenantId || null;
  const userRole = userProfile?.role || "admin";
  const isAdmin = userRole === "admin";

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function signup(email, password, name, accountType) {
    pendingAccountTypeRef.current = accountType || null;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    return cred;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setAuthError(null);
          const accountType = pendingAccountTypeRef.current;
          pendingAccountTypeRef.current = null;
          const profile = await fetchOrCreateProfile(user, accountType);
          setCurrentUser(user);
          setUserProfile(profile);
        } catch (err) {
          console.error("Failed to load user profile:", err);
          setAuthError("Account setup failed. Please try again.");
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setAuthError(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    tenantId,
    userRole,
    isAdmin,
    login,
    signup,
    logout,
    loading,
    authError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
