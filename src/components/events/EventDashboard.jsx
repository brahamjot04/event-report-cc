import { Button, Row, Col, Card } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function EventDashboard({
  eventData,
  setView,
  userRole,
  onDelete,
}) {
  const navigate = useNavigate();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    return parts.length === 3
      ? `${parts[2]}-${parts[1]}-${parts[0]}`
      : dateString;
  };

  return (
    <>
      <div className="d-flex align-items-center mb-4">
        <Button
          variant="outline-secondary"
          className="me-3 rounded-circle"
          onClick={() => navigate("/")}
        >
          <i className="bi bi-arrow-left"></i>
        </Button>
        <div>
          <h3 className="fw-bold mb-0">{eventData.title}</h3>
          <span className="text-muted small">
            <i className="bi bi-geo-alt"></i> {eventData.venue} &bull;{" "}
            {formatDate(eventData.date)}
          </span>
        </div>
      </div>

      <Row className="g-4">
        {/* 1. PARTICIPANTS */}
        <Col md={4}>
          <Card
            className="h-100 border-0 shadow-sm cursor-pointer card-hover"
            onClick={() => setView("participants")}
          >
            <Card.Body className="p-4 text-center">
              <div className="mb-3 text-primary">
                <i
                  className="bi bi-people-fill"
                  style={{ fontSize: "3rem" }}
                ></i>
              </div>
              <h5 className="fw-bold text-body">Participants</h5>
              <small className="text-muted">
                Manage items, students & categories
              </small>
            </Card.Body>
          </Card>
        </Col>

        {/* 2. MEETINGS */}
        <Col md={4}>
          <Card
            className="h-100 border-0 shadow-sm cursor-pointer card-hover"
            onClick={() => setView("attendance_sessions")}
          >
            <Card.Body className="p-4 text-center">
              <div className="mb-3 text-success">
                <i
                  className="bi bi-calendar-check-fill"
                  style={{ fontSize: "3rem" }}
                ></i>
              </div>
              <h5 className="fw-bold text-body">Meetings</h5>
              <small className="text-muted">Track committee attendance</small>
            </Card.Body>
          </Card>
        </Col>

        {/* 3. TEAMS (NEW) */}
        <Col md={4}>
          <Card
            className="h-100 border-0 shadow-sm cursor-pointer card-hover"
            // This triggers the view switch
            onClick={() => setView("teams")}
          >
            <Card.Body className="p-4 text-center">
              <div className="mb-3 text-info">
                {/* Diagram icon represents structure/teams */}
                <i
                  className="bi bi-diagram-3-fill"
                  style={{ fontSize: "3rem" }}
                ></i>
              </div>
              <h5 className="fw-bold text-body">Teams</h5>
              <small className="text-muted">Manage committees & members</small>
            </Card.Body>
          </Card>
        </Col>

        {/* 4. SPONSORSHIP */}
        <Col md={4}>
          <Card
            className="h-100 border-0 shadow-sm cursor-pointer card-hover"
            onClick={() => setView("sponsorship")}
          >
            <Card.Body className="p-4 text-center">
              <div className="mb-3 text-warning">
                <i
                  className="bi bi-briefcase-fill"
                  style={{ fontSize: "3rem" }}
                ></i>
              </div>
              <h5 className="fw-bold text-body">Sponsorship</h5>
              <small className="text-muted">Manage sponsors & funds</small>
            </Card.Body>
          </Card>
        </Col>

        {(userRole === "admin" || userRole === "super_admin") && (
          <Col md={12} className="mt-5 text-center">
            <Button
              variant="link"
              className="text-danger text-decoration-none"
              onClick={onDelete}
            >
              <i className="bi bi-trash me-2"></i> Delete This Event
            </Button>
          </Col>
        )}
      </Row>
    </>
  );
}
