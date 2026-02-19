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
  Spinner,
  Modal,
  Form,
  Tabs,
  Tab,
} from "react-bootstrap";
import Layout from "../components/Layout";
import emailjs from "@emailjs/browser";
import { logAction } from "../utils/logger";

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

  const navigate = useNavigate();

  const EMAILJS_SERVICE_ID = "service_og3ze6m";
  const EMAILJS_TEMPLATE_ID = "template_xbboh6j";
  const EMAILJS_PUBLIC_KEY = "PzNJuoItwBZtKTwOG";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role !== "super_admin" && role !== "admin") {
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateStatus = async (userId, newStatus, currentRole) => {
    await updateDoc(doc(db, "users", userId), {
      status: newStatus,
      role: currentRole,
    });
    fetchUsers();
  };

  // NEW FUNCTION: specifically for toggling user vs admin roles
  const updateRole = async (userId, newRole) => {
    if (
      window.confirm(`Are you sure you want to make this person an ${newRole}?`)
    ) {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
      });
      fetchUsers();
    }
  };

  const handleCreateUser = async () => {
    setCreating(true);
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

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: "approved",
        createdAt: new Date(),
      });

      await deleteApp(secondaryApp);

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          name: newUser.name,
          email: newUser.email,
          password: tempPassword,
          url: window.location.origin,
        },
        EMAILJS_PUBLIC_KEY,
      );

      setShowCreateModal(false);
      setShowSuccessModal(true);
      fetchUsers();
      await logAction(
        "CREATE_USER",
        `Created user: ${newUser.email} as ${newUser.role}`,
      );
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="p-5 text-center">
          <Spinner animation="border" variant="primary" />
        </div>
      </Layout>
    );

  const activeUsers = users.filter(
    (u) => u.status === "approved" || u.status === "suspended",
  );
  const pendingUsers = users.filter((u) => u.status === "pending");

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="fw-bold mb-0">User Management</h2>
          <p className="text-muted small">Manage system access and roles</p>
        </div>
        <Button
          variant="primary"
          className="rounded-pill px-4"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="bi bi-person-plus-fill me-2"></i> Add User
        </Button>
      </div>

      <Tabs defaultActiveKey="active" className="mb-4 custom-tabs border-0">
        <Tab eventKey="active" title={`Active Users (${activeUsers.length})`}>
          <div
            className="soft-card p-0 overflow-hidden"
            style={{ height: "fit-content" }}
          >
            <Table hover responsive className="mb-0 align-middle">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr className="small text-uppercase text-muted">
                  <th className="ps-4 py-3 text-start" style={{ width: "40%" }}>
                    User
                  </th>
                  <th className="text-start">Role</th>
                  <th className="text-start">Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="ps-4 py-3">
                      <div className="d-flex align-items-center text-start">
                        <div
                          className="avatar-circle bg-primary-subtle text-primary me-3 flex-shrink-0"
                          style={{ width: 40, height: 40, fontSize: "1rem" }}
                        >
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-start">
                          <div
                            className="fw-bold text-body"
                            style={{ color: "var(--text-primary) !important" }}
                          >
                            {user.name}
                          </div>
                          <div className="small text-muted">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-start">
                      <Badge
                        bg={user.role === "super_admin" ? "danger" : "primary"}
                        className="bg-opacity-10 text-primary fw-normal"
                      >
                        {user.role?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="text-start">
                      <Badge
                        bg={user.status === "approved" ? "success" : "warning"}
                        className="bg-opacity-10 text-success rounded-pill px-3"
                      >
                        {user.status === "approved" ? "Active" : "Suspended"}
                      </Badge>
                    </td>
                    <td className="text-end pe-4">
                      {user.role !== "super_admin" && (
                        <div className="d-flex justify-content-end align-items-center gap-3">
                          {/* ROLE TOGGLE BUTTON */}
                          {user.role === "user" ? (
                            <Button
                              variant="link"
                              className="p-0 text-decoration-none small fw-bold"
                              style={{ color: "var(--text-primary)" }}
                              onClick={() => updateRole(user.id, "admin")}
                            >
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="link"
                              className="text-secondary p-0 text-decoration-none small fw-bold"
                              onClick={() => updateRole(user.id, "user")}
                            >
                              Remove Admin
                            </Button>
                          )}

                          {/* SUSPEND/RESTORE BUTTON */}
                          <Button
                            variant="link"
                            className="text-danger p-0 text-decoration-none small fw-bold"
                            onClick={() =>
                              updateStatus(
                                user.id,
                                user.status === "approved"
                                  ? "suspended"
                                  : "approved",
                                user.role,
                              )
                            }
                          >
                            {user.status === "approved"
                              ? "Revoke Access"
                              : "Restore Access"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Tab>

        <Tab
          eventKey="pending"
          title={`Pending Approvals (${pendingUsers.length})`}
        >
          <div
            className="soft-card p-0 overflow-hidden"
            style={{ height: "fit-content" }}
          >
            <Table hover responsive className="mb-0 align-middle">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr className="small text-uppercase text-muted">
                  <th className="ps-4 py-3 text-start">Requestor</th>
                  <th className="text-start">Email</th>
                  <th className="text-end pe-4">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="text-center py-4 text-muted border-0"
                    >
                      No pending user requests.
                    </td>
                  </tr>
                ) : (
                  pendingUsers.map((user) => (
                    <tr
                      key={user.id}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 py-3 fw-bold text-start text-body">
                        {user.name}
                      </td>
                      <td className="text-start text-muted small">
                        {user.email}
                      </td>
                      <td className="text-end pe-4">
                        <Button
                          variant="success"
                          size="sm"
                          className="me-2 rounded-pill px-3"
                          onClick={() =>
                            updateStatus(user.id, "approved", "admin")
                          }
                        >
                          Approve as Admin
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="rounded-pill px-3"
                          onClick={() =>
                            updateStatus(user.id, "approved", "user")
                          }
                        >
                          Approve as Viewer
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Tab>
      </Tabs>

      {/* MODALS */}
      <Modal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        centered
      >
        <div
          className="soft-card border-0"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="fw-bold">Create New User</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-start">
            <Form className="d-grid gap-3">
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  FULL NAME
                </Form.Label>
                <Form.Control
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  EMAIL ADDRESS
                </Form.Label>
                <Form.Control
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  ROLE
                </Form.Label>
                <Form.Select
                  className="form-select"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
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
          <Modal.Footer className="border-0">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              disabled={creating}
            >
              {creating ? <Spinner size="sm" /> : "Create User"}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        centered
      >
        <div
          className="soft-card border-0 text-center"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="text-success fw-bold">Success!</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div
              className="avatar-circle bg-success-subtle text-success mx-auto mb-3"
              style={{ width: 60, height: 60 }}
            >
              <i className="bi bi-check-lg fs-2"></i>
            </div>
            <p>
              Temporary password generated for <strong>{newUser.email}</strong>:
            </p>
            <div
              className="p-3 rounded border mb-3"
              style={{
                backgroundColor: "var(--soft-hover)",
                borderColor: "var(--border-color)",
              }}
            >
              <code className="fs-4 text-danger fw-bold">{generatedPass}</code>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button
              variant="success"
              className="w-100 rounded-pill"
              onClick={() => setShowSuccessModal(false)}
            >
              Done
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
