import { useState, useEffect } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Row, Col, Modal, Form, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

// ── Blank form state ──────────────────────────────────────────────────────────
const BLANK_FORM = {
  title: "",
  date: "",
  venue: "",
  isYouthFestival: false,
  startDate: "",
  endDate: "",
  isHostCollege: false,
};

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showEventModal, setShowEventModal] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const eventSnap = await getDocs(collection(db, "events"));
      const eventList = eventSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(eventList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreateEvent = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      date: form.isYouthFestival ? form.startDate : form.date,
      venue: form.venue.trim(),
      isYouthFestival: form.isYouthFestival,
      createdAt: new Date(),
    };
    if (form.isYouthFestival) {
      payload.startDate = form.startDate;
      payload.endDate = form.endDate;
      payload.isHostCollege = form.isHostCollege;
    }
    await addDoc(collection(db, "events"), payload);
    setShowEventModal(false);
    setForm({ ...BLANK_FORM });
    fetchData();
  };

  // Helper styles for dark-mode compatible form inputs
  const inputStyle = {
    backgroundColor: "var(--bg-main)",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
  };

  if (loading)
    return (
      <Layout>
        <div className="vh-100 d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="primary" />
        </div>
      </Layout>
    );

  return (
    <Layout>
      {/* PAGE TITLE */}
      <div className="mb-5">
        <small className="text-muted text-uppercase fw-bold">Management</small>
        <h2 className="fw-bold mt-1">Dashboard</h2>
      </div>

      {/* --- EVENTS SECTION --- */}
      <div className="mb-5">
        <h5 className="fw-bold mb-3">All Events</h5>
        <p className="text-muted small mb-4">
          Select an event to manage participants, sponsors, and meetings.
        </p>

        <Row className="g-3">
          {events.map((ev) => (
            <Col key={ev.id} xs={12} sm={6} md={4} lg={3}>
              <div
                className="soft-card"
                onClick={() => navigate(`/event/${ev.id}`)}
              >
                <div
                  className={`avatar-circle ${
                    ev.isYouthFestival
                      ? "text-warning bg-warning-subtle"
                      : "text-danger bg-danger-subtle"
                  }`}
                >
                  <i
                    className={`bi ${
                      ev.isYouthFestival ? "bi-trophy-fill" : "bi-calendar-check"
                    }`}
                    style={{ fontSize: "1.4rem", lineHeight: 1 }}
                  />
                </div>
                <h6 className="fw-bold mb-1" style={{ wordBreak: "break-word" }}>
                  {ev.title}
                </h6>
                <small className="text-muted d-block mb-2">
                  {ev.isYouthFestival && ev.startDate
                    ? `${ev.startDate} – ${ev.endDate || "?"}`
                    : ev.date}{" "}
                  &bull; {ev.venue}
                </small>

                <div className="d-flex flex-wrap gap-1 justify-content-center align-items-center mt-2">
                  <span
                    className={`status-badge ${
                      new Date(ev.date || ev.startDate) < new Date()
                        ? "status-past"
                        : "status-upcoming"
                    }`}
                  >
                    {new Date(ev.date || ev.startDate) < new Date()
                      ? "Completed"
                      : "Upcoming"}
                  </span>
                  {ev.isYouthFestival && (
                    <span className="yf-badge yf-badge-warning">
                      <i className="bi bi-trophy-fill me-1" />
                      Youth Festival
                    </span>
                  )}
                  {ev.isYouthFestival && ev.isHostCollege && (
                    <span className="yf-badge yf-badge-success">
                      Host
                    </span>
                  )}
                  {ev.isYouthFestival && !ev.isHostCollege && (
                    <span className="yf-badge yf-badge-info">
                      Contingent
                    </span>
                  )}
                </div>
              </div>
            </Col>
          ))}

          {/* Add Event Card */}
          <Col xs={12} sm={6} md={4} lg={3}>
            <div
              className="soft-card add-card"
              onClick={() => setShowEventModal(true)}
            >
              <i className="bi bi-plus-circle-fill fs-3 mb-2" />
              <span className="fw-bold">Create Event</span>
            </div>
          </Col>
        </Row>
      </div>

      {/* CREATE EVENT MODAL */}
      <Modal
        show={showEventModal}
        onHide={() => {
          setShowEventModal(false);
          setForm({ ...BLANK_FORM });
        }}
        centered
        size={form.isYouthFestival ? "lg" : undefined}
      >
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="fw-bold">Create New Event</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form className="d-grid gap-3">
              {/* Title */}
              <Form.Group>
                <Form.Label className="text-muted small fw-bold">
                  EVENT TITLE
                </Form.Label>
                <Form.Control
                  size="lg"
                  placeholder="e.g. Annual Tech Fest"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  style={inputStyle}
                />
              </Form.Group>

              {/* Youth Festival toggle */}
              <div
                className="p-3 rounded"
                style={{
                  background: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <Form.Check
                  type="switch"
                  id="is-youth-festival"
                  label={
                    <span className="fw-bold">
                      <i className="bi bi-trophy-fill text-warning me-2" />
                      This is a Youth Festival
                    </span>
                  }
                  checked={form.isYouthFestival}
                  onChange={(e) => setField("isYouthFestival", e.target.checked)}
                />

                {form.isYouthFestival && (
                  <div className="mt-3 pt-3 border-top d-grid gap-3">
                    {/* Date range */}
                    <Row>
                      <Col>
                        <Form.Group>
                          <Form.Label className="text-muted small fw-bold">
                            START DATE
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setField("startDate", e.target.value)}
                            onClick={(e) => e.target.showPicker?.()}
                            style={inputStyle}
                          />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group>
                          <Form.Label className="text-muted small fw-bold">
                            END DATE
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setField("endDate", e.target.value)}
                            onClick={(e) => e.target.showPicker?.()}
                            style={inputStyle}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Host college toggle */}
                    <Form.Check
                      type="switch"
                      id="is-host-college"
                      label={
                        <span>
                          <strong>GNDEC is the Host College</strong>
                          <small className="text-muted ms-2">
                            (manage all participating colleges &amp; accommodation)
                          </small>
                        </span>
                      }
                      checked={form.isHostCollege}
                      onChange={(e) => setField("isHostCollege", e.target.checked)}
                    />
                    {!form.isHostCollege && (
                      <small className="text-muted">
                        <i className="bi bi-info-circle me-1" />
                        Non-host mode: manage GNDEC&apos;s own contingent roster.
                      </small>
                    )}
                  </div>
                )}
              </div>

              {/* Date + Venue (only shown for non-YF events) */}
              {!form.isYouthFestival && (
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small fw-bold">
                        DATE
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={form.date}
                        onChange={(e) => setField("date", e.target.value)}
                        onClick={(e) => e.target.showPicker?.()}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="text-muted small fw-bold">
                        VENUE
                      </Form.Label>
                      <Form.Control
                        placeholder="e.g. Auditorium"
                        value={form.venue}
                        onChange={(e) => setField("venue", e.target.value)}
                        style={inputStyle}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              )}

              {/* Venue for YF (separate row) */}
              {form.isYouthFestival && (
                <Form.Group>
                  <Form.Label className="text-muted small fw-bold">
                    PRIMARY VENUE
                  </Form.Label>
                  <Form.Control
                    placeholder="e.g. GNDEC Campus"
                    value={form.venue}
                    onChange={(e) => setField("venue", e.target.value)}
                    style={inputStyle}
                  />
                </Form.Group>
              )}
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setShowEventModal(false);
                setForm({ ...BLANK_FORM });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateEvent}
              disabled={!form.title.trim()}
            >
              Create Event
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
