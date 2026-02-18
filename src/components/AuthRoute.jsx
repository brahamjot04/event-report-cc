import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Spinner } from "react-bootstrap";

/**
 * PROTECTED ROUTE
 * 1. Checks if a user is logged in via Firebase Auth.
 * 2. Fetches the user's document from Firestore to check 'status' (approved).
 * 3. Redirects to /login if not authenticated.
 * 4. Redirects to /pending-approval if status is not 'approved'.
 */
export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [authState, setAuthState] = useState({
    loading: true,
    user: null,
    status: "pending", // Default to pending
    role: "user",
  });
  const auth = getAuth();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));

          if (userDoc.exists()) {
            const data = userDoc.data();

            // --- THE FIX: TRIM AND NORMALIZE ---
            // This removes invisible spaces and forces lowercase
            const dbStatus = data.status
              ? data.status.trim().toLowerCase()
              : "pending";

            console.log(
              "Auth Debug - UID:",
              currentUser.uid,
              "Raw Status:",
              data.status,
              "Normalized:",
              dbStatus,
            );

            setAuthState({
              loading: false,
              user: currentUser,
              status: dbStatus,
              role: data.role || "user",
            });
          } else {
            setAuthState({
              loading: false,
              user: currentUser,
              status: "pending",
              role: "user",
            });
          }
        } catch (error) {
          console.error("Error fetching user status:", error);
          setAuthState({
            loading: false,
            user: currentUser,
            status: "pending",
            role: "user",
          });
        }
      } else {
        setAuthState({
          loading: false,
          user: null,
          status: "pending",
          role: "user",
        });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  if (authState.loading) {
    return (
      <div
        className="vh-100 d-flex justify-content-center align-items-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Debug: log resolved auth state and current location to help diagnose redirects
  console.log(
    "ProtectedRoute debug - authState:",
    authState,
    "location:",
    location.pathname,
  );

  // 1. If not logged in, go to login
  if (!authState.user) {
    return <Navigate to="/login" replace />;
  }

  // 2. If status is NOT 'approved', go to pending page
  // Allow the actual pending page to be accessed by non-approved users
  if (
    authState.status !== "approved" &&
    location.pathname !== "/pending-approval"
  ) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (
    authState.status === "approved" &&
    location.pathname === "/pending-approval"
  ) {
    return <Navigate to="/" replace />;
  }

  // 3. Admin access check
  if (
    adminOnly &&
    authState.role !== "admin" &&
    authState.role !== "super_admin"
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * PUBLIC ROUTE
 * (Remains the same - handles Login/Signup visibility)
 */
export const PublicRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return (
      <div
        className="vh-100 d-flex justify-content-center align-items-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};
