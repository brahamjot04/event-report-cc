import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true); // Prevents "flicker"

  const navigate = useNavigate();

  // --- 1. CHECK IF ALREADY LOGGED IN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/"); // Redirect to Home immediately
      } else {
        setCheckingAuth(false); // Stop loading, show login form
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // --- 2. HANDLE EMAIL LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success! The useEffect above will handle the redirect automatically
    } catch (err) {
      setError("Failed to sign in. Check your email/password.");
      setLoading(false);
    }
  };

  // --- 3. HANDLE GOOGLE LOGIN ---
  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // Success! Redirect handles automatically
    } catch (err) {
      console.error(err);
      setError("Google Sign-In failed. Please try again.");
      setLoading(false);
    }
  };

  // --- 4. LOADING STATE (Checking Auth) ---
  if (checkingAuth) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center bg-light">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
      </div>
    );
  }

  // --- 5. RENDER LOGIN FORM ---
  return (
    <div className="d-flex vh-100 align-items-center justify-content-center bg-light">
      <Container style={{ maxWidth: "400px" }}>
        <Card className="shadow-sm border-0">
          <Card.Body className="p-5">
            <h2 className="text-center fw-bold mb-4">Admin Login</h2>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>

              <div className="d-grid gap-3">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <Spinner as="span" animation="border" size="sm" />
                  ) : (
                    "Log In"
                  )}
                </Button>

                <div className="text-center text-muted small">OR</div>

                <Button
                  variant="outline-dark"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="d-flex align-items-center justify-content-center"
                >
                  <i className="bi bi-google me-2"></i> Sign in with Google
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
        <div className="text-center mt-3 text-muted small">
          GNDEC Cultural Committee Portal
        </div>
      </Container>
    </div>
  );
}
