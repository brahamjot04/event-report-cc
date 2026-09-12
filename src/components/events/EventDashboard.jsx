import { useEffect } from "react";
import { Button, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

// Helper Component for consistent Soft UI cards
const DashboardCard = ({
  id,
  title,
  subtitle,
  icon,
  colorClass,
  onClick,
  isHighlighted,
}) => (
  <Col md={4} id={id}>
    <div
      className={`soft-card h-100 d-flex flex-column align-items-center justify-content-center p-4 ${isHighlighted ? "card-return-highlight" : ""}`}
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

export default function EventDashboard({
  eventData,
  setView,
  userRole,
  onEdit,
  onDelete,
  onManageProofLink,
  hasProofLink,
  onExportReport,
  exportingReport,
  highlightedModule,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (highlightedModule) {
      const targetId = `module-card-${highlightedModule}`;
      const element = document.getElementById(targetId);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedModule]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    return parts.length === 3
      ? `${parts[2]}-${parts[1]}-${parts[0]}`
      : dateString;
  };

  if (!eventData) {
    return null;
  }

  return (
    <>
      {/* HEADER SECTION */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 mb-md-5">
        <div className="d-flex align-items-start align-items-sm-center gap-3 flex-shrink-0">
          <Button
            variant="outline-secondary"
            className="rounded-circle shadow-sm flex-shrink-0"
            onClick={() => navigate("/")}
            style={{ width: "42px", height: "42px" }}
            title="Back to Home"
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h2 className="fw-bold mb-1 fs-3 fs-md-2">{eventData.title}</h2>
            <div className="text-muted small fw-medium d-flex flex-wrap align-items-center gap-1">
              <span>
                <i className="bi bi-geo-alt-fill text-danger me-1"></i>{" "}
                {eventData.venue}
              </span>
              <span className="mx-1 d-none d-sm-inline">&bull;</span>
              <span>
                <i className="bi bi-calendar-check-fill text-primary me-1"></i>{" "}
                {eventData.isYouthFestival && eventData.startDate
                  ? `${formatDate(eventData.startDate)} – ${formatDate(eventData.endDate) || "?"}`
                  : formatDate(eventData.date)}
              </span>
            </div>
          </div>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
          {(userRole === "admin" || userRole === "super_admin") && onEdit && (
            <Button
              variant="outline-primary"
              className="px-2 px-sm-3 flex-grow-1 flex-md-grow-0 d-flex align-items-center justify-content-center text-nowrap"
              style={{ height: "38px" }}
              onClick={onEdit}
            >
              <i className="bi bi-pencil-fill me-1"></i>
              <span className="d-none d-sm-inline">Edit Event</span>
              <span className="d-sm-none">Edit</span>
            </Button>
          )}
          <Button
            variant={hasProofLink ? "outline-success" : "outline-secondary"}
            className="px-2 px-sm-3 flex-grow-1 flex-md-grow-0 d-flex align-items-center justify-content-center text-nowrap"
            style={{ height: "38px" }}
            onClick={onManageProofLink}
          >
            <i className="bi bi-link-45deg me-1"></i>
            <span className="d-none d-sm-inline">
              {hasProofLink ? "Edit Proof Link" : "Upload Proof Link"}
            </span>
            <span className="d-sm-none">
              {hasProofLink ? "Edit Proof" : "Proof Link"}
            </span>
          </Button>
          <Button
            variant="primary"
            className="px-2 px-sm-3 flex-grow-1 flex-md-grow-0 d-flex align-items-center justify-content-center text-nowrap"
            style={{ height: "38px" }}
            onClick={onExportReport}
            disabled={!!exportingReport}
          >
            <i className="bi bi-download me-1"></i>
            <span className="d-none d-sm-inline">
              {exportingReport ? "Exporting..." : "Export Event Report"}
            </span>
            <span className="d-sm-none">
              {exportingReport ? "Exporting..." : "Export Report"}
            </span>
          </Button>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <Row className="g-4">
        {/* Youth Festival–specific cards (host mode) */}
        {eventData.isYouthFestival && eventData.isHostCollege && (
          <>
            <DashboardCard
              id="module-card-yf_host"
              isHighlighted={highlightedModule === "yf_host"}
              title="Colleges & Participants"
              subtitle="Manage colleges, participants & search"
              icon="bi-building"
              colorClass="warning"
              onClick={() => setView("yf_host")}
            />
            <DashboardCard
              id="module-card-yf_checkin"
              isHighlighted={highlightedModule === "yf_checkin"}
              title="Desk Check-in & Arrivals"
              subtitle="Gate reception, arrival status & CSV rosters"
              icon="bi-person-check-fill"
              colorClass="info"
              onClick={() => setView("yf_checkin")}
            />
            <DashboardCard
              id="module-card-yf_venues"
              isHighlighted={highlightedModule === "yf_venues"}
              title="Venue Mapping"
              subtitle="Assign venues, days & times to events"
              icon="bi-geo-alt-fill"
              colorClass="success"
              onClick={() => setView("yf_venues")}
            />
            <DashboardCard
              id="module-card-yf_accommodation"
              isHighlighted={highlightedModule === "yf_accommodation"}
              title="Accommodation"
              subtitle="Room allotment & check-in tracking"
              icon="bi-house-fill"
              colorClass="primary"
              onClick={() => setView("yf_accommodation")}
            />
            <DashboardCard
              id="module-card-yf_results"
              isHighlighted={highlightedModule === "yf_results"}
              title="Results & Trophies"
              subtitle="Positions, point scoring & overall trophies"
              icon="bi-trophy-fill"
              colorClass="danger"
              onClick={() => setView("yf_results")}
            />
          </>
        )}

        {/* Youth Festival non-host (GNDEC contingent) */}
        {eventData.isYouthFestival && !eventData.isHostCollege && (
          <DashboardCard
            id="module-card-yf_contingent"
            isHighlighted={highlightedModule === "yf_contingent"}
            title="GNDEC Contingent"
            subtitle="Manage our participation roster"
            icon="bi-people-fill"
            colorClass="warning"
            onClick={() => setView("yf_contingent")}
          />
        )}

        {/* Standard cards (always shown) */}
        <DashboardCard
          id="module-card-attendance_sessions"
          isHighlighted={highlightedModule === "attendance_sessions"}
          title="Meetings"
          subtitle="Track committee attendance"
          icon="bi-calendar-check-fill"
          colorClass="success"
          onClick={() => setView("attendance_sessions")}
        />

        <DashboardCard
          id="module-card-teams"
          isHighlighted={highlightedModule === "teams"}
          title="Teams"
          subtitle="Manage committees & members"
          icon="bi-diagram-3-fill"
          colorClass="info"
          onClick={() => setView("teams")}
        />

        <DashboardCard
          id="module-card-teachers"
          isHighlighted={highlightedModule === "teachers"}
          title="Teachers"
          subtitle="Manage teacher entries"
          icon="bi-person-vcard-fill"
          colorClass="secondary"
          onClick={() => setView("teachers")}
        />

        <DashboardCard
          id="module-card-sponsorship"
          isHighlighted={highlightedModule === "sponsorship"}
          title="Sponsorship"
          subtitle="Manage sponsors & funds"
          icon="bi-briefcase-fill"
          colorClass="warning"
          onClick={() => setView("sponsorship")}
        />

        {/* Participants card only for non-YF events */}
        {!eventData.isYouthFestival && (
          <DashboardCard
            id="module-card-participants"
            isHighlighted={highlightedModule === "participants"}
            title="Participants"
            subtitle="Manage items, students & categories"
            icon="bi-people-fill"
            colorClass="primary"
            onClick={() => setView("participants")}
          />
        )}
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
