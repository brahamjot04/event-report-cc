import { useState } from "react";
import {
  signInWithEmailAndPassword,
  signInWithRedirect,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { Container, Form, Button, Alert, Spinner } from "react-bootstrap";
import "../assets/DashboardStyles.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Failed to sign in. Check your email/password.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // Redirect to Google — page navigates away fully (no popup needed).
      // AuthContext handles getRedirectResult on return; PublicRoute auto-redirects to /.
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error(err);
      setError("Google Sign-In failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex vh-100 align-items-center justify-content-center"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <Container style={{ maxWidth: "420px" }}>
        {/* Soft UI Card with proper background for Dark Mode */}
        <div
          className="soft-card p-5 shadow-sm text-start"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <div className="text-center mb-4">
            {/* Optional: Add Logo Here if you have one */}
            {/* <img src="/logo.png" alt="Logo" height="50" className="mb-3" /> */}
            <h2 className="fw-bold mb-1">Welcome Back</h2>
            <p className="text-muted small">
              Sign in to the Cultural Committee Portal
            </p>
          </div>

          {error && (
            <Alert variant="danger" className="py-2 small mb-4">
              <i className="bi bi-exclamation-circle-fill me-2"></i>
              {error}
            </Alert>
          )}

          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
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
                className="py-2 form-control" // Uses CSS variables from DashboardStyles
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="small fw-bold text-muted mb-0">
                  PASSWORD
                </Form.Label>
                <Link
                  to="/forgot-password"
                  className="text-decoration-none small"
                  style={{ color: "#0d6efd" }}
                >
                  Forgot password?
                </Link>
              </div>
              <Form.Control
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                  "Sign In"
                )}
              </Button>

              <div className="position-relative text-center my-2">
                <hr style={{ borderColor: "var(--border-color)" }} />
                <span
                  className="position-absolute top-50 start-50 translate-middle px-3 small text-muted"
                  style={{ backgroundColor: "var(--bg-card)" }} // Matches card bg in Dark Mode
                >
                  OR
                </span>
              </div>

              <Button
                variant="outline-secondary"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="d-flex align-items-center justify-content-center py-2 bg-transparent"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                <i className="bi bi-google me-2 text-danger"></i> Continue with
                Google
              </Button>
            </div>
          </Form>

          <div
            className="text-center mt-4 pt-2 border-top"
            style={{ borderColor: "var(--border-color)" }}
          >
            <p className="small text-muted mb-0 mt-3">
              Don't have an account?{" "}
              <Link to="/signup" className="fw-bold text-decoration-none ms-1">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
