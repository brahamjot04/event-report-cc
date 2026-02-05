import { useState, useEffect } from "react";
import {
  Navbar,
  Nav,
  Offcanvas,
  Dropdown,
  Button,
  Container,
} from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Layout({ children }) {
  const [show, setShow] = useState(false);
  const [userData, setUserData] = useState({
    name: "Loading...",
    role: "user",
  });

  // --- THEME STATE ---
  // Check localStorage first, default to 'light'
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const location = useLocation();
  const navigate = useNavigate();

  // --- THEME EFFECT ---
  // This applies the "data-bs-theme" attribute to the entire HTML document
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData({
          name: data.name || user.displayName || "User",
          role: data.role || "user",
        });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 p-3 bg-body border-end">
      {" "}
      {/* Changed bg-white to bg-body */}
      <div className="d-flex align-items-center mb-4 px-2 text-nowrap">
        <span className="fs-5 fw-bold text-primary">Cultural</span>
        <span
          className={`fs-5 fw-bold ms-1 ${theme === "dark" ? "text-light" : "text-dark"}`}
        >
          Committee
        </span>
      </div>
      <Nav className="flex-column gap-2">
        <Nav.Link
          as={Link}
          to="/"
          className={`rounded px-3 py-2 ${location.pathname === "/" ? "bg-primary text-white" : "text-body"}`}
        >
          <i className="bi bi-grid-fill me-2"></i> Dashboard
        </Nav.Link>

        {userData.role === "super_admin" && (
          <Nav.Link
            as={Link}
            to="/users"
            className={`rounded px-3 py-2 ${location.pathname === "/users" ? "bg-primary text-white" : "text-body"}`}
          >
            <i className="bi bi-people-fill me-2"></i> Users
          </Nav.Link>
        )}

        {/* ... inside your Sidebar code ... */}

        <div className="mt-4 text-muted small fw-bold text-uppercase px-2">
          Management
        </div>

        <Link
          to="/email"
          className={`nav-link px-3 mb-1 ${location.pathname === "/email" ? "active bg-primary text-white shadow-sm rounded" : "text-body"}`}
        >
          <i className="bi bi-envelope me-2"></i> Email
        </Link>

        <Link
          to="/calendar"
          className={`nav-link px-3 mb-1 ${location.pathname === "/calendar" ? "active bg-primary text-white shadow-sm rounded" : "text-body"}`}
        >
          <i className="bi bi-calendar-event me-2"></i> Calendar
        </Link>

        <Link
          to="/logs"
          className={`nav-link px-3 mb-1 ${location.pathname === "/logs" ? "active bg-primary text-white shadow-sm rounded" : "text-body"}`}
        >
          <i className="bi bi-clock-history me-2"></i> Activity Logs
        </Link>
      </Nav>
    </div>
  );

  return (
    <div className="d-flex min-vh-100 bg-body-tertiary w-100">
      {" "}
      {/* Changed bg-light to bg-body-tertiary */}
      {/* Desktop Sidebar */}
      <div
        className="d-none d-lg-block border-end"
        style={{
          width: "250px",
          minWidth: "250px",
          height: "100vh",
          position: "sticky",
          top: 0,
        }}
      >
        <SidebarContent />
      </div>
      {/* Main Content */}
      <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
        <Navbar className="border-bottom px-3 bg-body" expand={false}>
          {" "}
          {/* Changed bg-white to bg-body */}
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="d-flex align-items-center">
              <Button
                variant="link"
                className="d-lg-none text-body p-0 me-3"
                onClick={() => setShow(true)}
              >
                <i className="bi bi-list fs-2"></i>
              </Button>
              <h6 className="mb-0 text-muted d-none d-md-block">
                Welcome back, {userData.name}
              </h6>
            </div>

            <Dropdown align="end">
              <Dropdown.Toggle
                variant="link"
                className="d-flex align-items-center gap-2 border-0 bg-transparent text-decoration-none"
                id="user-dropdown"
              >
                <div
                  className="text-end d-none d-md-block"
                  style={{ lineHeight: "1.2" }}
                >
                  <div
                    className={`fw-bold small ${theme === "dark" ? "text-light" : "text-dark"}`}
                  >
                    {userData.name}
                  </div>
                  <div
                    className="text-muted small"
                    style={{ fontSize: "0.7rem" }}
                  >
                    {userData.role.replace("_", " ")}
                  </div>
                </div>
                <div
                  className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 32, height: 32 }}
                >
                  {userData.name.charAt(0).toUpperCase()}
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="shadow border-0 mt-2">
                <Dropdown.Item as={Link} to="/profile">
                  <i className="bi bi-person-gear me-2"></i>Profile
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout} className="text-danger">
                  <i className="bi bi-box-arrow-right me-2"></i>Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Navbar>

        <Container fluid className="p-4">
          {children}
        </Container>
      </div>
      {/* Mobile Sidebar */}
      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        placement="start"
        className="bg-body"
      >
        <Offcanvas.Header closeButton />
        <Offcanvas.Body className="p-0">
          <SidebarContent />
        </Offcanvas.Body>
      </Offcanvas>
      {/* --- THEME TOGGLE BUTTON (FLOATING) --- */}
      <Button
        variant={theme === "dark" ? "light" : "dark"}
        onClick={toggleTheme}
        className="rounded-circle shadow-lg d-flex align-items-center justify-content-center"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "50px",
          height: "50px",
          zIndex: 1050,
        }}
        title="Toggle Theme"
      >
        <i
          className={`bi ${theme === "dark" ? "bi-sun-fill" : "bi-moon-fill"} fs-5`}
        ></i>
      </Button>
    </div>
  );
}
