import { useEffect } from "react";
import { Container, Button, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  // Ensure theme is applied even if landing directly on 404
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
  }, []);

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex align-items-center justify-content-center">
      <Container style={{ maxWidth: "420px" }}>
        
        {/* BRANDING HEADER (Matches Login Page) */}
        <div className="text-center mb-4">
            <h2 className="fw-bold text-primary">Cultural <span className="text-body">Committee</span></h2>
            <p className="text-muted">Event Management Portal</p>
        </div>

        <Card className="border-0 shadow-sm p-4 card text-center">
          <Card.Body>
            <div className="mb-3 text-warning">
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem' }}></i>
            </div>
            
            <h2 className="fw-bold text-body mb-2">404</h2>
            <h5 className="mb-3 text-muted">Page Not Found</h5>
            
            <p className="text-muted small mb-4">
              The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <div className="d-grid gap-2">
                <Button variant="primary" onClick={() => navigate("/")} className="fw-bold">
                  <i className="bi bi-house-door-fill me-2"></i>
                  Return to Dashboard
                </Button>
                <Button variant="outline-secondary" onClick={() => navigate(-1)} className="fw-bold">
                  Go Back
                </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}