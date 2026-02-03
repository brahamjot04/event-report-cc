import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Card, Row, Col, Button, Badge, Modal, Form } from "react-bootstrap";
import Layout from "../components/Layout";

export default function Home() {
  const [events, setEvents] = useState([]);
  
  // Local User State (Required for Logic, not Layout)
  const [userRole, setUserRole] = useState(null);
  const [userStatus, setUserStatus] = useState("pending");
  const [userName, setUserName] = useState("User");
  
  const [pendingCount, setPendingCount] = useState(0); 
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ type: "", title: "", date: "", venue: "" });
  
  const navigate = useNavigate();

  // 1. Check Permissions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { navigate("/login"); return; }
      
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

  // 2. Fetch Data
  useEffect(() => {
    if (userStatus === 'approved') {
      const fetchData = async () => {
        const snap = await getDocs(collection(db, "events"));
        setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        if (userRole === 'super_admin') {
            const usersSnap = await getDocs(collection(db, "users"));
            setPendingCount(usersSnap.docs.filter(d => d.data().status === 'pending').length);
        }
      };
      fetchData();
    }
  }, [userStatus, userRole]);

  const handleCreate = async () => {
    if (!formData.title) return;
    const docRef = await addDoc(collection(db, "events"), {
      ...formData, createdBy: userName, createdAt: new Date()
    });
    setEvents([...events, { id: docRef.id, ...formData }]);
    setShowModal(false); setStep(1); setFormData({ type: "", title: "", date: "", venue: "" });
  };

  if (userStatus === "pending") {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center bg-light">
        <div className="text-center p-5 bg-white shadow rounded">
          <h1 className="display-1 text-danger"><i className="bi bi-slash-circle"></i></h1>
          <h2>Access Pending</h2>
          <p className="text-muted">Your account awaits Admin approval.</p>
          <Button variant="outline-danger" onClick={() => auth.signOut()}>Logout</Button>
        </div>
      </div>
    );
  }

  // UPDATED: No props passed to Layout
  return (
    <Layout>
      
      {/* Stats Row */}
      <Row className="mb-4 g-3">
        <Col md={6} lg={3}>
          <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
               <div className="bg-primary bg-opacity-10 p-3 rounded me-3 text-primary"><i className="bi bi-calendar-event fs-4"></i></div>
               <div><h6 className="text-muted mb-0 small fw-bold">EVENTS</h6><h3 className="fw-bold mb-0">{events.length}</h3></div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
           <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
               <div className="bg-success bg-opacity-10 p-3 rounded me-3 text-success"><i className="bi bi-people fs-4"></i></div>
               <div><h6 className="text-muted mb-0 small fw-bold">ACTIVE</h6><h3 className="fw-bold mb-0">--</h3></div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
           <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
               <div className="bg-warning bg-opacity-10 p-3 rounded me-3 text-warning"><i className="bi bi-hourglass-split fs-4"></i></div>
               <div><h6 className="text-muted mb-0 small fw-bold">PENDING</h6><h3 className="fw-bold mb-0">{pendingCount}</h3></div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
           <Card className="border-0 shadow-sm h-100 stats-card">
            <Card.Body className="d-flex align-items-center">
               <div className="bg-danger bg-opacity-10 p-3 rounded me-3 text-danger"><i className="bi bi-file-earmark-text fs-4"></i></div>
               <div><h6 className="text-muted mb-0 small fw-bold">REPORTS</h6><h3 className="fw-bold mb-0">0</h3></div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold text-dark mb-0">Recent Events</h5>
        {(userRole === 'admin' || userRole === 'super_admin') && (
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-lg me-2"></i>New Event
          </Button>
        )}
      </div>

      {/* Grid */}
      <Row className="g-4">
        {events.map(event => (
          <Col md={6} lg={4} key={event.id}>
            <Card className="border-0 shadow-sm h-100 stats-card" onClick={() => navigate(`/event/${event.id}`)}>
              <Card.Body>
                <div className="d-flex justify-content-between mb-3">
                  <Badge bg={event.type === 'youth_festival' ? 'danger' : 'info'}>
                    {event.type === 'youth_festival' ? 'YOUTH FEST' : 'COLLEGE'}
                  </Badge>
                  <small className="text-muted"><i className="bi bi-calendar3 me-1"></i> {event.date}</small>
                </div>
                <Card.Title className="fw-bold mb-1">{event.title}</Card.Title>
                <div className="text-muted small mb-3"><i className="bi bi-geo-alt-fill me-1"></i> {event.venue}</div>
              </Card.Body>
              <Card.Footer className="bg-white border-0 pt-0 text-end">
                 <small className="text-primary fw-bold">Manage <i className="bi bi-arrow-right ms-1"></i></small>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Modals */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size={step === 1 ? "" : "lg"}>
        <Modal.Header closeButton className="border-0"><Modal.Title>{step === 1 ? "Select Type" : "Event Details"}</Modal.Title></Modal.Header>
        <Modal.Body>
          {step === 1 ? (
             <div className="d-grid gap-3">
                <Button variant="light" className="text-start p-3 border" onClick={() => { setFormData({...formData, type: 'college'}); setStep(2); }}>
                    <h5 className="mb-0 text-primary fw-bold">College Level</h5>
                    <small className="text-muted">Internal events like Anand Utsav</small>
                </Button>
                <Button variant="light" className="text-start p-3 border" onClick={() => { setFormData({...formData, type: 'youth_festival'}); setStep(2); }}>
                    <h5 className="mb-0 text-danger fw-bold">Youth Festival</h5>
                    <small className="text-muted">Zonal and Inter-Zonal</small>
                </Button>
             </div>
          ) : (
            <Form>
                <Row>
                    <Col md={12} className="mb-3"><Form.Label>Title</Form.Label><Form.Control value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} autoFocus /></Col>
                    <Col md={6} className="mb-3"><Form.Label>Date</Form.Label><Form.Control value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></Col>
                    <Col md={6} className="mb-3"><Form.Label>Venue</Form.Label><Form.Control value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} /></Col>
                </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
            {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>}
            {step === 2 && <Button variant="primary" onClick={handleCreate}>Create</Button>}
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}