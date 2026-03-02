import { Button, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function EventDashboard({
  eventData,
  setView,
  userRole,
  onDelete,
  onExportReport,
  exportingReport,
}) {
  const navigate = useNavigate();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    return parts.length === 3
      ? `${parts[2]}-${parts[1]}-${parts[0]}`
      : dateString;
  };

  // Helper Component for consistent Soft UI cards
  const DashboardCard = ({ title, subtitle, icon, colorClass, onClick }) => (
    <Col md={4}>
      <div
        className="soft-card h-100 d-flex flex-column align-items-center justify-content-center p-4"
        onClick={onClick}
      >
        <div
          className={`avatar-circle bg-${colorClass}-subtle text-${colorClass} mb-3`}
        >
          <i className={`bi ${icon}`} style={{ fontSize: "2rem" }}></i>
        </div>
        <h5 className="fw-bold mb-1">{title}</h5>
        <small className="text-muted">{subtitle}</small>
      </div>
    </Col>
  );

  return (
    <>
      {/* HEADER SECTION */}
      <div className="d-flex align-items-center mb-5">
        <Button
          variant="outline-secondary"
          className="me-3 rounded-circle shadow-sm"
          onClick={() => navigate("/")}
          style={{ width: "45px", height: "45px" }}
        >
          <i className="bi bi-arrow-left"></i>
        </Button>
        <div>
          <h2 className="fw-bold mb-0">{eventData.title}</h2>
          <span className="text-muted small fw-medium">
            <i className="bi bi-geo-alt-fill text-danger me-1"></i>{" "}
            {eventData.venue}
            <span className="mx-2">&bull;</span>
            <i className="bi bi-calendar-check-fill text-primary me-1"></i>{" "}
            {formatDate(eventData.date)}
          </span>
        </div>
        <div className="ms-auto">
          <Button
            variant="primary"
            className="rounded-pill px-4"
            onClick={onExportReport}
            disabled={!!exportingReport}
          >
            <i className="bi bi-download me-2"></i>
            {exportingReport ? "Exporting..." : "Export Event Report"}
          </Button>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <Row className="g-4">
        <DashboardCard
          title="Participants"
          subtitle="Manage items, students & categories"
          icon="bi-people-fill"
          colorClass="primary"
          onClick={() => setView("participants")}
        />

        <DashboardCard
          title="Meetings"
          subtitle="Track committee attendance"
          icon="bi-calendar-check-fill"
          colorClass="success"
          onClick={() => setView("attendance_sessions")}
        />

        <DashboardCard
          title="Teams"
          subtitle="Manage committees & members"
          icon="bi-diagram-3-fill"
          colorClass="info"
          onClick={() => setView("teams")}
        />

        <DashboardCard
          title="Teachers"
          subtitle="Manage teacher entries"
          icon="bi-person-vcard-fill"
          colorClass="secondary"
          onClick={() => setView("teachers")}
        />

        <DashboardCard
          title="Sponsorship"
          subtitle="Manage sponsors & funds"
          icon="bi-briefcase-fill"
          colorClass="warning"
          onClick={() => setView("sponsorship")}
        />
      </Row>

      {/* ADMIN ACTIONS */}
      {(userRole === "admin" || userRole === "super_admin") && (
        <div
          className="mt-5 pt-4 text-center border-top"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Button
            variant="link"
            className="text-danger text-decoration-none fw-bold opacity-75 hover-opacity-100"
            onClick={onDelete}
          >
            <i className="bi bi-trash3-fill me-2"></i> Delete This Event
          </Button>
        </div>
      )}
    </>
  );
}
