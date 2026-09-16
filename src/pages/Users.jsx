import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
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
import { logSentEmail } from "../utils/emailLogger";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { loadWithCache, invalidateCache } from "../utils/dataCache";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);

  const { showSuccess, showError, confirm } = useToast();

  const EMAILJS_SERVICE_ID =
    import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_og3ze6m";
  const EMAILJS_TEMPLATE_ID =
    import.meta.env.VITE_EMAILJS_TEMPLATE_USER_CREDENTIALS || "template_xbboh6j";
  const EMAILJS_PUBLIC_KEY =
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "PzNJuoItwBZtKTwOG";

  const fetchUsers = async (forceFresh = false) => {
    if (forceFresh) {
      invalidateCache("all_users_list");
    }
    await loadWithCache(
      "all_users_list",
      async () => {
        const snap = await getDocs(collection(db, "users"));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      (data, isCached) => {
        setUsers(data);
        if (isCached) setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
      }
    );
    setLoading(false);
  };

  useEffect(() => {
    document.title = "User Management | CC GNDEC";
    fetchUsers();
  }, []);

  const updateStatus = async (userId, newStatus, currentRole) => {
    const user = users.find((u) => u.id === userId);
    const action = newStatus === "approved" ? "APPROVE" : "SUSPEND";
    const confirmed = await confirm({
      title: `${action === "APPROVE" ? "Approve" : "Suspend"} User`,
      message: `Are you sure you want to ${action.toLowerCase()} ${user?.name || user?.email || "this user"}?`,
      variant: action === "APPROVE" ? "success" : "danger",
      confirmText: action === "APPROVE" ? "Approve" : "Suspend",
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus,
        role: currentRole,
      });
      invalidateCache("all_users_list");
      invalidateCache("email_recipients_approved_users");
      showSuccess(`User marked as ${newStatus}.`);
      fetchUsers(true);
      const message = `${action} user: ${user?.name} (${user?.email}) - Role: ${currentRole}`;
      await logAction(action, message, currentUser);
    } catch (error) {
      console.error(error);
      showError("Failed to update status: " + error.message);
    }
  };

  // Specifically for toggling user vs admin roles
  const updateRole = async (userId, newRole) => {
    const user = users.find((u) => u.id === userId);
    const confirmed = await confirm({
      title: "Update User Role",
      message: `Are you sure you want to make ${user?.name || user?.email || "this user"} a ${newRole}?`,
      variant: "warning",
      confirmText: "Change Role",
    });
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
      });
      invalidateCache("all_users_list");
      showSuccess(`Role updated to ${newRole}.`);
      fetchUsers(true);
      const message = `Changed role for ${user?.name} (${user?.email}) to ${newRole}`;
      await logAction("UPDATE_ROLE", message, currentUser);
    } catch (error) {
      console.error(error);
      showError("Failed to update role: " + error.message);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      showError("Please enter both full name and email address.");
      return;
    }

    setCreating(true);

    try {
      // 1. Get authenticated Admin ID Token
      const idToken = await currentUser.getIdToken();

      // 2. Call serverless backend to create user and generate official password reset link
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: newUser.name.trim(),
          email: newUser.email.trim(),
          role: newUser.role,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create user invitation.");
      }

      const resetLink = data.resetLink;

      // 3. Deliver official invitation & password setup link via EmailJS to land in Primary Inbox
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          name: newUser.name.trim(),
          to_name: newUser.name.trim(),
          email: newUser.email.trim(),
          to_email: newUser.email.trim(),
          role: newUser.role,
          reset_link: resetLink,
          url: resetLink,
          action_url: resetLink,
          reply_to: currentUser?.email || "",
        },
        EMAILJS_PUBLIC_KEY
      );

      await logSentEmail({
        type: "user_invitation",
        subject: "Cultural Committee Account Invitation & Password Setup",
        message: `Account created for ${newUser.name} (${newUser.email}) with role: ${newUser.role}. Secure password setup link delivered via EmailJS.`,
        audience: "new_user",
        recipients: [
          {
            name: newUser.name,
            email: newUser.email,
            status: "sent",
            sentAt: new Date().toISOString(),
          },
        ],
        successfulCount: 1,
        failedCount: 0,
        status: "sent",
        sender: currentUser,
      });

      invalidateCache("all_users_list");
      invalidateCache("email_recipients_approved_users");
      setShowCreateModal(false);
      setShowSuccessModal(true);
      fetchUsers(true);
      await logAction(
        "CREATE_USER",
        `Created user: ${newUser.email} as ${newUser.role} and sent password setup invitation via EmailJS`,
        currentUser,
      );
    } catch (error) {
      console.error("Create user error:", error);
      showError("Error: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSendPasswordReset = async (user) => {
    const confirmed = await confirm({
      title: "Send Password Reset Link",
      message: `Send an official password reset email to ${user?.name || user?.email} (${user?.email})?`,
      variant: "primary",
      confirmText: "Send Reset Link",
    });
    if (!confirmed) return;

    setResettingUserId(user.id);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: user.name || "Member",
          email: user.email.trim(),
          role: user.role || "user",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate password reset link.");
      }

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          name: user?.name || user?.email,
          to_name: user?.name || user?.email,
          email: user.email.trim(),
          to_email: user.email.trim(),
          role: user.role || "user",
          reset_link: data.resetLink,
          url: data.resetLink,
          action_url: data.resetLink,
          reply_to: currentUser?.email || "",
        },
        EMAILJS_PUBLIC_KEY
      );

      await logSentEmail({
        type: "password_reset",
        subject: "Cultural Committee Password Reset",
        message: `Password reset link delivered to ${user.name || user.email} (${user.email}) via EmailJS.`,
        audience: "individual",
        recipients: [
          {
            name: user.name || user.email,
            email: user.email,
            status: "sent",
            sentAt: new Date().toISOString(),
          },
        ],
        successfulCount: 1,
        failedCount: 0,
        status: "sent",
        sender: currentUser,
      });

      showSuccess(`Password reset link sent to ${user.email} via EmailJS`);
      await logAction(
        "PASSWORD_RESET_DISPATCH",
        `Dispatched password reset email to ${user.email} via EmailJS`,
        currentUser,
      );
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      showError("Failed to send reset email: " + err.message);
    } finally {
      setResettingUserId(null);
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
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4 mb-md-5">
        <div>
          <h2 className="fw-bold mb-0">User Management</h2>
          <p className="text-muted small mb-0">Manage system access and roles</p>
        </div>
        <Button
          variant="primary"
          className="rounded-pill px-4 w-100 w-sm-auto"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="bi bi-person-plus-fill me-2"></i> Add User
        </Button>
      </div>

      <Tabs defaultActiveKey="active" className="mb-4 custom-tabs border-0">
        <Tab eventKey="active" title={`Active Users (${activeUsers.length})`}>
          {/* Role Filter Chips */}
          <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small fw-bold me-2">
              Filter by role:
            </span>
            <Button
              size="sm"
              variant={
                selectedRoleFilter === null ? "primary" : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedRoleFilter(null)}
            >
              All Roles
            </Button>
            <Button
              size="sm"
              variant={
                selectedRoleFilter === "super_admin"
                  ? "primary"
                  : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedRoleFilter("super_admin")}
            >
              Super Admin
            </Button>
            <Button
              size="sm"
              variant={
                selectedRoleFilter === "admin" ? "primary" : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedRoleFilter("admin")}
            >
              Admin
            </Button>
            <Button
              size="sm"
              variant={
                selectedRoleFilter === "user" ? "primary" : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedRoleFilter("user")}
            >
              User
            </Button>
          </div>

          {/* Status Filter Chips */}
          <div className="mb-4 d-flex flex-wrap gap-2 align-items-center">
            <span className="text-muted small fw-bold me-2">
              Filter by status:
            </span>
            <Button
              size="sm"
              variant={
                selectedStatusFilter === null ? "primary" : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedStatusFilter(null)}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={
                selectedStatusFilter === "approved"
                  ? "primary"
                  : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedStatusFilter("approved")}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={
                selectedStatusFilter === "suspended"
                  ? "primary"
                  : "outline-secondary"
              }
              className="rounded-pill"
              onClick={() => setSelectedStatusFilter("suspended")}
            >
              Suspended
            </Button>
          </div>

          <div
            className="soft-card p-0 overflow-hidden"
            style={{ height: "fit-content" }}
          >
            <Table hover responsive className="mb-0 align-middle">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr className="small text-uppercase text-muted">
                  <th className="ps-4 py-3 text-start" style={{ width: "35%" }}>
                    User
                  </th>
                  <th className="text-start">Role</th>
                  <th className="text-start">Status</th>
                  <th className="text-center">Reset Password</th>
                  <th className="text-center">Make Admin</th>
                  <th className="text-end pe-4">Revoke Access</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers
                  .filter(
                    (user) =>
                      (selectedRoleFilter === null ||
                        user.role === selectedRoleFilter) &&
                      (selectedStatusFilter === null ||
                        user.status === selectedStatusFilter),
                  )
                  .map((user) => (
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
                              style={{
                                color: "var(--text-primary) !important",
                              }}
                            >
                              {user.name}
                            </div>
                            <div className="small text-muted">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-start">
                        <Badge
                          bg={
                            user.role === "super_admin" ? "danger" : "primary"
                          }
                          className="bg-opacity-10 text-primary fw-normal"
                        >
                          {user.role?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="text-start">
                        <Badge
                          bg={
                            user.status === "approved" ? "success" : "warning"
                          }
                          className="bg-opacity-10 text-success rounded-pill px-3"
                        >
                          {user.status === "approved" ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="px-2 py-1 rounded-pill"
                          title="Send Password Reset Email"
                          disabled={resettingUserId === user.id}
                          onClick={() => handleSendPasswordReset(user)}
                        >
                          {resettingUserId === user.id ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <>
                              <i className="bi bi-key me-1"></i>Reset Link
                            </>
                          )}
                        </Button>
                      </td>
                      <td className="text-center">
                        {user.role !== "super_admin" && (
                          <>
                            {user.role === "user" ? (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="px-3"
                                onClick={() => updateRole(user.id, "admin")}
                              >
                                Make Admin
                              </Button>
                            ) : (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                className="px-3"
                                onClick={() => updateRole(user.id, "user")}
                              >
                                Remove Admin
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                      <td className="text-center">
                        {user.role !== "super_admin" && (
                          <Button
                            variant={
                              user.status === "approved"
                                ? "outline-danger"
                                : "outline-success"
                            }
                            size="sm"
                            className="px-3"
                            onClick={() => {
                              const newStatus =
                                user.status === "approved"
                                  ? "suspended"
                                  : "approved";
                              updateStatus(user.id, newStatus, user.role);
                            }}
                          >
                            {user.status === "approved" ? (
                              <>Revoke Access</>
                            ) : (
                              <>Restore Access</>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                {activeUsers.filter(
                  (user) =>
                    (selectedRoleFilter === null ||
                      user.role === selectedRoleFilter) &&
                    (selectedStatusFilter === null ||
                      user.status === selectedStatusFilter),
                ).length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-4 text-muted border-0"
                    >
                      <i className="bi bi-people display-4 opacity-25 d-block mb-3"></i>
                      {selectedRoleFilter || selectedStatusFilter
                        ? "No users match the selected filters"
                        : "No active users"}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Tab>

        {pendingUsers.length > 0 && (
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
                  {pendingUsers.map((user) => (
                    <tr
                      key={user.id}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 py-3 fw-bold text-start text-body">
                        {user.name}
                      </td>
                      <td className="text-start text-muted">{user.email}</td>
                      <td className="text-end pe-4">
                        <Button
                          size="sm"
                          variant="success"
                          className="me-2"
                          onClick={() => {
                            updateStatus(user.id, "approved", "admin");
                          }}
                        >
                          Approve as Admin
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            updateStatus(user.id, "approved", "user");
                          }}
                        >
                          Approve as Viewer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Tab>
        )}
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
            <Modal.Title className="text-success fw-bold">User Created</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div
              className="avatar-circle bg-success-subtle text-success mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
              style={{ width: 64, height: 64 }}
            >
              <i className="bi bi-envelope-check-fill fs-2"></i>
            </div>
            <h5 className="fw-bold mb-2">Invitation & Setup Link Sent</h5>
            <p className="text-muted small mb-3">
              Account successfully registered for <strong>{newUser.name}</strong> ({newUser.email}).
            </p>
            <div
              className="p-3 rounded border mb-3 text-start small"
              style={{
                backgroundColor: "var(--soft-hover)",
                borderColor: "var(--border-color)",
              }}
            >
              <i className="bi bi-shield-check text-success me-2 fs-6"></i>
              A secure, single-use password setup link has been dispatched to <strong>{newUser.email}</strong> via verified email. The user will be prompted to create their own private password upon opening the link.
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button
              variant="primary"
              className="w-100 rounded-pill fw-bold"
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
