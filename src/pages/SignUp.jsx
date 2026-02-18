import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Form,
  Button,
  Alert,
  Spinner,
  Row,
  Col,
} from "react-bootstrap";
import "../assets/DashboardStyles.css";

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      const user = userCredential.user;

      // 2. Update Auth Profile with Name
      await updateProfile(user, { displayName: formData.name });

      // 3. Create User Document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        role: "user",
        isAproved: false,
        createdAt: new Date(),
      });

      navigate("/"); // Redirect to dashboard
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create an account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex vh-100 align-items-center justify-content-center"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <Container style={{ maxWidth: "500px" }}>
        <div className="soft-card p-5 shadow-sm text-start">
          <h2 className="text-center fw-bold mb-2">Create Account</h2>
          <p className="text-center text-muted small mb-4">
            Join the GNDEC Cultural Committee Portal
          </p>

          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSignup}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold">Full Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold">Email Address</Form.Label>
              <Form.Control
                type="email"
                placeholder="name@example.com"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold">Confirm</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="••••••••"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-grid gap-3">
              <Button
                variant="primary"
                type="submit"
                size="lg"
                className="fw-bold"
                disabled={loading}
              >
                {loading ? (
                  <Spinner as="span" animation="border" size="sm" />
                ) : (
                  "Sign Up"
                )}
              </Button>
            </div>
          </Form>

          <div className="text-center mt-4">
            <p className="small text-muted mb-0">
              Already have an account?{" "}
              <Link to="/login" className="fw-bold text-decoration-none">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
