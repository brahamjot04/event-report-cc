import { useState, useEffect, useRef } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import ThemeToggle from "./ThemeToggle";
import "../assets/DashboardStyles.css";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("Loading...");
  const [userInitial, setUserInitial] = useState("?");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarAnimatingOut, setSidebarAnimatingOut] = useState(false);
  const closeTimerRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [pendingCount, setPendingCount] = useState(0);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const name = user.displayName || user.email.split("@")[0];
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase());
      } else {
        setUserName("Guest");
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for pending users count
  useEffect(() => {
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    });
    return () => unsubscribe();
  }, []);

  const openSidebar = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSidebarAnimatingOut(false);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    if (!sidebarOpen) {
      return;
    }
    setSidebarAnimatingOut(true);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setSidebarOpen(false);
      setSidebarAnimatingOut(false);
      closeTimerRef.current = null;
    }, 600);
  };

  // Close mobile sidebar when route changes (but keep collapsed state)
  useEffect(() => {
    closeSidebar();
  }, [location.pathname]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  // Helper function to set active class
  const isActive = (path) =>
    location.pathname === path ? "nav-item-custom active" : "nav-item-custom";

  const handleNavClick = (path) => {
    navigate(path);
    closeSidebar();
  };

  const isMobileOpen = sidebarOpen && !sidebarAnimatingOut;

  return (
    <Container fluid className="p-0" style={{ minHeight: "100vh" }}>
      <Row className="g-0">
        {/* --- SIDEBAR --- */}
        <Col
          md={2}
          className={`sidebar-nav ${isMobileOpen ? "mobile-sidebar-open" : ""} ${sidebarAnimatingOut ? "mobile-sidebar-closing" : ""} d-md-block ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
        >
          <div className="sidebar-header px-4 mb-5 d-flex justify-content-between align-items-center">
            {!sidebarCollapsed && (
              <h5
                className="fw-bold text-primary cursor-pointer mb-0 flex-grow-1"
                onClick={() => handleNavClick("/")}
              >
                Cultural Committee
              </h5>
            )}
            <button
              className="btn btn-link d-none d-md-inline p-0 sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                fontSize: "1.1rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              <i
                className={`bi ${sidebarCollapsed ? "bi-chevron-right" : "bi-chevron-left"}`}
              ></i>
            </button>
            <button
              className="btn btn-link d-md-none p-0 sidebar-close-btn ms-auto"
              onClick={closeSidebar}
              style={{
                fontSize: "1.5rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          <div className="px-2">
            {/* MAIN NAVIGATION */}
            <div
              className={isActive("/")}
              onClick={() => handleNavClick("/")}
              title="Dashboard"
            >
              <i className="bi bi-grid-1x2-fill"></i>
              <span>Dashboard</span>
            </div>
            <div
              className={isActive("/users")}
              onClick={() => handleNavClick("/users")}
              title="Users"
            >
              <i className="bi bi-people-fill"></i>
              <span>Users</span>
            </div>
            <div
              className={isActive("/core-team")}
              onClick={() => handleNavClick("/core-team")}
              title="Core Team"
            >
              <i className="bi bi-person-badge-fill"></i>
              <span>Core Team</span>
            </div>

            {/* MANAGEMENT SECTION */}
            {!sidebarCollapsed && (
              <div className="text-muted small fw-bold mt-4 mb-2 px-3 text-uppercase">
                Management
              </div>
            )}

            <div
              className={isActive("/email")}
              onClick={() => handleNavClick("/email")}
              title="Email"
            >
              <i className="bi bi-envelope-fill"></i>
              <span>Email</span>
            </div>
            <div
              className={isActive("/calendar")}
              onClick={() => handleNavClick("/calendar")}
              title="Calendar"
            >
              <i className="bi bi-calendar-event-fill"></i>
              <span>Calendar</span>
            </div>
            <div
              className={isActive("/activity-logs")}
              onClick={() => handleNavClick("/activity-logs")}
              title="Activity Logs"
            >
              <i className="bi bi-clock-history"></i>
              <span>Activity Logs</span>
            </div>
          </div>
        </Col>

        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className={`mobile-sidebar-backdrop d-md-none ${sidebarAnimatingOut ? "fade-out" : ""}`}
            onClick={closeSidebar}
          />
        )}

        {/* --- MAIN CONTENT --- */}
        <Col
          md={sidebarCollapsed ? 11 : 10}
          className="p-4 p-lg-5"
          style={{
            transition:
              "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <button
              className="btn btn-link d-md-none p-0 hamburger-btn"
              onClick={() => (isMobileOpen ? closeSidebar() : openSidebar())}
              style={{ fontSize: "1.5rem", border: "none", cursor: "pointer" }}
            >
              <i className="bi bi-list"></i>
            </button>
            <div></div>
            <div className="d-flex align-items-center gap-3">
              <div
                className="bg-white p-2 rounded-circle shadow-sm cursor-pointer position-relative"
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => navigate("/users")}
                title="Pending Approvals"
              >
                <i className="bi bi-bell text-dark"></i>
                {pendingCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{
                      fontSize: "0.65rem",
                      padding: "0.25rem 0.4rem",
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </div>
              <div
                className="bg-white px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2 cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                <div
                  className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 32, height: 32 }}
                >
                  {userInitial}
                </div>
                <div
                  className="d-flex flex-column"
                  style={{ lineHeight: "1.1" }}
                >
                  <span className="fw-bold small text-dark">{userName}</span>
                </div>
              </div>
            </div>
          </div>

          {children}
        </Col>
      </Row>

      {/* FLOATING DARK MODE BUTTON */}
      <ThemeToggle />
    </Container>
  );
}
