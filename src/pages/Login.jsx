import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link } from "react-router-dom"; // Added Link
import { Container, Form, Button, Alert, Spinner } from "react-bootstrap";
import "../assets/DashboardStyles.css"; // Ensure theme variables are available

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Failed to sign in. Check your email/password.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError("Google Sign-In failed. Please try again.");
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div
        className="d-flex vh-100 align-items-center justify-content-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
      </div>
    );
  }

  return (
    <div
      className="d-flex vh-100 align-items-center justify-content-center"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <Container style={{ maxWidth: "420px" }}>
        {/* Using soft-card class for theme consistency */}
        <div className="soft-card p-5 shadow-sm text-start">
          <h2 className="text-center fw-bold mb-2">Admin Login</h2>
          <p className="text-center text-muted small mb-4">
            GNDEC Cultural Committee Portal
          </p>

          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold">Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="py-2"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label className="small fw-bold">Password</Form.Label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: "0.75rem" }}
                  className="text-decoration-none"
                >
                  Forgot?
                </Link>
              </div>
              <Form.Control
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="py-2"
              />
            </Form.Group>

            <div className="d-grid gap-3">
              <Button
                variant="primary"
                type="submit"
                disabled={loading}
                size="lg"
                className="fw-bold"
              >
                {loading ? (
                  <Spinner as="span" animation="border" size="sm" />
                ) : (
                  "Log In"
                )}
              </Button>

              <div className="position-relative text-center my-2">
                <hr style={{ borderColor: "var(--border-color)" }} />
                <span
                  className="position-absolute top-50 start-50 translate-middle px-3 small text-muted"
                  style={{ backgroundColor: "var(--bg-card)" }}
                >
                  OR
                </span>
              </div>

              <Button
                variant="outline-secondary"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="d-flex align-items-center justify-content-center py-2"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                <i className="bi bi-google me-2"></i> Continue with Google
              </Button>
            </div>
          </Form>

          <div className="text-center mt-4">
            <p className="small text-muted mb-0">
              Don't have an account?{" "}
              <Link to="/signup" className="fw-bold text-decoration-none">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
