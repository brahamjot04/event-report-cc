/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut, getRedirectResult } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
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

              setUserProfile(data);
              setRole(data.role || "user");
              setStatus(normalizedStatus);
            } else {
              // Create user doc for OAuth users who don't have a profile yet
              const newProfile = {
                uid: currentUser.uid,
                name:
                  currentUser.displayName ||
                  currentUser.email?.split("@")[0] ||
                  "User",
                email: currentUser.email || "",
                role: "user",
                status: "pending",
                createdAt: new Date(),
              };
              setDoc(doc(db, "users", currentUser.uid), newProfile).catch(
                (err) =>
                  console.error("Error creating user profile document:", err)
              );
              setUserProfile(newProfile);
              setRole("user");
              setStatus("pending");
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
