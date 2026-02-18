import { useState, useEffect } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase"; // Adjust path
import { Row, Col, Modal, Form, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventVenue, setNewEventVenue] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Events
      const eventSnap = await getDocs(collection(db, "events"));
      const eventList = eventSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(eventList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle) return;
    await addDoc(collection(db, "events"), {
      title: newEventTitle,
      date: newEventDate,
      venue: newEventVenue,
      createdAt: new Date(),
    });
    setShowEventModal(false);
    setNewEventTitle("");
    setNewEventDate("");
    setNewEventVenue("");
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
                <div className="avatar-circle text-danger bg-danger-subtle">
                  <i className="bi bi-calendar-check"></i>
                </div>
                <h6 className="fw-bold mb-1 text-truncate">{ev.title}</h6>
                <small className="text-muted d-block mb-2">
                  {ev.date} &bull; {ev.venue}
                </small>

                <span
                  className={`status-badge ${
                    new Date(ev.date) < new Date()
                      ? "status-past"
                      : "status-upcoming"
                  }`}
                >
                  {new Date(ev.date) < new Date() ? "Completed" : "Upcoming"}
                </span>
              </div>
            </Col>
          ))}

          {/* Add Event Card */}
          <Col xs={12} sm={6} md={4} lg={3}>
            <div
              className="soft-card add-card"
              onClick={() => setShowEventModal(true)}
            >
              <i className="bi bi-plus-circle-fill fs-3 mb-2"></i>
              <span className="fw-bold">Create Event</span>
            </div>
          </Col>
        </Row>
      </div>

      {/* CREATE EVENT MODAL */}
      <Modal
        show={showEventModal}
        onHide={() => setShowEventModal(false)}
        centered
      >
        {/* We apply inline styles to Modal content to respect Dark Mode variables */}
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
              <Form.Group>
                <Form.Label className="text-muted small fw-bold">
                  EVENT TITLE
                </Form.Label>
                <Form.Control
                  size="lg"
                  placeholder="e.g. Annual Tech Fest"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  style={inputStyle}
                />
              </Form.Group>
              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label className="text-muted small fw-bold">
                      DATE
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
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
                      value={newEventVenue}
                      onChange={(e) => setNewEventVenue(e.target.value)}
                      style={inputStyle}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button
              variant="outline-secondary"
              onClick={() => setShowEventModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateEvent}>
              Create Event
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
