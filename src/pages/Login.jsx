import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup } from "firebase/auth";
import { auth, db, googleProvider } from "../firebase"; // <--- Import googleProvider
import { doc, setDoc, getDoc } from "firebase/firestore";
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

  // --- GOOGLE LOGIN ---
  const handleGoogleLogin = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user exists in DB
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
            // New Google User -> Create pending doc
            const isSuperAdmin = user.email.toLowerCase() === "brahamjot.cultural@gmail.com";
            await setDoc(doc(db, "users", user.uid), {
                name: user.displayName,
                email: user.email,
                role: isSuperAdmin ? "super_admin" : "user",
                status: isSuperAdmin ? "approved" : "pending",
                createdAt: new Date()
            });
            if (!isSuperAdmin) alert("Account created! Waiting for Admin approval.");
        }
        navigate("/");
    } catch (err) {
        console.error(err);
        setError("Google Sign-In Failed: " + err.message);
    }
  };

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
    <div className="bg-body-tertiary min-vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: "420px" }}>
        
        <div className="text-center mb-4">
            <h2 className="fw-bold text-primary">Cultural <span className="text-body">Committee</span></h2>
            <p className="text-muted">Event Management Portal</p>
        </div>

        <Card className="border-0 shadow-sm p-4 card">
          <Card.Body>
            <h4 className="fw-bold mb-1">{isRegistering ? "Create Account" : "Welcome Back"}</h4>
            <p className="text-muted small mb-4">
                {isRegistering ? "Enter details to request access" : "Please enter details to sign in"}
            </p>

            {error && <Alert variant="danger" className="small">{error}</Alert>}
            
            {/* GOOGLE BUTTON */}
            <Button variant="outline-dark" className="w-100 mb-3 d-flex align-items-center justify-content-center gap-2" onClick={handleGoogleLogin}>
                <i className="bi bi-google"></i> Continue with Google
            </Button>

            <div className="d-flex align-items-center mb-3">
                <hr className="flex-grow-1" /> <span className="mx-2 text-muted small">OR</span> <hr className="flex-grow-1" />
            </div>

            <Form onSubmit={handleSubmit}>
              {isRegistering && (
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Full Name</Form.Label>
                  <Form.Control type="text" placeholder="e.g. Brahamjot Singh" required value={name} onChange={(e) => setName(e.target.value)} />
                </Form.Group>
              )}
              
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted text-uppercase">Email Address</Form.Label>
                <Form.Control type="email" placeholder="name@gndec.ac.in" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
                <Form.Control type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
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