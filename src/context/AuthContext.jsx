/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut, getRedirectResult } from "firebase/auth";
import {
  doc,
  onSnapshot,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState("user");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Process any pending Google redirect sign-in result.
    // Calling this triggers onAuthStateChanged automatically if a redirect just completed.
    getRedirectResult(auth).catch((err) => {
      console.error("Google redirect sign-in error:", err);
    });

    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (currentUser) {
        setUser(currentUser);

        // Real-time listener for user profile, role, and approval status
        unsubscribeDoc = onSnapshot(
          doc(db, "users", currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const normalizedStatus = data.status
                ? data.status.trim().toLowerCase()
                : "pending";
              const normalizedRole = data.role
                ? data.role.trim().toLowerCase()
                : "user";

              setUserProfile(data);
              setRole(normalizedRole);
              setStatus(normalizedStatus);
            } else {
              // Check if account was pre-approved by email under a different UID
              if (currentUser.email) {
                const q = query(
                  collection(db, "users"),
                  where("email", "==", currentUser.email.toLowerCase())
                );
                getDocs(q)
                  .then((emailSnap) => {
                    if (!emailSnap.empty) {
                      const existingData = emailSnap.docs[0].data();
                      setDoc(doc(db, "users", currentUser.uid), {
                        ...existingData,
                        uid: currentUser.uid,
                      }).catch(console.error);
                    } else {
                      // Not invited: sign out immediately without creating any document
                      signOut(auth).catch(console.error);
                    }
                  })
                  .catch(() => {
                    signOut(auth).catch(console.error);
                  });
              } else {
                signOut(auth).catch(console.error);
              }
              setUserProfile(null);
              setRole("user");
              setStatus("uninvited");
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error listening to user profile:", error);
            setLoading(false);
          },
        );
      } else {
        setUser(null);
        setUserProfile(null);
        setRole("user");
        setStatus("pending");
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeAuth();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const isApproved = status === "approved";

  const value = {
    user,
    userProfile,
    role,
    status,
    loading,
    isAdmin,
    isSuperAdmin,
    isApproved,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
