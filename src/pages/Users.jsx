import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  Badge,
  Card,
  Spinner,
  Modal,
  Form,
  Alert,
} from "react-bootstrap";
import Layout from "../components/Layout";
import emailjs from "@emailjs/browser";
import { logAction } from "../utils/logger";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
const secondaryFirebaseConfig = {
  apiKey: "AIzaSyCF_-t-uGCwdX8ee_01T5qHv9nQX3HfxQw",
  authDomain: "event-report-cc.firebaseapp.com",
  projectId: "event-report-cc",
  storageBucket: "event-report-cc.firebasestorage.app",
  messagingSenderId: "1069208650480",
  appId: "1:1069208650480:web:0e2765c0804db227b3f835",
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });
  const [generatedPass, setGeneratedPass] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailStatus, setEmailStatus] = useState("sending");

  const navigate = useNavigate();

  // --- EMAILJS KEYS ---
  const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
  const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
  const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));

      // FIX: Allow 'admin' AND 'super_admin' to view this page
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role !== "super_admin" && role !== "admin") {
          alert("Access Denied");
          navigate("/");
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateStatus = async (userId, newStatus, newRole) => {
    await updateDoc(doc(db, "users", userId), {
      status: newStatus,
      role: newRole,
    });
    fetchUsers();
  };

  const handleCreateUser = async () => {
    setCreating(true);
    setEmailStatus("sending");

    const tempPassword = Math.random().toString(36).slice(-8) + "1!";
    setGeneratedPass(tempPassword);

    try {
      const secondaryApp = initializeApp(secondaryFirebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newUser.email,
        tempPassword,
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: "approved",
        createdAt: new Date(),
      });

      await deleteApp(secondaryApp);

      const emailParams = {
        name: newUser.name,
        email: newUser.email,
        password: tempPassword,
        url: window.location.origin,
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY,
      );

      setEmailStatus("success");
      setCreating(false);
      setShowCreateModal(false);
      setShowSuccessModal(true);
      fetchUsers();
      await logAction(
        "CREATE_USER",
        `Created new user: ${newUser.email} as ${newUser.role}`,
      );
    } catch (error) {
      console.error("Error:", error);
      if (error.text) {
        setEmailStatus("failed");
        setShowCreateModal(false);
        setShowSuccessModal(true);
        setCreating(false);
        fetchUsers();
      } else {
        alert("Failed to create user: " + error.message);
        setCreating(false);
      }
    }
  };

  if (loading)
    return (
      <div className="p-5 text-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );

  const activeUsers = users.filter((u) => u.status !== "pending");
  const pendingUsers = users.filter((u) => u.status === "pending");

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">User Management</h3>
          <p className="text-muted small">Manage system access and roles</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <i className="bi bi-person-plus-fill me-2"></i> Add User
        </Button>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-warning bg-opacity-10 border-0 p-3">
            <div className="d-flex align-items-center text-warning fw-bold">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              Pending Approvals ({pendingUsers.length})
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead className="small text-uppercase bg-body-tertiary">
                <tr>
                  <th className="ps-4">Full Name</th>
                  <th>Email</th>
                  <th>Date</th>
                  <th className="text-end pe-4">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="ps-4 fw-bold">{user.name}</td>
                    <td>{user.email}</td>
                    <td className="text-muted small">
                      {user.createdAt?.seconds
                        ? new Date(
                            user.createdAt.seconds * 1000,
                          ).toLocaleDateString()
                        : "Today"}
                    </td>
                    <td className="text-end pe-4">
                      <Button
                        variant="success"
                        size="sm"
                        className="me-2 fw-bold"
                        onClick={() =>
                          updateStatus(user.id, "approved", "admin")
                        }
                      >
                        Make Admin
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="fw-bold"
                        onClick={() =>
                          updateStatus(user.id, "approved", "user")
                        }
                      >
                        Viewer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-body border-bottom py-3">
          <h6 className="mb-0 fw-bold">All System Users</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="ps-4 py-3">User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr key={user.id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div
                        className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center me-3 fw-bold"
                        style={{ width: 40, height: 40 }}
                      >
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-bold">{user.name}</div>
                        <div className="small text-muted">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge
                      bg={
                        user.role === "super_admin"
                          ? "danger"
                          : user.role === "admin"
                            ? "primary"
                            : "secondary"
                      }
                    >
                      {user.role === "super_admin"
                        ? "SUPER ADMIN"
                        : user.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      bg="success"
                      className="rounded-pill px-2 fw-normal bg-opacity-75"
                    >
                      Active
                    </Badge>
                  </td>
                  <td className="text-end pe-4">
                    {user.role !== "super_admin" && (
                      <Button
                        variant="link"
                        className="text-danger p-0 text-decoration-none small fw-bold"
                        onClick={() => updateStatus(user.id, "pending", "user")}
                      >
                        Revoke Access
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Create New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                type="text"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value })
                }
              >
                <option value="user">User (Viewer)</option>
                <option value="admin">Admin (Editor)</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateUser}
            disabled={creating}
          >
            {creating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Creating & Sending...
              </>
            ) : (
              "Create User"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title
            className={
              emailStatus === "success" ? "text-success" : "text-warning"
            }
          >
            {emailStatus === "success"
              ? "User Created Successfully!"
              : "User Created, Email Failed"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {emailStatus === "success" ? (
            <Alert variant="success">
              <i className="bi bi-check-circle-fill me-2"></i>An email with
              credentials has been sent to <strong>{newUser.email}</strong>.
            </Alert>
          ) : (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>User
              created, but we couldn't send the email automatically. Please
              share these details manually.
            </Alert>
          )}
          <div className="bg-body-secondary p-3 rounded border text-body">
            <p className="mb-1">
              <strong>Email:</strong> {newUser.email}
            </p>
            <p className="mb-0">
              <strong>Password:</strong>{" "}
              <code className="fs-5 text-danger">{generatedPass}</code>
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="success" onClick={() => setShowSuccessModal(false)}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
