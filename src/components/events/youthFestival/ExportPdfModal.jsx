import { useState } from "react";
import { Modal, Form, Button, Row, Col, Badge } from "react-bootstrap";
import {
  exportBoardingPerforma,
  exportParticipationPerforma,
} from "./youthFestivalPdfExport";

const modalStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
};

export default function ExportPdfModal({ show, onHide, colleges, eventTitle }) {
  const [reportType, setReportType] = useState("both"); // 'boarding' | 'participation' | 'both'
  const [scope, setScope] = useState("all"); // 'all' | 'selected'
  const [selectedCollegeIds, setSelectedCollegeIds] = useState(
    colleges.map((c) => c.id)
  );

  const toggleCollege = (id) => {
    setSelectedCollegeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedCollegeIds(colleges.map((c) => c.id));
  const deselectAll = () => setSelectedCollegeIds([]);

  const handleExport = () => {
    const targetColleges =
      scope === "all"
        ? colleges
        : colleges.filter((c) => selectedCollegeIds.includes(c.id));

    if (!targetColleges.length) return;

    if (reportType === "boarding" || reportType === "both") {
      exportBoardingPerforma(targetColleges, eventTitle);
    }
    if (reportType === "participation" || reportType === "both") {
      exportParticipationPerforma(targetColleges, eventTitle);
    }

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable>
      <Modal.Header closeButton className="border-0" style={modalStyle}>
        <Modal.Title className="fw-bold">
          <i className="bi bi-file-earmark-pdf-fill me-2 text-danger" />
          Export Youth Festival Reports
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="d-grid gap-4" style={modalStyle}>
        {/* Report Type */}
        <div>
          <Form.Label className="text-muted small fw-bold mb-2">
            REPORT TYPE
          </Form.Label>
          <div className="d-grid gap-2">
            <Form.Check
              type="radio"
              name="report-type"
              id="report-both"
              label={
                <span>
                  <strong>Both Reports</strong> (Boarding &amp; Participation)
                </span>
              }
              checked={reportType === "both"}
              onChange={() => setReportType("both")}
            />
            <Form.Check
              type="radio"
              name="report-type"
              id="report-boarding"
              label={
                <span>
                  <strong>Boarding &amp; Lodging Performa</strong> (Per-college arrival &amp; participant list)
                </span>
              }
              checked={reportType === "boarding"}
              onChange={() => setReportType("boarding")}
            />
            <Form.Check
              type="radio"
              name="report-type"
              id="report-participation"
              label={
                <span>
                  <strong>Participation Performa</strong> (Master PTU event participation matrix)
                </span>
              }
              checked={reportType === "participation"}
              onChange={() => setReportType("participation")}
            />
          </div>
        </div>

        {/* Scope Selection */}
        <div>
          <Form.Label className="text-muted small fw-bold mb-2">
            COLLEGE SELECTION
          </Form.Label>
          <Row className="g-3">
            <Col xs={6}>
              <div
                className={`p-3 rounded text-center style-selectable ${
                  scope === "all" ? "border-primary bg-primary-subtle" : ""
                }`}
                style={{
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  background: scope === "all" ? undefined : "var(--bg-main)",
                }}
                onClick={() => setScope("all")}
              >
                <i className="bi bi-buildings fs-4 d-block mb-1" />
                <span className="fw-bold">All Colleges</span>
                <small className="text-muted d-block">
                  {colleges.length} college{colleges.length !== 1 ? "s" : ""}
                </small>
              </div>
            </Col>
            <Col xs={6}>
              <div
                className={`p-3 rounded text-center style-selectable ${
                  scope === "selected" ? "border-primary bg-primary-subtle" : ""
                }`}
                style={{
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  background: scope === "selected" ? undefined : "var(--bg-main)",
                }}
                onClick={() => setScope("selected")}
              >
                <i className="bi bi-ui-checks-grid fs-4 d-block mb-1" />
                <span className="fw-bold">Specific Colleges</span>
                <small className="text-muted d-block">
                  Select individually
                </small>
              </div>
            </Col>
          </Row>
        </div>

        {/* College Checklist (shown when scope === 'selected') */}
        {scope === "selected" && (
          <div
            className="p-3 rounded"
            style={{
              background: "var(--bg-main)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="fw-bold small">SELECT COLLEGES TO INCLUDE</span>
              <div className="d-flex gap-2">
                <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={selectAll}>
                  Select All
                </Button>
                <span className="text-muted">•</span>
                <Button variant="link" size="sm" className="p-0 text-decoration-none text-muted" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="d-grid gap-2" style={{ maxHeight: 220, overflowY: "auto" }}>
              {colleges.map((c) => (
                <div
                  key={c.id}
                  className="d-flex align-items-center justify-content-between p-2 rounded"
                  style={{ background: "var(--bg-card)" }}
                >
                  <Form.Check
                    type="checkbox"
                    id={`export-col-${c.id}`}
                    label={c.name}
                    checked={selectedCollegeIds.includes(c.id)}
                    onChange={() => toggleCollege(c.id)}
                  />
                  <div className="d-flex gap-1">
                    <Badge bg="secondary">
                      {c.selectedEvents?.length || 0} events
                    </Badge>
                    {c.needsAccommodation && (
                      <Badge bg="primary">Acc</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="border-0" style={modalStyle}>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={scope === "selected" && selectedCollegeIds.length === 0}
        >
          <i className="bi bi-download me-2" />
          Download PDF Report
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
