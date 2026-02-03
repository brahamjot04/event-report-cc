import { useState, useEffect } from "react";
import { Navbar, Nav, Offcanvas, Dropdown, Button, Container } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Layout({ children }) {
  const [show, setShow] = useState(false);
  const [userData, setUserData] = useState({ name: "Loading...", role: "user" });
  const location = useLocation();
  const navigate = useNavigate();

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
          role: data.role || "user"
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
    <div className="d-flex flex-column h-100 p-3 bg-white">
      {/* BRANDING UPDATE HERE */}
      <div className="d-flex align-items-center mb-4 px-2 text-nowrap">
        <span className="fs-5 fw-bold text-primary">Cultural</span>
        <span className="fs-5 fw-bold text-dark ms-1">Committee</span>
      </div>
      
      <Nav className="flex-column gap-2">
        <Nav.Link as={Link} to="/" className={`rounded px-3 py-2 ${location.pathname === "/" ? "bg-primary text-white" : "text-dark"}`}>
          <i className="bi bi-grid-fill me-2"></i> Dashboard
        </Nav.Link>

        {userData.role === 'super_admin' && (
          <Nav.Link as={Link} to="/users" className={`rounded px-3 py-2 ${location.pathname === "/users" ? "bg-primary text-white" : "text-dark"}`}>
            <i className="bi bi-people-fill me-2"></i> Users
          </Nav.Link>
        )}
        
        <div className="mt-4 text-muted small fw-bold text-uppercase px-2">Management</div>
        <Nav.Link disabled className="text-secondary px-3"><i className="bi bi-envelope me-2"></i> Email</Nav.Link>
        <Nav.Link disabled className="text-secondary px-3"><i className="bi bi-calendar-event me-2"></i> Calendar</Nav.Link>
      </Nav>
    </div>
  );

  return (
    <div className="d-flex min-vh-100 bg-light w-100">
      <div className="d-none d-lg-block bg-white border-end" style={{ width: '250px', minWidth: '250px', height: '100vh', position: 'sticky', top: 0 }}>
        <SidebarContent />
      </div>

      <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
        <Navbar bg="white" className="border-bottom px-3" expand={false}>
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="d-flex align-items-center">
              <Button variant="link" className="d-lg-none text-dark p-0 me-3" onClick={() => setShow(true)}>
                <i className="bi bi-list fs-2"></i>
              </Button>
              <h6 className="mb-0 text-muted d-none d-md-block">Welcome back, {userData.name}</h6>
            </div>

            <Dropdown align="end">
              <Dropdown.Toggle variant="light" className="d-flex align-items-center gap-2 border-0 bg-transparent" id="user-dropdown">
                <div className="text-end d-none d-md-block" style={{lineHeight: '1.2'}}>
                  <div className="fw-bold small">{userData.name}</div>
                  <div className="text-muted small" style={{fontSize: '0.7rem'}}>{userData.role.replace("_", " ")}</div>
                </div>
                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{width: 32, height: 32}}>
                   {userData.name.charAt(0).toUpperCase()}
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="shadow border-0 mt-2">
                <Dropdown.Item onClick={handleLogout} className="text-danger">Logout</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Navbar>

        <Container fluid className="p-4">
          {children}
        </Container>
      </div>

      <Offcanvas show={show} onHide={() => setShow(false)} placement="start">
        <Offcanvas.Header closeButton />
        <Offcanvas.Body className="p-0">
          <SidebarContent />
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
}