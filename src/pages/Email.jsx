import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Form, Button, Spinner, Container, Card, Badge, Row, Col } from "react-bootstrap";
import Layout from "../components/Layout";
import emailjs from "@emailjs/browser";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { db } from "../firebase";

export default function Email() {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetGroup, setTargetGroup] = useState("self"); // 'self' | 'core_team' | 'approved_users'
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  // EmailJS Config from environment variables
  const SERVICE_ID =
    import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_og3ze6m";
  const TEMPLATE_ID =
    import.meta.env.VITE_EMAILJS_TEMPLATE_BROADCAST || "template_mr9nv9c";
  const PUBLIC_KEY =
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "PzNJuoItwBZtKTwOG";

  // Fetch recipients whenever targetGroup changes
  const loadRecipients = useCallback(async () => {
    if (targetGroup === "self") {
      setRecipients([
        {
          name: user?.displayName || "Admin",
          email: user?.email || "",
        },
      ]);
      return;
    }

    setLoadingRecipients(true);
    try {
      if (targetGroup === "core_team") {
        const snap = await getDocs(collection(db, "global_core_team"));
        const list = snap.docs
          .map((d) => ({
            name: d.data().name || "Core Team Member",
            email: d.data().email || d.data().phone || "",
          }))
          .filter((m) => m.email && m.email.includes("@"));
        setRecipients(list);
      } else if (targetGroup === "approved_users") {
        const q = query(
          collection(db, "users"),
          where("status", "==", "approved"),
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({
            name: d.data().name || "Member",
            email: d.data().email || "",
          }))
          .filter((u) => u.email && u.email.includes("@"));
        setRecipients(list);
      }
    } catch (error) {
      console.error("Error loading recipients:", error);
      showError("Could not load recipients: " + error.message);
    } finally {
      setLoadingRecipients(false);
    }
  }, [targetGroup, user, showError]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!user || !user.email) {
      showError("You must be logged in to send emails.");
      return;
    }

    if (recipients.length === 0) {
      showError("No valid recipients found for the selected audience.");
      return;
    }

    // Confirmation if sending to multiple recipients
    if (recipients.length > 1) {
      const ok = await confirm({
        title: "Confirm Email Broadcast",
        message: `You are about to send this announcement to ${recipients.length} recipients. Do you wish to proceed?`,
        confirmText: `Send to ${recipients.length} Recipients`,
        variant: "primary",
      });
      if (!ok) return;
    }

    setSending(true);

    try {
      let sentCount = 0;
      for (const recipient of recipients) {
        const templateParams = {
          name: recipient.name || "Member",
          email: recipient.email,
          title: subject,
          message: message,
          url: window.location.origin,
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
        sentCount += 1;
      }

      showSuccess(
        `Announcement successfully sent to ${sentCount} recipient${sentCount > 1 ? "s" : ""}!`,
      );
      setSubject("");
      setMessage("");
    } catch (error) {
      console.error(error);
      showError("Failed to send: " + (error.text || error.message));
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    backgroundColor: "var(--bg-main)",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
  };

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">Broadcast Email</h3>
          <p className="text-muted small">
            Send announcements and updates to committee members
          </p>
        </div>
      </div>

      <Container style={{ maxWidth: "800px" }} className="px-0">
        <Row className="g-4">
          {/* Main Compose Card */}
          <Col md={12}>
            <div className="soft-card text-start p-4">
              <Form onSubmit={handleSendBroadcast}>
                {/* Target Audience Selector */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Recipient Audience</Form.Label>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <Button
                      size="sm"
                      variant={
                        targetGroup === "self" ? "primary" : "outline-secondary"
                      }
                      className="rounded-pill"
                      onClick={() => setTargetGroup("self")}
                    >
                      <i className="bi bi-person me-1"></i> Send Test to Myself
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        targetGroup === "core_team"
                          ? "primary"
                          : "outline-secondary"
                      }
                      className="rounded-pill"
                      onClick={() => setTargetGroup("core_team")}
                    >
                      <i className="bi bi-people me-1"></i> Core Team
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        targetGroup === "approved_users"
                          ? "primary"
                          : "outline-secondary"
                      }
                      className="rounded-pill"
                      onClick={() => setTargetGroup("approved_users")}
                    >
                      <i className="bi bi-shield-check me-1"></i> All Approved Users
                    </Button>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <small className="text-muted">
                      Target count:{" "}
                      {loadingRecipients ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <Badge bg="info" className="text-dark">
                          {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </small>
                    {targetGroup === "self" && (
                      <small className="text-muted">({user?.email})</small>
                    )}
                  </div>
                </Form.Group>

                {/* Subject Field */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Subject</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. Cultural Fest 2026 - Meeting Schedule"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </Form.Group>

                {/* Message Field */}
                <Form.Group className="mb-4">
                  <Form.Label className="fw-bold">Message Content</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    placeholder="Type your announcement here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </Form.Group>

                {/* Live Preview Box */}
                {(subject || message) && (
                  <Card
                    className="mb-4 shadow-sm"
                    style={{
                      backgroundColor: "var(--soft-hover)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <Card.Header className="bg-transparent border-0 pb-0 small text-muted text-uppercase fw-bold">
                      <i className="bi bi-eye me-1"></i> Live Email Preview
                    </Card.Header>
                    <Card.Body>
                      <h6 className="fw-bold text-primary mb-2">
                        {subject || "(No Subject)"}
                      </h6>
                      <p
                        className="mb-0 text-body small"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {message || "(No message body)"}
                      </p>
                    </Card.Body>
                  </Card>
                )}

                <div className="d-grid">
                  <Button
                    variant="primary"
                    size="lg"
                    type="submit"
                    disabled={sending || loadingRecipients}
                  >
                    {sending ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill me-2"></i>
                        {targetGroup === "self"
                          ? "Send Test Announcement"
                          : `Broadcast to ${recipients.length} Recipient${recipients.length !== 1 ? "s" : ""}`}
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </Layout>
  );
}
