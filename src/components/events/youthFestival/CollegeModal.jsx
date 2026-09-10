import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Row,
  Col,
  Badge,
  Accordion,
} from "react-bootstrap";
import { YF_EVENTS, YF_CATEGORIES } from "../../../constants/youthFestivalEvents";

const inputStyle = {
  backgroundColor: "var(--bg-main)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

const EMPTY_INCHARGE = { name: "", contact: "" };

export default function CollegeModal({ show, onHide, onSave, existingCollege }) {
  const isEdit = !!existingCollege;

  const [collegeName, setCollegeName] = useState(existingCollege?.name || "");
  const [incharges, setIncharges] = useState(
    existingCollege?.incharges?.length
      ? existingCollege.incharges
      : [{ ...EMPTY_INCHARGE }]
  );
  const [selectedEvents, setSelectedEvents] = useState(
    existingCollege?.selectedEvents || []
  );
  const [needsAccommodation, setNeedsAccommodation] = useState(
    existingCollege?.needsAccommodation || false
  );
  // Boarding performa fields
  const [arrivalDate, setArrivalDate] = useState(
    existingCollege?.accommodation?.arrivalDate || ""
  );
  const [arrivalTime, setArrivalTime] = useState(
    existingCollege?.accommodation?.arrivalTime || ""
  );
  const [departureDate, setDepartureDate] = useState(
    existingCollege?.accommodation?.departureDate || ""
  );
  const [boysCount, setBoysCount] = useState(
    existingCollege?.accommodation?.boysCount ?? ""
  );
  const [girlsCount, setGirlsCount] = useState(
    existingCollege?.accommodation?.girlsCount ?? ""
  );
  const [saving, setSaving] = useState(false);

  // Auto-calculated total
  const totalContingent = (Number(boysCount) || 0) + (Number(girlsCount) || 0);

  // ── Incharge helpers ────────────────────────────────────
  const updateIncharge = (idx, field, value) => {
    setIncharges((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const addIncharge = () => setIncharges((p) => [...p, { ...EMPTY_INCHARGE }]);
  const removeIncharge = (idx) =>
    setIncharges((p) => p.filter((_, i) => i !== idx));

  // ── Event selection helpers ──────────────────────────────
  const toggleEvent = (id) =>
    setSelectedEvents((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  const toggleCategory = (cat) => {
    const catIds = YF_EVENTS.filter((e) => e.category === cat).map((e) => e.id);
    const allSelected = catIds.every((id) => selectedEvents.includes(id));
    setSelectedEvents((prev) =>
      allSelected
        ? prev.filter((id) => !catIds.includes(id))
        : [...new Set([...prev, ...catIds])]
    );
  };
  const isCatSelected = (cat) => {
    const catIds = YF_EVENTS.filter((e) => e.category === cat).map((e) => e.id);
    return catIds.every((id) => selectedEvents.includes(id));
  };
  const isCatPartial = (cat) => {
    const catIds = YF_EVENTS.filter((e) => e.category === cat).map((e) => e.id);
    return catIds.some((id) => selectedEvents.includes(id)) && !isCatSelected(cat);
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!collegeName.trim()) return;
    setSaving(true);
    const payload = {
      name: collegeName.trim(),
      incharges: incharges.filter((ic) => ic.name.trim()),
      selectedEvents,
      needsAccommodation,
      accommodation: needsAccommodation
        ? {
            arrivalDate,
            arrivalTime,
            departureDate,
            boysCount: Number(boysCount) || 0,
            girlsCount: Number(girlsCount) || 0,
            contingentSize: totalContingent,
          }
        : null,
    };
    await onSave(payload);
    setSaving(false);
  };

  const modalStyle = {
    backgroundColor: "var(--bg-card)",
    color: "var(--text-primary)",
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable>
      <Modal.Header closeButton className="border-0" style={modalStyle}>
        <Modal.Title className="fw-bold">
          {isEdit ? "Edit College" : "Register Participating College"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="d-grid gap-4" style={modalStyle}>
          {/* College Name */}
          <Form.Group>
            <Form.Label className="text-muted small fw-bold">
              COLLEGE NAME
            </Form.Label>
            <Form.Control
              size="lg"
              placeholder="e.g. LRIET Phagwara"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              style={inputStyle}
            />
          </Form.Group>

          {/* Incharges */}
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <Form.Label className="text-muted small fw-bold mb-0">
                INCHARGES (OPTIONAL)
              </Form.Label>
              <Button
                variant="outline-primary"
                size="sm"
                className="rounded-pill"
                onClick={addIncharge}
              >
                <i className="bi bi-plus me-1" />
                Add Incharge
              </Button>
            </div>
            <div className="d-grid gap-2">
              {incharges.map((ic, idx) => (
                <Row key={idx} className="g-2 align-items-center">
                  <Col>
                    <Form.Control
                      placeholder="Name"
                      value={ic.name}
                      onChange={(e) => updateIncharge(idx, "name", e.target.value)}
                      style={inputStyle}
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      placeholder="Contact / Phone"
                      value={ic.contact}
                      onChange={(e) =>
                        updateIncharge(idx, "contact", e.target.value)
                      }
                      style={inputStyle}
                    />
                  </Col>
                  <Col xs="auto">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeIncharge(idx)}
                      disabled={incharges.length === 1}
                    >
                      <i className="bi bi-trash3" />
                    </Button>
                  </Col>
                </Row>
              ))}
            </div>
          </div>

          {/* Event Selection */}
          <div>
            <Form.Label className="text-muted small fw-bold mb-2">
              EVENTS PARTICIPATING IN
            </Form.Label>
            <p className="text-muted small mb-2">
              {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}{" "}
              selected
            </p>
            <Accordion flush>
              {YF_CATEGORIES.map((cat) => {
                const catEvents = YF_EVENTS.filter((e) => e.category === cat);
                return (
                  <Accordion.Item
                    key={cat}
                    eventKey={cat}
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <Accordion.Header>
                      <Form.Check
                        type="checkbox"
                        checked={isCatSelected(cat)}
                        ref={(el) => {
                          if (el) el.indeterminate = isCatPartial(cat);
                        }}
                        onChange={() => toggleCategory(cat)}
                        onClick={(e) => e.stopPropagation()}
                        className="me-2"
                      />
                      <span className="fw-bold">{cat}</span>
                      <Badge bg="secondary" className="ms-2">
                        {catEvents.filter((e) => selectedEvents.includes(e.id)).length}
                        /{catEvents.length}
                      </Badge>
                    </Accordion.Header>
                    <Accordion.Body>
                      <div className="d-grid gap-1">
                        {catEvents.map((ev) => (
                          <Form.Check
                            key={ev.id}
                            id={`ev-${ev.id}`}
                            type="checkbox"
                            label={
                              <span>
                                {ev.name}{" "}
                                <small className="text-muted">
                                  ({ev.maxP}P{ev.maxA > 0 ? ` + ${ev.maxA}A` : ""})
                                </small>
                              </span>
                            }
                            checked={selectedEvents.includes(ev.id)}
                            onChange={() => toggleEvent(ev.id)}
                          />
                        ))}
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </div>

          {/* Accommodation toggle */}
          <div
            className="p-3 rounded"
            style={{
              background: "var(--bg-main)",
              border: "1px solid var(--border-color)",
            }}
          >
            <Form.Check
              type="switch"
              id="needs-accommodation"
              label={
                <span className="fw-bold">
                  <i className="bi bi-house-fill me-2 text-primary" />
                  Requires Accommodation
                </span>
              }
              checked={needsAccommodation}
              onChange={(e) => setNeedsAccommodation(e.target.checked)}
            />

            {needsAccommodation && (
              <div className="mt-3 pt-3 border-top d-grid gap-3">
                <p className="text-muted small mb-0 fw-bold">
                  BOARDING PERFORMA DETAILS
                </p>
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small">
                        Arrival Date
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={arrivalDate}
                        onChange={(e) => setArrivalDate(e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small">
                        Arrival Time
                      </Form.Label>
                      <Form.Control
                        type="time"
                        value={arrivalTime}
                        onChange={(e) => setArrivalTime(e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small">
                        Departure Date
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="g-2">
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small">
                        <i className="bi bi-gender-male me-1 text-primary" />
                        Boys
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        placeholder="0"
                        value={boysCount}
                        onChange={(e) => setBoysCount(e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small">
                        <i className="bi bi-gender-female me-1 text-danger" />
                        Girls
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        placeholder="0"
                        value={girlsCount}
                        onChange={(e) => setGirlsCount(e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small fw-bold">
                        Total
                      </Form.Label>
                      <Form.Control
                        readOnly
                        value={totalContingent || ""}
                        placeholder="Auto"
                        style={{
                          ...inputStyle,
                          backgroundColor: "var(--bg-main)",
                          fontWeight: "bold",
                          color: totalContingent > 0 ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </div>
            )}
          </div>
      </Modal.Body>

      <Modal.Footer className="border-0" style={modalStyle}>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={saving || !collegeName.trim()}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Register College"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
