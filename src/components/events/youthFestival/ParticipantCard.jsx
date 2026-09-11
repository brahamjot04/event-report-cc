import { Badge } from "react-bootstrap";
import { YF_EVENTS_BY_ID } from "../../../constants/youthFestivalEvents";

/**
 * Rich participant card shown in search results.
 * Props:
 *   participant  – { name, role ('P'|'A'), contact, eventIds: string[] }
 *   college      – { name, incharges: [{name, contact}] }
 *   allottedRoom – string | undefined
 */
export default function ParticipantCard({ participant, college, allottedRoom }) {
  const eventNames = (participant.eventIds || [])
    .map((id) => YF_EVENTS_BY_ID[id]?.name || id)
    .filter(Boolean);

  return (
    <div
      className="p-3 rounded shadow-sm mb-2"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="d-flex align-items-start gap-3">
        {/* Avatar */}
        <div
          className="avatar-circle bg-primary-subtle text-primary flex-shrink-0"
          style={{ width: 48, height: 48, fontSize: "1.2rem" }}
        >
          <i className="bi bi-person-fill" />
        </div>

        {/* Main info */}
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="fw-bold fs-6">{participant.name}</span>
            <Badge bg={participant.role === "P" ? "primary" : "secondary"}>
              {participant.role === "P" ? "Participant" : "Alternate"}
            </Badge>
            {allottedRoom && (
              <Badge bg="success" className="d-flex align-items-center gap-1">
                <i className="bi bi-door-open-fill" />
                {allottedRoom}
              </Badge>
            )}
          </div>

          {/* College */}
          <div className="text-muted small mb-1">
            <i className="bi bi-building me-1" />
            {college?.name || "Unknown College"}
          </div>

          {/* Events */}
          {eventNames.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mb-2">
              {eventNames.map((ev) => (
                <Badge key={ev} bg="info" text="dark" className="fw-normal">
                  {ev}
                </Badge>
              ))}
            </div>
          )}

          {/* Contact */}
          {participant.contact && (
            <div className="d-flex gap-2">
              <a
                href={`tel:${participant.contact}`}
                className="btn btn-outline-secondary btn-sm"
              >
                <i className="bi bi-telephone me-1" />
                {participant.contact}
              </a>
              <a
                href={`https://wa.me/91${participant.contact.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-success btn-sm"
              >
                <i className="bi bi-whatsapp me-1" />
                WhatsApp
              </a>
            </div>
          )}

          {/* Incharges */}
          {college?.incharges?.length > 0 && (
            <div className="mt-2 pt-2 border-top" style={{ borderColor: "var(--border-color)" }}>
              <small className="text-muted fw-bold d-block mb-1">
                <i className="bi bi-person-badge me-1" />
                College Incharge{college.incharges.length > 1 ? "s" : ""}
              </small>
              {college.incharges.map((ic, i) => (
                <div key={i} className="d-flex gap-2 align-items-center flex-wrap">
                  <small className="fw-medium">{ic.name}</small>
                  {ic.contact && (
                    <>
                      <a
                        href={`tel:${ic.contact}`}
                        className="text-muted small text-decoration-none"
                      >
                        <i className="bi bi-telephone me-1" />
                        {ic.contact}
                      </a>
                      <a
                        href={`https://wa.me/91${ic.contact.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-success small text-decoration-none"
                      >
                        <i className="bi bi-whatsapp me-1" />
                        WA
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
