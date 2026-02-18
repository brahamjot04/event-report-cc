import { useState, useEffect } from "react";
import { updateProfile, updatePassword, getAuth, signOut } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Row, Col, Form, Button, Alert, Spinner, Badge } from "react-bootstrap";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const auth = getAuth();
  const navigate = useNavigate();

  // --- STATE ---
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member"); // Default role

  // Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false); // Local loading for buttons
  const [msg, setMsg] = useState({ type: "", text: "" });

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        setUser(auth.currentUser);
        setEmail(auth.currentUser.email);
        setName(auth.currentUser.displayName || "");

        // Fetch extra details from Firestore (like role)
        try {
          const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) setName(data.name);
            if (data.role) setRole(data.role);
          }
        } catch (err) {
          console.error("Error fetching user doc:", err);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [auth.currentUser]);

  // --- HANDLERS ---
  const handleUpdateName = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setMsg({ type: "", text: "" });

    try {
      await updateProfile(auth.currentUser, { displayName: name });
      // Ensure the 'users' collection document exists or update it
      await updateDoc(doc(db, "users", auth.currentUser.uid), { name: name });
      setMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      // If doc doesn't exist, updateDoc might fail. You might need setDoc with merge:true in a real app if users aren't pre-created.
      setMsg({ type: "danger", text: error.message });
    }
    setIsUpdating(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setMsg({ type: "", text: "" });

    if (newPassword.length < 6) {
      setMsg({
        type: "danger",
        text: "Password must be at least 6 characters.",
      });
      setIsUpdating(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "danger", text: "Passwords do not match." });
      setIsUpdating(false);
      return;
    }

    try {
      await updatePassword(auth.currentUser, newPassword);
      setMsg({ type: "success", text: "Password changed successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error.code === "auth/requires-recent-login") {
        setMsg({
          type: "warning",
          text: "Security: Please logout and login again to change password.",
        });
      } else {
        setMsg({ type: "danger", text: error.message });
      }
    }
    setIsUpdating(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/"); // Redirect to login/home
  };

  if (loading)
    return (
      <Layout>
        <div className="vh-100 d-flex justify-content-center align-items-center">
          <Spinner animation="border" />
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="mb-5">
        <small className="text-muted text-uppercase fw-bold">Settings</small>
        <h2 className="fw-bold mt-1">My Profile</h2>
      </div>

      <Row className="g-4">
        {/* --- LEFT COLUMN: ID CARD --- */}
        <Col md={4}>
          <div className="soft-card p-4 text-center h-100">
            <div
              className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center bg-primary-subtle text-primary fw-bold"
              style={{ width: "100px", height: "100px", fontSize: "2.5rem" }}
            >
              {name ? name.charAt(0).toUpperCase() : "U"}
            </div>

            <h4 className="fw-bold mb-1">{name}</h4>
            <div className="mb-3">
              <Badge bg="primary" className="px-3 py-2 rounded-pill">
                {role}
              </Badge>
            </div>

            <p className="text-muted small mb-4">{email}</p>

            <div className="d-grid gap-2">
              <Button
                variant="danger"
                className="rounded-pill"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right me-2"></i> Sign Out
              </Button>
            </div>
          </div>
        </Col>

        {/* --- RIGHT COLUMN: FORMS --- */}
        <Col md={8}>
          <div className="soft-card p-4 h-100 text-start">
            {/* Feedback Alert */}
            {msg.text && (
              <Alert
                variant={msg.type}
                onClose={() => setMsg({ type: "", text: "" })}
                dismissible
              >
                {msg.text}
              </Alert>
            )}

            {/* 1. Personal Details Form */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold m-0">Personal Information</h5>
            </div>

            <Form onSubmit={handleUpdateName}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      FULL NAME
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      EMAIL ADDRESS
                    </Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      disabled
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>

                <Col md={12} className="text-end mt-3">
                  <Button type="submit" variant="primary" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </Col>
              </Row>
            </Form>

            <hr className="my-5 text-muted" />

            {/* 2. Security Form */}
            <h5 className="fw-bold mb-4 text-danger">Security</h5>
            <Form onSubmit={handleChangePassword}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      NEW PASSWORD
                    </Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Min. 6 chars"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      CONFIRM PASSWORD
                    </Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={12} className="text-end mt-3">
                  <Button
                    type="submit"
                    variant="outline-danger"
                    disabled={isUpdating}
                  >
                    Update Password
                  </Button>
                </Col>
              </Row>
            </Form>
          </div>
        </Col>
      </Row>
    </Layout>
  );
}
