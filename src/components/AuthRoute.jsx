import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";

/**
 * PROTECTED ROUTE
 * Consumes centralized AuthContext state.
 * 1. Shows loader while auth/profile is loading.
 * 2. Redirects to /login if not logged in.
 * 3. Redirects to /pending-approval if user status is not 'approved'.
 * 4. Redirects to / if adminOnly route and user is not admin.
 */
export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, status, isAdmin } = useAuth();
  const location = useLocation();

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

  // 1. If not logged in, go to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. If status is NOT 'approved', go to pending page
  if (status !== "approved" && location.pathname !== "/pending-approval") {
    return <Navigate to="/pending-approval" replace />;
  }

  // If approved and currently on pending page, redirect home
  if (status === "approved" && location.pathname === "/pending-approval") {
    return <Navigate to="/" replace />;
  }

  // 3. Admin access check
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * PUBLIC ROUTE
 * Redirects logged in users to /
 */
export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

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
