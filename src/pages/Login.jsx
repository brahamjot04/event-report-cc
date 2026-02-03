import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });

        const isSuperAdmin = email.toLowerCase() === "brahamjot.cultural@gmail.com"; 

        await setDoc(doc(db, "users", user.uid), {
          name: name,
          email: user.email,
          role: isSuperAdmin ? "super_admin" : "user",
          status: isSuperAdmin ? "approved" : "pending",
          createdAt: new Date()
        });

        if (!isSuperAdmin) {
            alert("Account created! Please wait for Admin approval.");
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err.message.replace("Firebase: ", "").replace("auth/", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: "420px" }}>
        
        {/* BRANDING UPDATE HERE */}
        <div className="text-center mb-4">
            <h2 className="fw-bold text-primary">Cultural <span className="text-dark">Committee</span></h2>
            <p className="text-muted">Event Management Portal</p>
        </div>

        <Card className="border-0 shadow-sm p-4">
          <Card.Body>
            <h4 className="fw-bold mb-1">{isRegistering ? "Create Account" : "Welcome Back"}</h4>
            <p className="text-muted small mb-4">
                {isRegistering ? "Enter your details to request access" : "Please enter your details to sign in"}
            </p>

            {error && <Alert variant="danger" className="small">{error}</Alert>}
            
            <Form onSubmit={handleSubmit}>
              {isRegistering && (
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Full Name</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="e.g. John Doe"
                    required 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    style={{background: '#f8f9fa'}}
                  />
                </Form.Group>
              )}
              
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted text-uppercase">Email Address</Form.Label>
                <Form.Control 
                  type="email" 
                  placeholder="name@gndec.ac.in"
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  style={{background: '#f8f9fa'}} 
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
                <Form.Control 
                  type="password" 
                  placeholder="••••••••"
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  style={{background: '#f8f9fa'}}
                />
              </Form.Group>
              
              <Button variant="primary" type="submit" className="w-100 py-2 fw-bold" disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : (isRegistering ? "Request Access" : "Sign In")}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        <div className="text-center mt-4">
          <small className="text-muted">
            {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsRegistering(!isRegistering); setError(""); }} className="text-decoration-none fw-bold">
              {isRegistering ? "Sign In" : "Request Access"}
            </a>
          </small>
        </div>

      </Container>
    </div>
  );
}