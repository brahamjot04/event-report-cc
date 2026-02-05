import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Button,
  Badge,
  Modal,
  Form,
  ButtonGroup,
  ToggleButton,
} from "react-bootstrap";
import Layout from "../components/Layout";
import { logAction } from "../utils/logger";

export default function Home() {
  const [events, setEvents] = useState([]);

  const [userRole, setUserRole] = useState(null);
  const [userStatus, setUserStatus] = useState("pending");
  const [userName, setUserName] = useState("User");

  const [pendingCount, setPendingCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);

  // Form State
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null); // Track if we are editing

  const [formData, setFormData] = useState({
    type: "",
    title: "",
    date: new Date().toISOString().split("T")[0],
    endDate: "", // New field for multi-day
    venue: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserRole(data.role);
        setUserStatus(data.status);
        setUserName(data.name || currentUser.displayName || "User");
      } else {
        setUserStatus("pending");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (userStatus === "approved") {
      const fetchData = async () => {
        const snap = await getDocs(collection(db, "events"));
        setEvents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        if (userRole === "super_admin") {
          const usersSnap = await getDocs(collection(db, "users"));
          setPendingCount(
            usersSnap.docs.filter((d) => d.data().status === "pending").length,
          );
        }
      };
      fetchData();
    }
  }, [userStatus, userRole]);

  // --- OPEN MODAL FOR CREATION ---
  const openCreateModal = () => {
    setEditingEventId(null);
    setIsMultiDay(false);
    setStep(1);
    setFormData({
      type: "",
      title: "",
      date: new Date().toISOString().split("T")[0],
      endDate: "",
      venue: "",
    });
    setShowModal(true);
  };

  // --- OPEN MODAL FOR EDITING ---
  const openEditModal = (e, event) => {
    e.stopPropagation(); // Stop navigation to details page
    setEditingEventId(event.id);

    // Check if it's a multi-day event
    const isMulti = !!event.endDate;
    setIsMultiDay(isMulti);

    setFormData({
      type: event.type,
      title: event.title,
      date: event.date,
      endDate: event.endDate || "",
      venue: event.venue,
    });
    setStep(2); // Skip type selection, go straight to form
    setShowModal(true);
  };

  // --- SAVE EVENT (CREATE OR UPDATE) ---
  const handleSaveEvent = async () => {
    if (!formData.title) return;

    try {
      const eventData = {
        ...formData,
        // If single day, clear endDate to keep data clean
        endDate: isMultiDay ? formData.endDate : "",
      };

      if (editingEventId) {
        // UPDATE EXISTING EVENT
        await updateDoc(doc(db, "events", editingEventId), eventData);

        // Update local state
        setEvents(
          events.map((ev) =>
            ev.id === editingEventId ? { ...ev, ...eventData } : ev,
          ),
        );
      } else {
        // CREATE NEW EVENT
        const docRef = await addDoc(collection(db, "events"), {
          ...eventData,
          createdBy: userName,
          createdAt: new Date(),
        });
        await logAction("CREATE_EVENT", `Created event: ${formData.title}`);
        setEvents([...events, { id: docRef.id, ...eventData }]);
      }

      setShowModal(false);
    } catch (err) {
      console.error("Error saving event:", err);
      alert("Failed to save event.");
    }
  };

  // Helper to display date nicely
  const formatDateDisplay = (date, endDate) => {
    if (!endDate) return date; // Single day
    // Multi-day: "2026-03-05 to 2026-03-08"
    return `${date} — ${endDate}`;
  };

  if (userStatus === "pending") {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center p-5 card shadow rounded border-0">
          <h1 className="display-1 text-danger">
            <i className="bi bi-slash-circle"></i>
          </h1>
          <h2>Access Pending</h2>
          <p className="text-muted">Your account awaits Admin approval.</p>
          <Button variant="outline-danger" onClick={() => auth.signOut()}>
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {/* Stats Row */}
      <Row className="mb-4 g-3">
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-primary bg-opacity-10 p-3 rounded me-3 text-primary">
                <i className="bi bi-calendar-event fs-4"></i>
              </div>
              <div>
                <h6 className="text-muted mb-0 small fw-bold">EVENTS</h6>
                <h3 className="fw-bold mb-0">{events.length}</h3>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-success bg-opacity-10 p-3 rounded me-3 text-success">
                <i className="bi bi-people fs-4"></i>
              </div>
              <div>
                <h6 className="text-muted mb-0 small fw-bold">ACTIVE</h6>
                <h3 className="fw-bold mb-0">--</h3>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-warning bg-opacity-10 p-3 rounded me-3 text-warning">
                <i className="bi bi-hourglass-split fs-4"></i>
              </div>
              <div>
                <h6 className="text-muted mb-0 small fw-bold">PENDING</h6>
                <h3 className="fw-bold mb-0">{pendingCount}</h3>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-danger bg-opacity-10 p-3 rounded me-3 text-danger">
                <i className="bi bi-file-earmark-text fs-4"></i>
              </div>
              <div>
                <h6 className="text-muted mb-0 small fw-bold">REPORTS</h6>
                <h3 className="fw-bold mb-0">0</h3>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Recent Events</h5>
        {(userRole === "admin" || userRole === "super_admin") && (
          <Button variant="primary" onClick={openCreateModal}>
            <i className="bi bi-plus-lg me-2"></i>New Event
          </Button>
        )}
      </div>

      {/* Events Grid */}
      <Row className="g-4">
        {events.map((event) => (
          <Col md={6} lg={4} key={event.id}>
            <Card
              className="border-0 shadow-sm h-100 stats-card cursor-pointer position-relative"
              onClick={() => navigate(`/event/${event.id}`)}
            >
              {/* EDIT BUTTON (Only for Admins) */}
              {(userRole === "admin" || userRole === "super_admin") && (
                <Button
                  variant="light"
                  size="sm"
                  className="position-absolute top-0 end-0 m-2 rounded-circle shadow-sm z-3"
                  onClick={(e) => openEditModal(e, event)}
                  title="Edit Event"
                >
                  <i className="bi bi-pencil-fill text-secondary"></i>
                </Button>
              )}

              <Card.Body>
                <div className="d-flex justify-content-between mb-3">
                  <Badge
                    bg={event.type === "youth_festival" ? "danger" : "info"}
                  >
                    {event.type === "youth_festival" ? "YOUTH FEST" : "COLLEGE"}
                  </Badge>
                </div>

                {/* Date Display */}
                <small className="text-muted d-block mb-2">
                  <i className="bi bi-calendar3 me-1"></i>
                  {formatDateDisplay(event.date, event.endDate)}
                </small>

                <Card.Title className="fw-bold mb-1">{event.title}</Card.Title>
                <div className="text-muted small mb-3">
                  <i className="bi bi-geo-alt-fill me-1"></i> {event.venue}
                </div>
              </Card.Body>
              <Card.Footer className="bg-transparent border-top-0 text-end">
                <small className="text-primary fw-bold">
                  Manage <i className="bi bi-arrow-right ms-1"></i>
                </small>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Modals */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
        size={step === 1 ? "" : "lg"}
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title>
            {editingEventId
              ? "Edit Event"
              : step === 1
                ? "Select Type"
                : "Event Details"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {step === 1 ? (
            <div className="d-grid gap-3">
              <Button
                variant="outline-light"
                className="text-start p-3 border text-body"
                onClick={() => {
                  setFormData({ ...formData, type: "college" });
                  setStep(2);
                }}
              >
                <h5 className="mb-0 text-primary fw-bold">College Level</h5>
                <small className="text-muted">
                  Internal events like Anand Utsav
                </small>
              </Button>
              <Button
                variant="outline-light"
                className="text-start p-3 border text-body"
                onClick={() => {
                  setFormData({ ...formData, type: "youth_festival" });
                  setStep(2);
                }}
              >
                <h5 className="mb-0 text-danger fw-bold">Youth Festival</h5>
                <small className="text-muted">Zonal and Inter-Zonal</small>
              </Button>
            </div>
          ) : (
            <Form>
              {/* Title & Type */}
              <Row className="mb-3">
                <Col md={8}>
                  <Form.Label>Event Title</Form.Label>
                  <Form.Control
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    autoFocus
                  />
                </Col>
                <Col md={4}>
                  <Form.Label>Event Type</Form.Label>
                  <Form.Select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                  >
                    <option value="college">College Level</option>
                    <option value="youth_festival">Youth Festival</option>
                  </Form.Select>
                </Col>
              </Row>

              {/* Date Selection Mode */}
              <div className="mb-3">
                <Form.Label className="d-block">Event Duration</Form.Label>
                <ButtonGroup>
                  <ToggleButton
                    id="radio-single"
                    type="radio"
                    variant="outline-primary"
                    name="radio"
                    value="single"
                    checked={!isMultiDay}
                    onChange={() => setIsMultiDay(false)}
                  >
                    Single Day
                  </ToggleButton>
                  <ToggleButton
                    id="radio-multi"
                    type="radio"
                    variant="outline-primary"
                    name="radio"
                    value="multi"
                    checked={isMultiDay}
                    onChange={() => setIsMultiDay(true)}
                  >
                    Multiple Days
                  </ToggleButton>
                </ButtonGroup>
              </div>

              {/* Date Pickers */}
              <Row className="mb-3">
                <Col md={isMultiDay ? 6 : 12}>
                  <Form.Label>{isMultiDay ? "Start Date" : "Date"}</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </Col>

                {isMultiDay && (
                  <Col md={6}>
                    <Form.Label>End Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                    />
                  </Col>
                )}
              </Row>

              {/* Venue */}
              <Form.Group className="mb-3">
                <Form.Label>Venue</Form.Label>
                <Form.Control
                  value={formData.venue}
                  onChange={(e) =>
                    setFormData({ ...formData, venue: e.target.value })
                  }
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          {step === 2 && !editingEventId && (
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 2 && (
            <Button variant="primary" onClick={handleSaveEvent}>
              {editingEventId ? "Save Changes" : "Create Event"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
