import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  updateDoc,
  addDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  Table,
  Button,
  Modal,
  Form,
  Row,
  Col,
  Card,
  Badge,
} from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import readXlsxFile from "read-excel-file";

export default function EventMeetings({ eventId, eventTitle, goBack }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStudents, setSessionStudents] = useState([]);

  // Forms
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    date: "",
    time: "",
    venue: "",
    agenda: "",
  });
  const [editingSessionId, setEditingSessionId] = useState(null);

  const [showStudentModal, setShowStudentModal] = useState(false);

  // Team is preserved
  const [studentForm, setStudentForm] = useState({
    name: "",
    urn: "",
    phone: "",
    team: "",
  });
  const [editingStudentId, setEditingStudentId] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, [eventId]);

  const fetchSessions = async () => {
    const q = query(
      collection(db, "events", eventId, "attendance_sessions"),
      orderBy("date", "desc"),
    );
    const snap = await getDocs(q);
    setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchSessionStudents = async (sid) => {
    const snap = await getDocs(
      collection(db, "events", eventId, "attendance_sessions", sid, "students"),
    );
    setSessionStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // --- SESSION LOGIC ---
  const handleCreateSession = async () => {
    if (!sessionForm.date) return;
    if (editingSessionId)
      await updateDoc(
        doc(db, "events", eventId, "attendance_sessions", editingSessionId),
        sessionForm,
      );
    else
      await addDoc(collection(db, "events", eventId, "attendance_sessions"), {
        ...sessionForm,
        createdAt: new Date(),
      });
    setShowSessionModal(false);
    fetchSessions();
  };

  const handleOpenSession = (s) => {
    setActiveSession(s);
    fetchSessionStudents(s.id);
  };

  const handleDeleteSession = async (e, sid) => {
    e.stopPropagation();
    if (window.confirm("Delete Meeting?")) {
      await deleteDoc(doc(db, "events", eventId, "attendance_sessions", sid));
      fetchSessions();
    }
  };

  // --- STUDENT LOGIC ---
  const handleSaveStudent = async () => {
    if (!activeSession) return;
    const ref = collection(
      db,
      "events",
      eventId,
      "attendance_sessions",
      activeSession.id,
      "students",
    );
    if (editingStudentId)
      await updateDoc(doc(ref, editingStudentId), studentForm);
    else await addDoc(ref, studentForm);

    setShowStudentModal(false);
    fetchSessionStudents(activeSession.id);
  };

  const handleDeleteStudent = async (sid) => {
    if (window.confirm("Remove?")) {
      await deleteDoc(
        doc(
          db,
          "events",
          eventId,
          "attendance_sessions",
          activeSession.id,
          "students",
          sid,
        ),
      );
      fetchSessionStudents(activeSession.id);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeSession) return;
    readXlsxFile(file).then(async (rows) => {
      const headers = rows[0].map((x) => String(x).toLowerCase());
      const g = (k) => headers.findIndex((x) => k.some((y) => x.includes(y)));
      const idx = {
        n: g(["name"]),
        u: g(["urn"]),
        p: g(["phone"]),
        t: g(["team"]),
      };
      const newS = rows
        .slice(1)
        .map((r) => ({
          name: idx.n > -1 ? r[idx.n] : "",
          urn: idx.u > -1 ? r[idx.u] : "",
          phone: idx.p > -1 ? r[idx.p] : "",
          team: idx.t > -1 ? r[idx.t] : "",
        }))
        .filter((x) => x.name);
      await Promise.all(
        newS.map((s) =>
          addDoc(
            collection(
              db,
              "events",
              eventId,
              "attendance_sessions",
              activeSession.id,
              "students",
            ),
            s,
          ),
        ),
      );
      alert("Imported!");
      fetchSessionStudents(activeSession.id);
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Attendance Report", 14, 15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Event: ${eventTitle}`, 14, 25);
    doc.text(`Date: ${activeSession.date}`, 14, 32);
    doc.text(`Venue: ${activeSession.venue || "N/A"}`, 14, 39);

    const splitAgenda = doc.splitTextToSize(
      `Agenda: ${activeSession.agenda || "N/A"}`,
      180,
    );
    doc.text(splitAgenda, 14, 46);

    const rows = sessionStudents.map((s, i) => [
      i + 1,
      s.name,
      s.urn,
      s.team || "-",
    ]);
    autoTable(doc, {
      head: [["S.No", "Name", "URN", "Team"]],
      body: rows,
      startY: 55 + splitAgenda.length * 5,
    });
    doc.save(`Attendance_${activeSession.date}.pdf`);
  };

  // --- RENDER LIST VIEW ---
  if (!activeSession) {
    return (
      <>
        <div className="d-flex align-items-center mb-4">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <h3 className="fw-bold mb-0">Attendance Meetings</h3>
          <div className="ms-auto">
            <Button
              onClick={() => {
                setEditingSessionId(null);
                setSessionForm({});
                setShowSessionModal(true);
              }}
            >
              <i className="bi bi-plus-lg me-2"></i>
              Create Meeting
            </Button>
          </div>
        </div>
        <Row className="g-3">
          {sessions.map((s, idx) => (
            <Col md={4} key={s.id}>
              <Card
                className="border-0 shadow-sm cursor-pointer card-hover"
                onClick={() => handleOpenSession(s)}
              >
                <Card.Body className="p-4 position-relative">
                  <div className="position-absolute top-0 end-0 p-3">
                    <Button
                      size="sm"
                      variant="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(s.id);
                        setSessionForm(s);
                        setShowSessionModal(true);
                      }}
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button
                      size="sm"
                      variant="link"
                      className="text-danger"
                      onClick={(e) => handleDeleteSession(e, s.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </div>
                  <h5 className="fw-bold mb-1">
                    Meeting {sessions.length - idx}
                  </h5>
                  <Badge bg="light" text="dark" className="border mb-2">
                    {s.date}
                  </Badge>
                  <div className="small text-muted">{s.venue}</div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* SESSION MODAL */}
        <Modal
          show={showSessionModal}
          onHide={() => setShowSessionModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Meeting Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form className="d-grid gap-3">
              <Form.Control
                type="date"
                value={sessionForm.date || ""}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, date: e.target.value })
                }
              />
              <Row>
                <Col>
                  <Form.Control
                    type="time"
                    value={sessionForm.time || ""}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, time: e.target.value })
                    }
                  />
                </Col>
                <Col>
                  <Form.Control
                    placeholder="Venue"
                    value={sessionForm.venue || ""}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, venue: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <Form.Control
                as="textarea"
                placeholder="Agenda"
                value={sessionForm.agenda || ""}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, agenda: e.target.value })
                }
              />
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={handleCreateSession}>Save</Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  // --- RENDER DETAIL VIEW ---
  return (
    <>
      <div className="d-flex align-items-center mb-4 gap-3">
        <Button
          variant="outline-secondary"
          className="me-3 rounded-circle"
          onClick={() => setActiveSession(null)}
        >
          <i className="bi bi-arrow-left"></i>
        </Button>
        <div>
          <h3 className="fw-bold mb-0">Meeting Details</h3>
          <span className="text-muted small">
            {activeSession.date} &bull; {activeSession.venue}
          </span>
        </div>
        <div className="ms-auto d-flex gap-2">
          {/* UPDATED: Added Icon for PDF */}
          <Button variant="outline-danger" onClick={generatePDF}>
            <i className="bi bi-file-earmark-pdf me-2"></i>Generate PDF
          </Button>

          {/* UPDATED: Added Icon for Add Student */}
          <Button
            onClick={() => {
              setEditingStudentId(null);
              setStudentForm({});
              setShowStudentModal(true);
            }}
          >
            <i className="bi bi-person-plus-fill me-2"></i>Add Student
          </Button>

          {/* UPDATED: Added Icon for Upload Excel */}
          <div className="d-inline-block">
            <input
              type="file"
              id="att-file"
              hidden
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
            />
            <label
              htmlFor="att-file"
              className="btn btn-success text-white mb-0"
            >
              <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>Upload
              Excel
            </label>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <Table hover responsive className="mb-0">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>URN</th>
              <th>Team</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessionStudents.map((s, idx) => (
              <tr key={s.id}>
                <td>{idx + 1}</td>
                <td className="fw-bold">{s.name}</td>
                <td>{s.urn}</td>
                <td>{s.team}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="border-0"
                      onClick={() => {
                        setEditingStudentId(s.id);
                        setStudentForm(s);
                        setShowStudentModal(true);
                      }}
                    >
                      <i className="bi bi-pencil-fill text-primary"></i>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="border-0"
                      onClick={() => handleDeleteStudent(s.id)}
                    >
                      <i className="bi bi-trash-fill text-danger"></i>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* STUDENT MODAL */}
      <Modal
        show={showStudentModal}
        onHide={() => setShowStudentModal(false)}
        centered
      >
        <Modal.Body className="d-grid gap-3">
          <Form.Control
            placeholder="Name"
            value={studentForm.name || ""}
            onChange={(e) =>
              setStudentForm({ ...studentForm, name: e.target.value })
            }
          />
          <Form.Control
            placeholder="URN"
            value={studentForm.urn || ""}
            onChange={(e) =>
              setStudentForm({ ...studentForm, urn: e.target.value })
            }
          />
          <Form.Control
            placeholder="Phone"
            value={studentForm.phone || ""}
            onChange={(e) =>
              setStudentForm({ ...studentForm, phone: e.target.value })
            }
          />
          <Form.Control
            placeholder="Team"
            value={studentForm.team || ""}
            onChange={(e) =>
              setStudentForm({ ...studentForm, team: e.target.value })
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveStudent}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
