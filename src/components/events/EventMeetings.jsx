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
  Dropdown,
  OverlayTrigger,
  Tooltip,
  Popover,
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

  const [studentForm, setStudentForm] = useState({
    name: "",
    urn: "",
    phone: "",
    team: "",
  });
  const [editingStudentId, setEditingStudentId] = useState(null);

  // Filter State
  const [selectedDate, setSelectedDate] = useState(null);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchSessions();
  }, [eventId]);

  const fetchSessions = async () => {
    const q = query(
      collection(db, "events", eventId, "attendance_sessions"),
      orderBy("date", "desc"),
    );
    const snap = await getDocs(q);
    const sessionsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setSessions(sessionsList);
    // Extract unique dates for filter
    const dates = [...new Set(sessionsList.map((s) => s.date))]
      .sort()
      .reverse();
    setUniqueDates(dates);
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
    e.stopPropagation(); // Prevent card click
    if (window.confirm("Delete Meeting?")) {
      await deleteDoc(doc(db, "events", eventId, "attendance_sessions", sid));
      fetchSessions();
    }
  };

  const handleEditSessionClick = (e, s) => {
    e.stopPropagation(); // Prevent card click
    setEditingSessionId(s.id);
    setSessionForm(s);
    setShowSessionModal(true);
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

  // Helper to get initials
  const getInitials = (name) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "??";
  };

  // --- RENDER LIST VIEW ---
  if (!activeSession) {
    return (
      <>
        <div className="d-flex align-items-center mb-4">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle shadow-sm"
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={goBack}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">Meeting Schedule</h3>
            <p className="text-muted small mb-0">Manage attendance & agendas</p>
          </div>
          <div className="ms-auto">
            <Button
              variant="primary"
              className="rounded-pill px-4"
              onClick={() => {
                setEditingSessionId(null);
                setSessionForm({});
                setShowSessionModal(true);
              }}
            >
              <i className="bi bi-plus-lg me-2"></i>
              Schedule Meeting
            </Button>
          </div>
        </div>

        {/* Date Filter Calendar */}
        <div className="mb-4 d-flex align-items-center gap-2">
          <OverlayTrigger
            show={showCalendar}
            placement="bottom"
            overlay={
              <Popover
                className="custom-calendar-popover"
                style={{
                  backgroundColor: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                }}
              >
                <Popover.Body style={{ padding: "0" }}>
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "var(--bg-main)",
                      borderRadius: "12px",
                    }}
                  >
                    {/* Calendar Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          setCurrentMonth(
                            new Date(
                              currentMonth.getFullYear(),
                              currentMonth.getMonth() - 1,
                            ),
                          )
                        }
                        className="text-muted p-0"
                      >
                        <i className="bi bi-chevron-left"></i>
                      </Button>
                      <span className="fw-bold text-center" style={{ flex: 1 }}>
                        {currentMonth.toLocaleString("default", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          setCurrentMonth(
                            new Date(
                              currentMonth.getFullYear(),
                              currentMonth.getMonth() + 1,
                            ),
                          )
                        }
                        className="text-muted p-0"
                      >
                        <i className="bi bi-chevron-right"></i>
                      </Button>
                    </div>

                    {/* Days of Week */}
                    <div
                      className="d-grid mb-2"
                      style={{
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "8px",
                      }}
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="text-center small text-muted fw-bold"
                            style={{ height: "28px" }}
                          >
                            {day}
                          </div>
                        ),
                      )}
                    </div>

                    {/* Calendar Dates */}
                    <div
                      className="d-grid"
                      style={{
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "8px",
                      }}
                    >
                      {(() => {
                        const year = currentMonth.getFullYear();
                        const month = currentMonth.getMonth();
                        const firstDay = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(
                          year,
                          month + 1,
                          0,
                        ).getDate();
                        const days = [];

                        // Empty cells before month starts
                        for (let i = 0; i < firstDay; i++) {
                          days.push(
                            <div
                              key={`empty-${i}`}
                              style={{ height: "28px" }}
                            ></div>,
                          );
                        }

                        // Days of month
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const hasMeeting = uniqueDates.includes(dateStr);
                          const isSelected = selectedDate === dateStr;

                          days.push(
                            <button
                              key={day}
                              onClick={() => {
                                if (hasMeeting) {
                                  setSelectedDate(dateStr);
                                  setShowCalendar(false);
                                }
                              }}
                              style={{
                                height: "28px",
                                border: hasMeeting
                                  ? isSelected
                                    ? "2px solid #0d6efd"
                                    : "1px solid #0d6efd"
                                  : "1px solid var(--border-color)",
                                backgroundColor: isSelected
                                  ? "#0d6efd"
                                  : hasMeeting
                                    ? "rgba(13, 110, 253, 0.1)"
                                    : "transparent",
                                color: isSelected
                                  ? "white"
                                  : "var(--text-primary)",
                                borderRadius: "4px",
                                cursor: hasMeeting ? "pointer" : "default",
                                fontSize: "0.85rem",
                                fontWeight: hasMeeting ? "bold" : "normal",
                                opacity: hasMeeting ? 1 : 0.3,
                                padding: "0",
                              }}
                            >
                              {day}
                            </button>,
                          );
                        }

                        return days;
                      })()}
                    </div>

                    {/* Clear Filter */}
                    <div
                      className="mt-3 pt-2 border-top"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="w-100"
                        onClick={() => {
                          setSelectedDate(null);
                          setShowCalendar(false);
                        }}
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </div>
                </Popover.Body>
              </Popover>
            }
          >
            <Button
              variant={selectedDate ? "primary" : "outline-secondary"}
              className="d-flex align-items-center gap-2"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <i className="bi bi-calendar-event"></i>
              {selectedDate ? `${selectedDate}` : "Filter by Date"}
            </Button>
          </OverlayTrigger>
        </div>

        <Row className="g-4">
          {/* Add New Card (Dashed) - moved to the start */}
          <Col md={6} lg={4}>
            <div
              className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-4"
              style={{
                border: "2px dashed var(--border-dashed)",
                borderRadius: "16px",
                cursor: "pointer",
                minHeight: "200px",
                color: "var(--text-muted)",
                backgroundColor: "transparent",
              }}
              onClick={() => {
                setEditingSessionId(null);
                setSessionForm({});
                setShowSessionModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0d6efd";
                e.currentTarget.style.color = "#0d6efd";
                e.currentTarget.style.backgroundColor =
                  "rgba(13, 110, 253, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-dashed)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div
                className="avatar-circle mb-3"
                style={{
                  width: "50px",
                  height: "50px",
                  backgroundColor: "var(--soft-hover)",
                  color: "inherit",
                }}
              >
                <i className="bi bi-plus-lg fs-4"></i>
              </div>
              <h6 className="fw-bold mb-1">Schedule New Meeting</h6>
              <small>Plan upcoming discussions</small>
            </div>
          </Col>

          {sessions
            .filter((s) => selectedDate === null || s.date === selectedDate)
            .map((s, idx) => (
              <Col md={6} lg={4} key={s.id}>
                <div
                  className="soft-card h-100 d-flex flex-column position-relative overflow-hidden"
                  style={{ cursor: "pointer", minHeight: "200px" }}
                  onClick={() => handleOpenSession(s)}
                >
                  {/* Top Colored Bar (Optional aesthetic touch) */}
                  <div
                    style={{
                      height: "6px",
                      width: "100%",
                      background:
                        "linear-gradient(90deg, #0d6efd 0%, #6610f2 100%)",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  ></div>

                  <div className="d-flex justify-content-between align-items-start mb-3 mt-2 gap-2">
                    {/* Date Box */}
                    <div
                      className="rounded p-2 text-center border flex-shrink-0"
                      style={{
                        minWidth: "60px",
                        backgroundColor: "var(--soft-hover)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <div
                        className="fw-bold text-primary"
                        style={{ lineHeight: "1" }}
                      >
                        {new Date(s.date).getDate()}
                      </div>
                      <div
                        className="small text-uppercase text-muted"
                        style={{ fontSize: "0.65rem" }}
                      >
                        {new Date(s.date).toLocaleString("default", {
                          month: "short",
                        })}
                      </div>
                    </div>

                    {/* Agenda Title */}
                    <h5 className="fw-bold mb-0 text-truncate flex-grow-1">
                      {s.agenda || `Meeting #${sessions.length - idx}`}
                    </h5>

                    {/* Action Dropdown */}
                    <Dropdown
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    >
                      <Dropdown.Toggle
                        variant="link"
                        className="text-muted p-0 no-caret"
                        id={`dropdown-${s.id}`}
                      >
                        <i className="bi bi-three-dots"></i>
                      </Dropdown.Toggle>
                      <Dropdown.Menu align="end">
                        <Dropdown.Item
                          onClick={(e) => handleEditSessionClick(e, s)}
                        >
                          <i className="bi bi-pencil me-2"></i>Edit Details
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={(e) => handleDeleteSession(e, s.id)}
                        >
                          <i className="bi bi-trash me-2"></i>Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  <div className="mb-3 text-muted small d-flex align-items-center">
                    <i className="bi bi-clock me-2"></i>
                    {s.time ? (
                      <span>
                        {new Date(`1970-01-01T${s.time}`).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    ) : (
                      "Time TBD"
                    )}
                    <span className="mx-2">•</span>
                    <i className="bi bi-geo-alt me-2"></i>
                    <span
                      className="text-truncate"
                      style={{ maxWidth: "120px" }}
                    >
                      {s.venue || "No Venue"}
                    </span>
                  </div>

                  <div
                    className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="d-flex align-items-center">
                      {/* Fake Avatar Stack for visual effect */}
                      <div className="d-flex ms-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="rounded-circle border border-white d-flex align-items-center justify-content-center text-white small"
                            style={{
                              width: "24px",
                              height: "24px",
                              marginLeft: "-8px",
                              backgroundColor: "#adb5bd",
                              fontSize: "0.6rem",
                            }}
                          >
                            <i className="bi bi-person-fill"></i>
                          </div>
                        ))}
                      </div>
                      <small
                        className="text-muted ms-2"
                        style={{ fontSize: "0.75rem" }}
                      >
                        View Attendees
                      </small>
                    </div>

                    <Button
                      variant="light"
                      size="sm"
                      className="rounded-pill px-3 soft-open-btn"
                    >
                      Open <i className="bi bi-arrow-right ms-1"></i>
                    </Button>
                  </div>
                </div>
              </Col>
            ))}

          {sessions.filter(
            (s) => selectedDate === null || s.date === selectedDate,
          ).length === 0 && (
            <Col xs={12}>
              <div
                className="text-center p-5"
                style={{
                  backgroundColor: "var(--soft-hover)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <i className="bi bi-calendar-x display-4 opacity-25 d-block mb-3"></i>
                <p className="text-muted mb-0">
                  {selectedDate
                    ? `No meetings scheduled for ${selectedDate}`
                    : "No meetings scheduled yet"}
                </p>
              </div>
            </Col>
          )}
        </Row>

        {/* SESSION MODAL */}
        <Modal
          show={showSessionModal}
          onHide={() => setShowSessionModal(false)}
          centered
        >
          <div className="soft-card border-0 p-0 overflow-hidden">
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">Meeting Details</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
              <Form className="d-grid gap-3">
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">
                    DATE
                  </Form.Label>
                  <Form.Control
                    type="date"
                    className="form-control"
                    value={sessionForm.date || ""}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, date: e.target.value })
                    }
                  />
                </Form.Group>
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        TIME
                      </Form.Label>
                      <Form.Control
                        type="time"
                        className="form-control"
                        value={sessionForm.time || ""}
                        onChange={(e) =>
                          setSessionForm({
                            ...sessionForm,
                            time: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        VENUE
                      </Form.Label>
                      <Form.Control
                        placeholder="e.g. Conference Room"
                        className="form-control"
                        value={sessionForm.venue || ""}
                        onChange={(e) =>
                          setSessionForm({
                            ...sessionForm,
                            venue: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">
                    AGENDA / TOPIC
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="What is this meeting about?"
                    className="form-control"
                    value={sessionForm.agenda || ""}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, agenda: e.target.value })
                    }
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="light"
                onClick={() => setShowSessionModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateSession}
                className="px-4"
              >
                Save Meeting
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      </>
    );
  }

  // --- RENDER DETAIL VIEW (List of Students) ---
  return (
    <>
      <div className="d-flex align-items-center mb-4 gap-3">
        <Button
          variant="outline-secondary"
          className="me-3 rounded-circle shadow-sm"
          style={{
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setActiveSession(null)}
        >
          <i className="bi bi-arrow-left"></i>
        </Button>
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          <span className="text-muted small d-flex align-items-center">
            <i className="bi bi-calendar-event me-2"></i> {activeSession.date}
            <span className="mx-2">•</span>
            <i className="bi bi-geo-alt me-1"></i>{" "}
            {activeSession.venue || "No Venue"}
          </span>
          <h3
            className="fw-bold mb-0 text-truncate"
            style={{ maxWidth: "400px" }}
          >
            {activeSession.agenda || "Meeting Details"}
          </h3>
        </div>
        <div className="ms-auto d-flex gap-2">
          <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip>Download PDF Report</Tooltip>}
          >
            <Button
              variant="outline-danger"
              className="d-flex align-items-center"
              onClick={generatePDF}
            >
              <i className="bi bi-file-earmark-pdf fs-5"></i>
            </Button>
          </OverlayTrigger>

          <Button
            variant="primary"
            className="d-flex align-items-center gap-2"
            onClick={() => {
              setEditingStudentId(null);
              setStudentForm({});
              setShowStudentModal(true);
            }}
          >
            <i className="bi bi-person-plus-fill"></i>{" "}
            <span className="d-none d-md-inline">Add Student</span>
          </Button>

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
              className="btn btn-success text-white mb-0 d-flex align-items-center gap-2"
              style={{ height: "100%" }}
            >
              <i className="bi bi-file-earmark-spreadsheet-fill"></i>{" "}
              <span className="d-none d-md-inline">Import Excel</span>
            </label>
          </div>
        </div>
      </div>

      <div
        className="soft-card p-0 overflow-hidden shadow-sm"
        style={{ height: "fit-content" }}
      >
        <Table hover responsive className="mb-0 align-middle">
          <thead style={{ backgroundColor: "var(--soft-hover)" }}>
            <tr>
              <th
                className="ps-4 py-3 text-secondary text-uppercase small"
                style={{ width: "5%" }}
              >
                #
              </th>
              <th
                className="text-secondary text-uppercase small"
                style={{ width: "35%" }}
              >
                Student Name
              </th>
              <th className="text-secondary text-uppercase small">URN</th>
              <th className="text-secondary text-uppercase small">Team</th>
              <th className="text-end pe-4 text-secondary text-uppercase small">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sessionStudents.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-5 text-muted">
                  <i className="bi bi-people display-4 opacity-25 d-block mb-3"></i>
                  No students added to this meeting yet.
                </td>
              </tr>
            ) : (
              sessionStudents.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td className="ps-4 text-muted">{idx + 1}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <div
                        className="avatar-circle me-3 flex-shrink-0"
                        style={{
                          width: "32px",
                          height: "32px",
                          fontSize: "0.8rem",
                          backgroundColor: "var(--bg-main)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        {getInitials(s.name)}
                      </div>
                      <span className="fw-bold text-body">{s.name}</span>
                    </div>
                  </td>
                  <td className="text-muted">
                    <code className="text-primary">{s.urn}</code>
                  </td>
                  <td>
                    <Badge bg="light" text="dark" className="border fw-normal">
                      {s.team || "General"}
                    </Badge>
                  </td>
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-primary p-1"
                        onClick={() => {
                          setEditingStudentId(s.id);
                          setStudentForm(s);
                          setShowStudentModal(true);
                        }}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </Button>

                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-danger p-1"
                        onClick={() => handleDeleteStudent(s.id)}
                      >
                        <i className="bi bi-trash-fill"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* STUDENT MODAL */}
      <Modal
        show={showStudentModal}
        onHide={() => setShowStudentModal(false)}
        centered
      >
        <div className="soft-card border-0 p-0 overflow-hidden">
          <Modal.Header
            closeButton
            className="border-bottom"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Modal.Title className="fw-bold h5">Student Details</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Form className="d-grid gap-3">
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  FULL NAME
                </Form.Label>
                <Form.Control
                  placeholder="e.g. John Doe"
                  className="form-control"
                  value={studentForm.name || ""}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, name: e.target.value })
                  }
                />
              </Form.Group>
              <Row>
                <Col>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">
                      URN / ID
                    </Form.Label>
                    <Form.Control
                      placeholder="e.g. 2004567"
                      className="form-control"
                      value={studentForm.urn || ""}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, urn: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group>
                    <Form.Label className="small fw-bold text-muted">
                      PHONE
                    </Form.Label>
                    <Form.Control
                      placeholder="Optional"
                      className="form-control"
                      value={studentForm.phone || ""}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          phone: e.target.value,
                        })
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  TEAM / DEPARTMENT
                </Form.Label>
                <Form.Control
                  placeholder="e.g. Logistics"
                  className="form-control"
                  value={studentForm.team || ""}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, team: e.target.value })
                  }
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0">
            <Button variant="light" onClick={() => setShowStudentModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveStudent}
              className="px-4"
            >
              Save Entry
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}
