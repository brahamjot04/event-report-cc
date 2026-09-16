import { useState, useEffect, useRef } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePwa } from "../context/PwaContext";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "./ThemeToggle";
import ScrollToTop from "./ScrollToTop";
import CommandPalette from "./CommandPalette";
import NotificationDropdown from "./NotificationDropdown";
import IosInstallModal from "./IosInstallModal";
import "../assets/DashboardStyles.css";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, role, isAdmin, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const {
    isInstallable,
    isInstalled,
    promptInstall,
    isOnline,
    updateAvailable,
    applyUpdate,
    dismissUpdate,
  } = usePwa();

  const userName =
    user?.displayName || userProfile?.name || user?.email?.split("@")[0] || "Guest";
  const userInitial = userName.charAt(0).toUpperCase();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarAnimatingOut, setSidebarAnimatingOut] = useState(false);
  const closeTimerRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const { unreadCount } = useNotifications();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Global hotkeys for Command Palette (Ctrl+K, Cmd+K, /) and Notifications (Ctrl+Shift+N)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInputActive =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        document.activeElement?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsNotificationOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (
        e.key === "/" &&
        !isInputActive &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dismiss profile menu on outside click or Escape
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

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

  // Close mobile sidebar and popovers when route changes
  useEffect(() => {
    setSidebarOpen(false);
    setSidebarAnimatingOut(false);
    setIsNotificationOpen(false);
    setIsProfileMenuOpen(false);
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
  const isEventPage = location.pathname.startsWith("/event/");
  const showMobileBottomNav = !isEventPage;

  const [footerHovered, setFooterHovered] = useState(false);

  return (
    <Container fluid className="p-0" style={{ minHeight: "100vh" }}>
      <Row className="g-0 flex-nowrap" style={{ minHeight: "100vh" }}>
        {/* --- SIDEBAR --- */}
        <Col
          xs="auto"
          className={`sidebar-nav ${isMobileOpen ? "mobile-sidebar-open" : ""} ${sidebarAnimatingOut ? "mobile-sidebar-closing" : ""} d-md-block ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
        >
          <div className="sidebar-header px-4 mb-5 d-flex justify-content-between align-items-center">
            {!sidebarCollapsed ? (
              <div
                className="d-flex align-items-center gap-2 cursor-pointer flex-grow-1 overflow-hidden"
                onClick={() => handleNavClick("/")}
                title="Event Management Portal - CCGNDEC"
              >
                <img
                  src="/cc.svg"
                  alt="CCGNDEC Logo"
                  style={{
                    width: "30px",
                    height: "30px",
                    objectFit: "contain",
                    borderRadius: "6px",
                    flexShrink: 0,
                  }}
                />
                <h6 className="fw-bold text-primary mb-0 text-truncate" style={{ fontSize: "0.95rem" }}>
                  CC GNDEC
                </h6>
              </div>
            ) : (
              <div
                className="cursor-pointer d-flex justify-content-center"
                onClick={() => handleNavClick("/")}
                title="Event Management Portal - CCGNDEC"
              >
                <img
                  src="/cc.svg"
                  alt="CCGNDEC Logo"
                  style={{
                    width: "28px",
                    height: "28px",
                    objectFit: "contain",
                    borderRadius: "6px",
                  }}
                />
              </div>
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
            {isAdmin && (
              <div
                className={isActive("/users")}
                onClick={() => handleNavClick("/users")}
                title="Users"
              >
                <i className="bi bi-people-fill"></i>
                <span>Users</span>
              </div>
            )}
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

            {isAdmin && (
              <div
                className={isActive("/email")}
                onClick={() => handleNavClick("/email")}
                title="Email"
              >
                <i className="bi bi-envelope-fill"></i>
                <span>Email</span>
              </div>
            )}
            <div
              className={isActive("/calendar")}
              onClick={() => handleNavClick("/calendar")}
              title="Calendar"
            >
              <i className="bi bi-calendar-event-fill"></i>
              <span>Calendar</span>
            </div>
            {isAdmin && (
              <div
                className={isActive("/activity-logs")}
                onClick={() => handleNavClick("/activity-logs")}
                title="Activity Logs"
              >
                <i className="bi bi-clock-history"></i>
                <span>Activity Logs</span>
              </div>
            )}
            <div
              className={isActive("/notifications")}
              onClick={() => handleNavClick("/notifications")}
              title="Notifications"
            >
              <i className="bi bi-bell-fill"></i>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="badge rounded-pill bg-danger ms-auto"
                  style={{ fontSize: "0.65rem" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            {/* PWA Install Button in Sidebar */}
            {!isInstalled && isInstallable && (
              <div
                className="nav-item-custom mt-3 fw-bold text-primary"
                onClick={() => {
                  promptInstall();
                  closeSidebar();
                }}
                title="Install Event Management Portal - CCGNDEC"
                style={{
                  backgroundColor: "rgba(13, 110, 253, 0.08)",
                  border: "1px dashed var(--bs-primary)",
                  borderRadius: "8px",
                }}
              >
                <i className="bi bi-download text-primary"></i>
                <span>Install App</span>
              </div>
            )}
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
          className="p-4 p-lg-5 d-flex flex-column flex-grow-1"
          style={{
            minWidth: 0,
            transition:
              "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            minHeight: "100vh",
          }}
        >
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-5 gap-3">
            <div className="d-flex align-items-center gap-3">
              <button
                className="btn btn-link d-md-none p-0 hamburger-btn"
                onClick={() => (isMobileOpen ? closeSidebar() : openSidebar())}
                style={{ fontSize: "1.5rem", border: "none", cursor: "pointer" }}
              >
                <i className="bi bi-list"></i>
              </button>

              {/* Quick Search Button (Desktop) */}
              <div
                className="search-trigger-btn d-none d-sm-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm cursor-pointer"
                style={{
                  minWidth: "220px",
                }}
                onClick={() => setIsCommandPaletteOpen(true)}
                role="button"
                tabIndex={0}
              >
                <i className="bi bi-search text-muted"></i>
                <span className="flex-grow-1 text-muted small">Search anything...</span>
                <kbd
                  className="px-2 py-0.5 rounded text-muted"
                  style={{
                    fontSize: "10px",
                    backgroundColor: "var(--soft-hover)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  Ctrl K
                </kbd>
              </div>

              {/* Mobile Quick Search Button */}
              <button
                className="btn btn-link d-sm-none p-2 rounded-circle search-trigger-btn border-0 shadow-sm d-flex align-items-center justify-content-center"
                onClick={() => setIsCommandPaletteOpen(true)}
                title="Search (Ctrl+K)"
                style={{ width: 40, height: 40 }}
              >
                <i className="bi bi-search text-muted"></i>
              </button>
            </div>

            <div className="d-flex align-items-center gap-3">
              {/* Offline Warning Pill */}
              {!isOnline && (
                <div
                  className="d-flex align-items-center gap-1 px-2.5 py-1 rounded-pill small fw-semibold"
                  style={{
                    backgroundColor: "rgba(220, 53, 69, 0.12)",
                    color: "var(--bs-danger)",
                    fontSize: "12px",
                    border: "1px solid rgba(220, 53, 69, 0.3)",
                  }}
                  title="You are offline. Changes are saved locally and will sync when reconnected."
                >
                  <i className="bi bi-wifi-off"></i>
                  <span className="d-none d-sm-inline ms-1">Offline</span>
                </div>
              )}

              {/* Header Install Button */}
              {!isInstalled && isInstallable && (
                <button
                  className="btn btn-outline-primary btn-sm rounded-pill d-flex align-items-center gap-2 px-3 shadow-sm"
                  onClick={promptInstall}
                  title="Install Event Management Portal - CCGNDEC"
                  style={{ fontSize: "12px", fontWeight: 600 }}
                >
                  <i className="bi bi-download me-1"></i>
                  <span className="d-none d-md-inline">Install App</span>
                </button>
              )}

              {/* Theme Toggle in Header */}
              <ThemeToggle />

              {/* Notification Bell with Dropdown Popover */}
              <div className="position-relative">
                <div
                  className={`notification-bell-btn p-2 rounded-circle shadow-sm cursor-pointer position-relative d-flex align-items-center justify-content-center ${isNotificationOpen ? "active" : ""}`}
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: isNotificationOpen ? "rgba(13, 110, 253, 0.08)" : "var(--bg-card)",
                    border: isNotificationOpen ? "1px solid var(--bs-primary)" : "1px solid var(--border-color)",
                  }}
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                  title="Notifications & Alerts (Ctrl+Shift+N)"
                  role="button"
                  tabIndex={0}
                  aria-label="Notifications"
                >
                  <i
                    className={`bi ${unreadCount > 0 ? "bi-bell-fill text-primary" : "bi-bell"}`}
                    style={{ color: unreadCount > 0 ? undefined : "var(--text-primary)" }}
                  ></i>
                  {unreadCount > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger badge-pulse"
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.25rem 0.4rem",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </div>
                <NotificationDropdown
                  isOpen={isNotificationOpen}
                  onClose={() => setIsNotificationOpen(false)}
                />
              </div>

              {/* Profile Menu Trigger & Popover */}
              <div ref={profileMenuRef} className="position-relative">
                <div
                  className="p-1 p-sm-2 ps-sm-2 pe-sm-3 rounded-pill shadow-sm d-flex align-items-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: isProfileMenuOpen ? "rgba(13, 110, 253, 0.08)" : "var(--bg-card)",
                    border: isProfileMenuOpen ? "1px solid var(--bs-primary)" : "1px solid var(--border-color)",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  title="Account Menu"
                >
                  <div
                    className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      minHeight: 32,
                      aspectRatio: "1 / 1",
                      fontSize: "14px",
                    }}
                  >
                    {userInitial}
                  </div>
                  <div
                    className="d-none d-sm-flex flex-column overflow-hidden"
                    style={{ lineHeight: "1.1", maxWidth: "160px" }}
                  >
                    <span
                      className="fw-bold small text-truncate text-nowrap"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {userName}
                    </span>
                  </div>
                  <i
                    className={`bi ${isProfileMenuOpen ? "bi-chevron-up" : "bi-chevron-down"} small text-muted ms-1 d-none d-sm-inline`}
                  ></i>
                </div>

                {isProfileMenuOpen && (
                  <div className="profile-menu-popover">
                    {/* Header info */}
                    <div className="p-3 border-bottom" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <div
                          className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 34, height: 34, fontSize: "14px" }}
                        >
                          {userInitial}
                        </div>
                        <div className="overflow-hidden">
                          <div className="fw-bold small text-truncate" style={{ color: "var(--text-primary)" }}>
                            {userName}
                          </div>
                          <div className="text-muted text-truncate" style={{ fontSize: "11px" }}>
                            {user?.email || "Signed In"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`badge rounded-pill ${isAdmin ? "bg-danger" : "bg-primary"}`}
                          style={{ fontSize: "10px", fontWeight: 600 }}
                        >
                          {isAdmin ? "Administrator" : (role ? role.toUpperCase() : "MEMBER")}
                        </span>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => {
                          navigate("/profile");
                          setIsProfileMenuOpen(false);
                        }}
                      >
                        <i className="bi bi-person-gear text-primary fs-6"></i>
                        <span>Account Settings</span>
                      </button>
                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => {
                          toggleTheme();
                          setIsProfileMenuOpen(false);
                        }}
                      >
                        <i className={`bi ${darkMode ? "bi-sun text-warning" : "bi-moon-stars text-warning"} fs-6`}></i>
                        <span>{darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
                      </button>
                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsCommandPaletteOpen(true);
                        }}
                      >
                        <i className="bi bi-search text-info fs-6"></i>
                        <span>Search Palette (Ctrl+K)</span>
                      </button>
                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate("/notifications");
                        }}
                      >
                        <i className="bi bi-bell text-danger fs-6"></i>
                        <span>Notification Hub</span>
                      </button>
                    </div>

                    {/* Sign out */}
                    <div className="border-top py-1" style={{ borderColor: "var(--border-color)" }}>
                      <button
                        type="button"
                        className="profile-menu-item danger-item"
                        onClick={async () => {
                          setIsProfileMenuOpen(false);
                          await logout();
                          navigate("/login");
                        }}
                      >
                        <i className="bi bi-box-arrow-right text-danger fs-6"></i>
                        <span className="text-danger fw-semibold">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New Version Update Banner */}
          {updateAvailable && (
            <div
              className="alert alert-primary d-flex align-items-center justify-content-between p-3 rounded-3 shadow-sm mb-4"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--bs-primary)",
                borderWidth: "1px",
                color: "var(--text-primary)",
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-arrow-repeat text-primary fs-4"></i>
                <div>
                  <div className="fw-bold small">New Update Available</div>
                  <div className="text-muted small">
                    A fresh version of Event Management Portal - CCGNDEC is ready to install.
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-primary btn-sm rounded-pill px-3"
                  onClick={applyUpdate}
                >
                  Update Now
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm rounded-pill px-2"
                  onClick={dismissUpdate}
                  title="Dismiss"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          )}

          <div className={`flex-grow-1 ${showMobileBottomNav ? "has-bottom-nav" : ""}`}>{children}</div>

          {/* --- FOOTER --- */}
          <footer
            className={`mt-5 pt-4 text-center text-muted small border-top ${showMobileBottomNav ? "has-bottom-nav" : ""}`}
            style={{
              borderColor: "var(--border-color)",
              fontSize: "0.85rem",
            }}
            onMouseEnter={() => setFooterHovered(true)}
            onMouseLeave={() => setFooterHovered(false)}
          >
            <span>
              © {new Date().getFullYear()} -{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: footerHovered ? "var(--bs-primary)" : "inherit",
                  transition: "color 0.2s ease-in-out",
                }}
              >
                {footerHovered
                  ? "Designed by Brahamjot Singh (Batch 2026)"
                  : "Managed by Record Keeping Team"}
              </span>{" "}
              - Cultural Committee GNDEC
            </span>
          </footer>
        </Col>
      </Row>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {showMobileBottomNav && (
        <nav className="mobile-bottom-nav d-md-none" aria-label="Mobile Navigation">
          <button
            type="button"
            className={`mobile-bottom-nav-item ${location.pathname === "/" ? "active" : ""}`}
            onClick={() => handleNavClick("/")}
            title="Dashboard"
          >
            <i className="bi bi-grid-1x2-fill"></i>
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`mobile-bottom-nav-item ${location.pathname === "/calendar" ? "active" : ""}`}
            onClick={() => handleNavClick("/calendar")}
            title="Calendar"
          >
            <i className="bi bi-calendar3"></i>
            <span>Calendar</span>
          </button>
          <button
            type="button"
            className="mobile-bottom-nav-item"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Search (Ctrl+K)"
          >
            <i className="bi bi-search"></i>
            <span>Search</span>
          </button>
          <button
            type="button"
            className={`mobile-bottom-nav-item ${location.pathname === "/core-team" ? "active" : ""}`}
            onClick={() => handleNavClick("/core-team")}
            title="Core Team"
          >
            <i className="bi bi-people-fill"></i>
            <span>Team</span>
          </button>
          <button
            type="button"
            className={`mobile-bottom-nav-item ${location.pathname === "/profile" ? "active" : ""}`}
            onClick={() => handleNavClick("/profile")}
            title="Profile"
          >
            <i className="bi bi-person-circle"></i>
            <span>Profile</span>
          </button>
        </nav>
      )}

      {/* COMMAND PALETTE */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* IOS INSTALLATION GUIDE MODAL */}
      <IosInstallModal />

      {/* FLOATING SCROLL TO TOP BUTTON */}
      <ScrollToTop />
    </Container>
  );
}
