import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Home from "./pages/Home";
import EventDetails from "./pages/EventDetails";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar";
import Email from "./pages/Email";
import Logs from "./pages/Logs";
import NotFound from "./pages/NotFound";
import CoreTeam from "./pages/CoreTeam";
import PendingApproval from "./pages/PendingApproval";
import Notifications from "./pages/Notifications";
import ForgotPassword from "./pages/ForgotPassword";
import "bootstrap/dist/css/bootstrap.min.css";

// Import the wrappers
import { ProtectedRoute, PublicRoute } from "./components/AuthRoute";

function App() {
  return (
    <Routes>
      {/* --- PUBLIC ROUTES (Accessible ONLY if NOT logged in) --- */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* You can add a Register route here later using the same PublicRoute wrapper */}

      {/* --- PROTECTED ROUTES (Accessible ONLY if logged in) --- */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/event/:id"
        element={
          <ProtectedRoute>
            <EventDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute adminOnly={true}>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/email"
        element={
          <ProtectedRoute adminOnly={true}>
            <Email />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <ProtectedRoute adminOnly={true}>
            <Logs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/core-team"
        element={
          <ProtectedRoute>
            <CoreTeam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />

      <Route
        path="/signup"
        element={<Navigate to="/login" replace />}
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/pending-approval"
        element={
          <ProtectedRoute>
            <PendingApproval />
          </ProtectedRoute>
        }
      />
      {/* 404 Page (Can remain open or protected, usually open) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
