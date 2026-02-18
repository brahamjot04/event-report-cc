import { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import ThemeToggle from "./ThemeToggle";
import "../assets/DashboardStyles.css";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("Loading...");
  const [userInitial, setUserInitial] = useState("?");

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

  // Helper function to set active class
  const isActive = (path) =>
    location.pathname === path ? "nav-item-custom active" : "nav-item-custom";

  return (
    <Container fluid className="p-0" style={{ minHeight: "100vh" }}>
      <Row className="g-0">
        {/* --- SIDEBAR --- */}
        <Col md={2} className="sidebar-nav d-none d-md-block">
          <div className="px-4 mb-5">
            <h5
              className="fw-bold text-primary cursor-pointer"
              onClick={() => navigate("/")}
            >
              Cultural Committee
            </h5>
          </div>

          <div className="px-2">
            {/* MAIN NAVIGATION */}
            <div className={isActive("/")} onClick={() => navigate("/")}>
              <i className="bi bi-grid-1x2-fill"></i> Dashboard
            </div>
            <div
              className={isActive("/users")}
              onClick={() => navigate("/users")}
            >
              <i className="bi bi-people-fill"></i> Users
            </div>
            <div
              className={isActive("/core-team")}
              onClick={() => navigate("/core-team")}
            >
              <i className="bi bi-person-badge-fill"></i> Core Team
            </div>

            {/* MANAGEMENT SECTION */}
            <div className="text-muted small fw-bold mt-4 mb-2 px-3 text-uppercase">
              Management
            </div>

            <div
              className={isActive("/email")}
              onClick={() => navigate("/email")}
            >
              <i className="bi bi-envelope-fill"></i> Email
            </div>
            <div
              className={isActive("/calendar")}
              onClick={() => navigate("/calendar")}
            >
              <i className="bi bi-calendar-event-fill"></i> Calendar
            </div>
            <div
              className={isActive("/activity-logs")}
              onClick={() => navigate("/activity-logs")}
            >
              <i className="bi bi-clock-history"></i> Activity Logs
            </div>
          </div>
        </Col>

        {/* --- MAIN CONTENT --- */}
        <Col md={10} className="p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div></div>
            <div className="d-flex align-items-center gap-3">
              <div
                className="bg-white p-2 rounded-circle shadow-sm cursor-pointer"
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="bi bi-bell text-dark"></i>
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
