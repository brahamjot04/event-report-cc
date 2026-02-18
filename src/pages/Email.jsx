import { useState } from "react";
import { auth } from "../firebase";
import { Form, Button, Alert, Spinner, Container } from "react-bootstrap";
import Layout from "../components/Layout";
import emailjs from "@emailjs/browser";

export default function Email() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // EmailJS Config (Make sure these are correct in your dashboard)
  const SERVICE_ID = "service_og3ze6m";
  const TEMPLATE_ID = "template_mr9nv9c";
  const PUBLIC_KEY = "PzNJuoItwBZtKTwOG";

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      if (!auth.currentUser || !auth.currentUser.email) {
        throw new Error("You must be logged in.");
      }

      const templateParams = {
        name: auth.currentUser.displayName || "Admin",
        email: auth.currentUser.email,
        title: subject,
        message: message,
        url: window.location.origin,
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      setStatus({
        type: "success",
        msg: `Test announcement sent to ${auth.currentUser.email}`,
      });
      setSubject("");
      setMessage("");
    } catch (error) {
      console.error(error);
      setStatus({
        type: "danger",
        msg: "Failed: " + (error.text || error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper styles for dark-mode compatible inputs
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
            Send announcements to committee members
          </p>
        </div>
      </div>

      <Container style={{ maxWidth: "700px" }} className="px-0">
        {status && (
          <Alert
            variant={status.type}
            onClose={() => setStatus(null)}
            dismissible
          >
            {status.msg}
          </Alert>
        )}

        {/* Replaced Card with soft-card for Dark Mode support */}
        <div className="soft-card text-start p-4">
          <Form onSubmit={handleSendBroadcast}>
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Subject</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Important Meeting Update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                style={inputStyle} // Apply Dark Mode styles
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-bold">Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                placeholder="Type your announcement here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                style={inputStyle} // Apply Dark Mode styles
              />
            </Form.Group>

            <div className="d-grid">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <i className="bi bi-send-fill me-2"></i> Send Announcement
                  </>
                )}
              </Button>
            </div>

            <Form.Text className="text-muted text-center d-block mt-3">
              <i className="bi bi-info-circle me-1"></i>
              Currently in <strong>Safe Mode</strong>: This will only email you
              ({auth.currentUser?.email}).
            </Form.Text>
          </Form>
        </div>
      </Container>
    </Layout>
  );
}
