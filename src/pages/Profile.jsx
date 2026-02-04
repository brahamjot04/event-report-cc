import { useState, useEffect } from "react";
import { updateProfile, updatePassword } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { Card, Form, Button, Alert, Row, Col, Spinner } from "react-bootstrap";
import Layout from "../components/Layout";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  
  // Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchUser = async () => {
       if (auth.currentUser) {
           setUser(auth.currentUser);
           setEmail(auth.currentUser.email);
           
           const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
           if (docSnap.exists()) {
               setName(docSnap.data().name);
           } else {
               setName(auth.currentUser.displayName || "");
           }
       }
    };
    fetchUser();
  }, []);

  const handleUpdateName = async (e) => {
      e.preventDefault();
      setLoading(true);
      setMsg({ type: "", text: "" });

      try {
          await updateProfile(auth.currentUser, { displayName: name });
          await updateDoc(doc(db, "users", auth.currentUser.uid), { name: name });
          setMsg({ type: "success", text: "Profile name updated successfully!" });
      } catch (error) {
          setMsg({ type: "danger", text: error.message });
      }
      setLoading(false);
  };

  const handleChangePassword = async (e) => {
      e.preventDefault();
      setLoading(true);
      setMsg({ type: "", text: "" });

      if (newPassword.length < 6) {
          setMsg({ type: "danger", text: "Password must be at least 6 characters." });
          setLoading(false);
          return;
      }
      if (newPassword !== confirmPassword) {
          setMsg({ type: "danger", text: "Passwords do not match." });
          setLoading(false);
          return;
      }

      try {
          await updatePassword(auth.currentUser, newPassword);
          setMsg({ type: "success", text: "Password changed successfully!" });
          setNewPassword("");
          setConfirmPassword("");
      } catch (error) {
          if (error.code === 'auth/requires-recent-login') {
              setMsg({ type: "warning", text: "Security Check: Please Logout and Login again to change your password." });
          } else {
              setMsg({ type: "danger", text: error.message });
          }
      }
      setLoading(false);
  };

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <div>
           <h3 className="fw-bold mb-0">My Profile</h3>
           <p className="text-muted small">Manage your account settings</p>
        </div>
      </div>

      <Row className="justify-content-center">
        <Col md={8} lg={6}>
            {msg.text && <Alert variant={msg.type} onClose={() => setMsg({ type: "", text: "" })} dismissible>{msg.text}</Alert>}

            {/* EDIT DETAILS CARD */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-body border-bottom py-3 fw-bold">Personal Details</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleUpdateName}>
                        <Form.Group className="mb-3">
                            <Form.Label>Email Address</Form.Label>
                            {/* FIX: Changed bg-light to bg-body-secondary */}
                            <Form.Control type="email" value={email} disabled className="bg-body-secondary" />
                            <Form.Text className="text-muted">Email cannot be changed.</Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Full Name</Form.Label>
                            <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                        </Form.Group>
                        <div className="text-end">
                            <Button variant="primary" type="submit" disabled={loading}>
                                {loading ? <Spinner size="sm" animation="border"/> : "Update Profile"}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>

            {/* CHANGE PASSWORD CARD */}
            <Card className="border-0 shadow-sm">
                <Card.Header className="bg-body border-bottom py-3 fw-bold text-danger">Security</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleChangePassword}>
                        <Form.Group className="mb-3">
                            <Form.Label>New Password</Form.Label>
                            <Form.Control type="password" placeholder="Min. 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Confirm Password</Form.Label>
                            <Form.Control type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        </Form.Group>
                        <div className="text-end">
                            <Button variant="outline-danger" type="submit" disabled={loading}>
                                Change Password
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Col>
      </Row>
    </Layout>
  );
}