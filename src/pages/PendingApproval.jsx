import { Button } from "react-bootstrap";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const auth = getAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth);
    navigate("/login");
  };

  return (
    <div className="vh-100 d-flex align-items-center justify-content-center bg-main">
      <div className="soft-card p-5 text-center" style={{ maxWidth: "500px" }}>
        <div className="avatar-circle bg-warning-subtle text-warning mb-4">
          <i className="bi bi-clock-history fs-1"></i>
        </div>
        <h2 className="fw-bold">Approval Pending</h2>
        <p className="text-muted">
          Your account has been created successfully. An administrator needs to
          approve your access before you can enter the portal.
        </p>
        <Button
          variant="primary"
          onClick={() => window.location.reload()}
          className="me-2 rounded-pill"
        >
          Check Status
        </Button>
        <Button
          variant="outline-danger"
          onClick={handleLogout}
          className="rounded-pill"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
