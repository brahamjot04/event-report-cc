import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { Link } from "react-router-dom";
import { Container, Form, Button, Alert, Spinner } from "react-bootstrap";
import "../assets/DashboardStyles.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Password reset error:", err);
      // Prevent email enumeration: Treat user-not-found identically to success
      if (err.code === "auth/user-not-found") {
        setSubmitted(true);
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a moment before trying again.");
      } else {
        setError("Failed to process request. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex vh-100 align-items-center justify-content-center p-3"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <Container style={{ maxWidth: "440px" }}>
        <div
          className="soft-card p-4 p-sm-5 shadow-sm text-start"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          {submitted ? (
            <div className="text-center py-2">
              <div
                className="avatar-circle bg-success-subtle text-success mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: 64, height: 64 }}
              >
                <i className="bi bi-envelope-check-fill fs-2"></i>
              </div>
              <h3 className="fw-bold mb-2">Check Your Email</h3>
              <p className="text-muted small mb-4">
                If an account with <strong>{email}</strong> exists, a password reset link has been dispatched to your inbox. The link will expire shortly.
              </p>
              <div className="d-grid gap-2">
                <Link
                  to="/login"
                  className="btn btn-primary fw-bold py-2"
                  style={{ fontSize: "1rem" }}
                >
                  Return to Sign In
                </Link>
                <Button
                  variant="outline-secondary"
                  className="py-2 bg-transparent"
                  style={{
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                >
                  Try Another Email
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div
                  className="avatar-circle bg-primary-subtle text-primary mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 60, height: 60 }}
                >
                  <i className="bi bi-shield-lock-fill fs-2"></i>
                </div>
                <h2 className="fw-bold mb-1">Forgot Password?</h2>
                <p className="text-muted small">
                  Enter the email associated with your account and we&apos;ll send you a secure link to reset your password.
                </p>
              </div>

              {error && (
                <Alert variant="danger" className="py-2 small mb-4">
                  <i className="bi bi-exclamation-circle-fill me-2"></i>
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleReset}>
                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-muted">
                    EMAIL ADDRESS
                  </Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="py-2 form-control"
                  />
                </Form.Group>

                <div className="d-grid gap-3">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="fw-bold"
                    style={{ fontSize: "1rem" }}
                  >
                    {loading ? (
                      <Spinner as="span" animation="border" size="sm" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <Link
                    to="/login"
                    className="btn btn-outline-secondary py-2 bg-transparent text-center"
                    style={{
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Sign In
                  </Link>
                </div>
              </Form>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
