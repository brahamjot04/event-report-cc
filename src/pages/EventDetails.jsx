import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import {
  Accordion,
  Table,
  Badge,
  Modal,
  Form,
  Button,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import Layout from "../components/Layout";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();

  // --- USER & VIEW STATE ---
  const [userRole, setUserRole] = useState("user");
  const [currentView, setCurrentView] = useState("dashboard");
  const [eventData, setEventData] = useState(null);
  const [eventProofUrl, setEventProofUrl] = useState("");

  // --- MODULE 1: INTERNAL PARTICIPANTS ---
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [partForm, setPartForm] = useState({
    name: "",
    crn: "",
    urn: "",
    branch: "",
    phone: "",
    year: "",
    position: "",
  });
  const [editingIndex, setEditingIndex] = useState(null);

  // --- MODULE 2: MEETINGS (ATTENDANCE) ---
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStudents, setSessionStudents] = useState([]);
  const [sessionForm, setSessionForm] = useState({
    date: "",
    time: "",
    venue: "",
    agenda: "",
  });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [attStudentForm, setAttStudentForm] = useState({
    name: "",
    urn: "",
    phone: "",
    team: "",
  });
  const [editingSessionStudentId, setEditingSessionStudentId] = useState(null);

  // --- MODULE 3: SPONSORSHIP ---
  const [sponsorshipList, setSponsorshipList] = useState([]);
  const [sponForm, setSponForm] = useState({
    name: "",
    crn: "",
    urn: "",
    phone: "",
    date: "",
    venue: "",
    startTime: "",
    endTime: "",
  });
  const [editingSponId, setEditingSponId] = useState(null);
  const [pdfFields, setPdfFields] = useState({
    name: true,
    crn: true,
    urn: true,
    date: false,
    venue: true,
    time: true,
    phone: false,
  });

  // --- MODAL STATES ---
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showAttStudentModal, setShowAttStudentModal] = useState(false);
  const [showSponModal, setShowSponModal] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);

  // --- HELPER: DATE FORMATTER ---
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
  };

  // --- INITIAL DATA FETCHING ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);
      }
    });

    const fetchData = async () => {
      try {
        const eventSnap = await getDoc(doc(db, "events", id));
        if (eventSnap.exists()) {
          setEventData(eventSnap.data());
          setEventProofUrl(eventSnap.data().proofUrl || "");
        } else {
          navigate("/");
        }

        // Fetch Internal Items
        const itemsSnap = await getDocs(collection(db, "events", id, "items"));
        setItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
    return () => unsubscribe();
  }, [id, navigate, auth]);

  // ==========================================
  //      MODULE: INTERNAL PARTICIPANTS
  // ==========================================
  const handleAddItem = async () => {
    if (!newItemName) return;
    await addDoc(collection(db, "events", id, "items"), {
      name: newItemName,
      participants: [],
    });
    const snap = await getDocs(collection(db, "events", id, "items"));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setShowItemModal(false);
    setNewItemName("");
  };

  const handleDeleteSubEvent = async (iid) => {
    if (window.confirm("Delete?")) {
      await deleteDoc(doc(db, "events", id, "items", iid));
      const snap = await getDocs(collection(db, "events", id, "items"));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
  };

  const handleDeleteParticipant = async (idx, item) => {
    if (window.confirm("Remove?")) {
      const p = item.participants.filter((_, i) => i !== idx);
      await updateDoc(doc(db, "events", id, "items", item.id), {
        participants: p,
      });
      setItems(
        items.map((i) => (i.id === item.id ? { ...i, participants: p } : i)),
      );
    }
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let u = [...(activeItem.participants || [])];
    if (editingIndex !== null) u[editingIndex] = partForm;
    else u.push(partForm);
    await updateDoc(doc(db, "events", id, "items", activeItem.id), {
      participants: u,
    });
    setItems(
      items.map((i) =>
        i.id === activeItem.id ? { ...i, participants: u } : i,
      ),
    );
    setShowPartModal(false);
  };

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (!f || !activeItem) return;
    readXlsxFile(f).then((r) => {
      const n = r
        .slice(1)
        .map((row) => ({
          name: row[0] || "",
          crn: row[1] || "",
          urn: row[2] || "",
          branch: row[3] || "",
          phone: row[4] || "",
          year: row[5] || "",
          position: row[6] || "",
        }))
        .filter((x) => x.name);
      const u = [...(activeItem.participants || []), ...n];
      updateDoc(doc(db, "events", id, "items", activeItem.id), {
        participants: u,
      }).then(() => {
        setItems(
          items.map((i) =>
            i.id === activeItem.id ? { ...i, participants: u } : i,
          ),
        );
        alert("Imported!");
      });
    });
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.text("Event Report", 14, 15);
      doc.text(`Event: ${eventData.title}`, 14, 25);
      let finalY = 35;
      items.forEach((item) => {
        doc.setFont("helvetica", "bold");
        doc.text(item.name.toUpperCase(), 14, finalY);
        finalY += 5;
        const rows = item.participants?.map((p, i) => [
          i + 1,
          p.name,
          p.urn,
          p.crn,
          p.branch,
          p.year,
          p.position,
        ]);
        autoTable(doc, {
          head: [["S.No", "Name", "URN", "CRN", "Branch", "Year", "Position"]],
          body: rows,
          startY: finalY,
          theme: "grid",
        });
        finalY = doc.lastAutoTable.finalY + 15;
        if (finalY > 150) {
          doc.addPage();
          finalY = 20;
        }
      });
      doc.save(`${eventData.title}_Report.pdf`);
    } catch (e) {
      alert("Error generating PDF");
    }
  };

  // ==========================================
  //      MODULE: SPONSORSHIP
  // ==========================================
  const fetchSponsorships = async () => {
    const q = query(
      collection(db, "events", id, "sponsorship_records"),
      orderBy("date", "asc"),
      orderBy("startTime", "asc"),
    );
    const snap = await getDocs(q);
    setSponsorshipList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleSaveSponsorship = async () => {
    if (!sponForm.name) return;
    if (editingSponId)
      await updateDoc(
        doc(db, "events", id, "sponsorship_records", editingSponId),
        sponForm,
      );
    else
      await addDoc(
        collection(db, "events", id, "sponsorship_records"),
        sponForm,
      );
    setSponForm({
      name: "",
      crn: "",
      urn: "",
      phone: "",
      date: "",
      venue: "",
      startTime: "",
      endTime: "",
    });
    setEditingSponId(null);
    setShowSponModal(false);
    fetchSponsorships();
  };

  const handleEditSponsorship = (r) => {
    setSponForm(r);
    setEditingSponId(r.id);
    setShowSponModal(true);
  };
  const handleDeleteSponsorship = async (rid) => {
    if (window.confirm("Delete?"))
      await deleteDoc(doc(db, "events", id, "sponsorship_records", rid));
    fetchSponsorships();
  };

  const handleSponFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readXlsxFile(file).then(async (rows) => {
      if (rows.length < 2) return alert("File empty");
      const headers = rows[0].map((h) => String(h).toLowerCase().trim());
      const getIdx = (k) =>
        headers.findIndex((h) => k.some((x) => h.includes(x)));
      const idx = {
        name: getIdx(["name"]),
        crn: getIdx(["crn"]),
        urn: getIdx(["urn"]),
        phone: getIdx(["phone", "contact"]),
        date: getIdx(["date"]),
        venue: getIdx(["venue"]),
        start: getIdx(["start"]),
        end: getIdx(["end"]),
      };
      const newRecs = rows
        .slice(1)
        .map((r) => ({
          name: idx.name > -1 ? r[idx.name] : "",
          crn: idx.crn > -1 ? r[idx.crn] : "",
          urn: idx.urn > -1 ? r[idx.urn] : "",
          phone: idx.phone > -1 ? r[idx.phone] : "",
          date: idx.date > -1 ? r[idx.date] : "",
          venue: idx.venue > -1 ? r[idx.venue] : "",
          startTime: idx.start > -1 ? r[idx.start] : "",
          endTime: idx.end > -1 ? r[idx.end] : "",
        }))
        .filter((r) => r.name);
      await Promise.all(
        newRecs.map((r) =>
          addDoc(collection(db, "events", id, "sponsorship_records"), r),
        ),
      );
      alert(`Imported ${newRecs.length} records!`);
      fetchSponsorships();
      e.target.value = "";
    });
  };

  const generateSponsorshipPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Sponsorship Attendance Report", 14, 15);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Event: ${eventData.title}`, 14, 23);

      // Group by Date
      const grouped = sponsorshipList.reduce((acc, item) => {
        const d = item.date;
        if (!acc[d]) acc[d] = [];
        acc[d].push(item);
        return acc;
      }, {});
      const sortedDates = Object.keys(grouped).sort();
      let finalY = 30;

      const headers = ["S.No"];
      const keys = [];
      if (pdfFields.name) {
        headers.push("Name");
        keys.push("name");
      }
      if (pdfFields.crn) {
        headers.push("CRN");
        keys.push("crn");
      }
      if (pdfFields.urn) {
        headers.push("URN");
        keys.push("urn");
      }
      if (pdfFields.venue) {
        headers.push("Venue");
        keys.push("venue");
      }
      if (pdfFields.time) {
        headers.push("Time");
        keys.push("time");
      }
      if (pdfFields.phone) {
        headers.push("Contact");
        keys.push("phone");
      }

      sortedDates.forEach((dateKey) => {
        if (finalY > doc.internal.pageSize.height - 40) {
          doc.addPage();
          finalY = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Date: ${formatDate(dateKey)}`, 14, finalY);
        finalY += 5;
        const tableRows = grouped[dateKey].map((s, i) => {
          const row = [i + 1];
          keys.forEach((key) => {
            if (key === "time")
              row.push(`${s.startTime || ""} - ${s.endTime || ""}`);
            else row.push(s[key] || "");
          });
          return row;
        });
        autoTable(doc, {
          head: [headers],
          body: tableRows,
          startY: finalY,
          theme: "grid",
          headStyles: { fillColor: [40, 167, 69] },
          margin: { bottom: 20 },
        });
        finalY = doc.lastAutoTable.finalY + 15;
      });

      if (finalY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        finalY = 40;
      }
      doc.line(30, finalY, 90, finalY);
      doc.text("Chairman", 60, finalY + 5, { align: "center" });
      doc.line(
        doc.internal.pageSize.width - 90,
        finalY,
        doc.internal.pageSize.width - 30,
        finalY,
      );
      doc.text(
        "Cultural Coordinator",
        doc.internal.pageSize.width - 60,
        finalY + 5,
        { align: "center" },
      );
      doc.save(`${eventData.title}_Sponsorship.pdf`);
      setShowPdfOptions(false);
    } catch (err) {
      alert("PDF Error");
    }
  };

  // ==========================================
  //      MODULE: MEETINGS (ATTENDANCE)
  // ==========================================
  const fetchSessions = async () => {
    const q = query(
      collection(db, "events", id, "attendance_sessions"),
      orderBy("date", "desc"),
    );
    const snap = await getDocs(q);
    setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  const fetchSessionStudents = async (sid) => {
    const snap = await getDocs(
      collection(db, "events", id, "attendance_sessions", sid, "students"),
    );
    setSessionStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleCreateSession = async () => {
    if (!sessionForm.date) return;
    if (editingSessionId)
      await updateDoc(
        doc(db, "events", id, "attendance_sessions", editingSessionId),
        sessionForm,
      );
    else
      await addDoc(collection(db, "events", id, "attendance_sessions"), {
        ...sessionForm,
        createdAt: new Date(),
      });
    setShowSessionModal(false);
    fetchSessions();
  };
  const handleOpenSession = (s) => {
    setActiveSession(s);
    fetchSessionStudents(s.id);
    setCurrentView("attendance_details");
  };
  const handleDeleteSession = async (e, sid) => {
    e.stopPropagation();
    if (window.confirm("Delete?"))
      await deleteDoc(doc(db, "events", id, "attendance_sessions", sid));
    fetchSessions();
  };
  const handleSaveStudentToSession = async () => {
    if (!activeSession) return;
    if (editingSessionStudentId)
      await updateDoc(
        doc(
          db,
          "events",
          id,
          "attendance_sessions",
          activeSession.id,
          "students",
          editingSessionStudentId,
        ),
        attStudentForm,
      );
    else
      await addDoc(
        collection(
          db,
          "events",
          id,
          "attendance_sessions",
          activeSession.id,
          "students",
        ),
        attStudentForm,
      );
    setAttStudentForm({ name: "", urn: "", phone: "", team: "" });
    setEditingSessionStudentId(null);
    setShowAttStudentModal(false);
    fetchSessionStudents(activeSession.id);
  };
  const handleDeleteSessionStudent = async (sid) => {
    if (window.confirm("Remove?"))
      await deleteDoc(
        doc(
          db,
          "events",
          id,
          "attendance_sessions",
          activeSession.id,
          "students",
          sid,
        ),
      );
    fetchSessionStudents(activeSession.id);
  };
  const handleEditSessionStudent = (s) => {
    setAttStudentForm({
      name: s.name,
      urn: s.urn,
      phone: s.phone,
      team: s.team,
    });
    setEditingSessionStudentId(s.id);
    setShowAttStudentModal(true);
  };

  const generateAttendancePDF = () => {
    if (!activeSession) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Attendance Report", 14, 15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Event: ${eventData.title}`, 14, 25);
    doc.text(`Date: ${formatDate(activeSession.date)}`, 14, 32);
    const rows = sessionStudents.map((s, i) => [
      i + 1,
      s.name,
      s.urn,
      s.team || "-",
    ]);
    autoTable(doc, {
      head: [["S.No", "Name", "URN", "Team"]],
      body: rows,
      startY: 40,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });
    const timeStr = activeSession.time
      ? activeSession.time.replace(/:/g, "-")
      : "NoTime";
    doc.save(
      `${eventData.title}_${formatDate(activeSession.date)}_${timeStr}.pdf`,
    );
  };

  const handleAttendanceFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeSession) return;
    readXlsxFile(file).then(async (rows) => {
      const h = rows[0].map((x) => String(x).toLowerCase());
      const g = (k) => h.findIndex((x) => k.some((y) => x.includes(y)));
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
              id,
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
      e.target.value = "";
    });
  };

  // --- GENERAL EVENT ACTIONS ---
  const handleDeleteEvent = async () => {
    if (window.confirm("Delete EVENT?")) {
      await deleteDoc(doc(db, "events", id));
      navigate("/");
    }
  };
  const handleSaveProof = async () => {
    await updateDoc(doc(db, "events", id), { proofUrl: eventProofUrl });
    setShowProofModal(false);
  };

  if (!eventData) return <div className="p-5 text-center">Loading...</div>;

  // ==========================================
  //          VIEW: DASHBOARD
  // ==========================================
  if (currentView === "dashboard") {
    return (
      <Layout>
        <div className="d-flex align-items-center mb-4">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">{eventData.title}</h3>
            <span className="text-muted small">
              <i className="bi bi-geo-alt"></i> {eventData.venue} &bull;{" "}
              {formatDate(eventData.date)}
            </span>
          </div>
        </div>
        <Row className="g-4">
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm cursor-pointer card-hover"
              onClick={() => setCurrentView("participants")}
            >
              <Card.Body className="p-4 text-center">
                <div className="mb-3 text-primary">
                  <i
                    className="bi bi-people-fill"
                    style={{ fontSize: "3rem" }}
                  ></i>
                </div>
                <h5 className="fw-bold text-body">Participants</h5>
                <small className="text-muted">Internal Management</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm cursor-pointer card-hover"
              onClick={() => {
                fetchSessions();
                setCurrentView("attendance_sessions");
              }}
            >
              <Card.Body className="p-4 text-center">
                <div className="mb-3 text-success">
                  <i
                    className="bi bi-calendar-check-fill"
                    style={{ fontSize: "3rem" }}
                  ></i>
                </div>
                <h5 className="fw-bold text-body">Meetings</h5>
                <small className="text-muted">Committee Attendance</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm cursor-pointer card-hover"
              onClick={() => {
                fetchSponsorships();
                setCurrentView("sponsorship");
              }}
            >
              <Card.Body className="p-4 text-center">
                <div className="mb-3 text-warning">
                  <i
                    className="bi bi-briefcase-fill"
                    style={{ fontSize: "3rem" }}
                  ></i>
                </div>
                <h5 className="fw-bold text-body">Sponsorship</h5>
                <small className="text-muted">Sponsor Tracking</small>
              </Card.Body>
            </Card>
          </Col>
          {(userRole === "admin" || userRole === "super_admin") && (
            <Col md={12} className="mt-5 text-center">
              <Button
                variant="link"
                className="text-danger text-decoration-none"
                onClick={handleDeleteEvent}
              >
                <i className="bi bi-trash me-2"></i> Delete This Event
              </Button>
            </Col>
          )}
        </Row>
      </Layout>
    );
  }

  // ==========================================
  //          VIEW: PARTICIPANTS
  // ==========================================
  if (currentView === "participants") {
    return (
      <Layout>
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center mb-4 gap-3">
          <div className="d-flex align-items-center w-100 w-md-auto">
            <Button
              variant="outline-secondary"
              className="me-3 rounded-circle"
              onClick={() => setCurrentView("dashboard")}
            >
              <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
              <h3 className="fw-bold mb-0">Participant Details</h3>
              <span className="text-muted small">{eventData.title}</span>
            </div>
          </div>
          <div className="d-grid gap-2 d-md-flex ms-md-auto w-100 w-md-auto">
            <Button
              variant="outline-success"
              onClick={() => setShowProofModal(true)}
            >
              {eventProofUrl ? "Linked" : "Link Proof"}
            </Button>
            <Button variant="outline-primary" onClick={generatePDF}>
              Report
            </Button>
            <Button variant="primary" onClick={() => setShowItemModal(true)}>
              Add Sub-Event
            </Button>
          </div>
        </div>
        <Accordion defaultActiveKey="0">
          {items.map((item, index) => (
            <Accordion.Item
              eventKey={index.toString()}
              key={item.id}
              className="mb-3 border-0 shadow-sm"
            >
              <Accordion.Header>
                <span className="fw-bold me-2">{item.name}</span>
                <Badge bg="secondary">{item.participants?.length || 0}</Badge>
              </Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="p-3 bg-body-tertiary d-flex gap-2">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => {
                      setActiveItem(item);
                      setEditingIndex(null);
                      setPartForm({
                        name: "",
                        crn: "",
                        urn: "",
                        branch: "",
                        phone: "",
                        year: "",
                        position: "",
                      });
                      setShowPartModal(true);
                    }}
                  >
                    Add Student
                  </Button>
                  <div className="d-inline-block">
                    <input
                      type="file"
                      id={`file-${item.id}`}
                      hidden
                      accept=".xlsx,.xls"
                      onClick={() => setActiveItem(item)}
                      onChange={handleFileUpload}
                    />
                    <label
                      htmlFor={`file-${item.id}`}
                      className="btn btn-outline-success btn-sm"
                    >
                      Upload Excel
                    </label>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="ms-auto"
                    onClick={() => handleDeleteSubEvent(item.id)}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
                <Table hover responsive className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>URN</th>
                      <th>Branch</th>
                      <th>Phone</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.participants?.map((p, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="fw-bold">{p.name}</td>
                        <td>{p.urn}</td>
                        <td>{p.branch}</td>
                        <td>{p.phone}</td>
                        <td>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                              setActiveItem(item);
                              setEditingIndex(idx);
                              setPartForm(p);
                              setShowPartModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => handleDeleteParticipant(idx, item)}
                          >
                            Del
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
        {renderModals()}
      </Layout>
    );
  }

  // ==========================================
  //          VIEW: SPONSORSHIP
  // ==========================================
  if (currentView === "sponsorship") {
    return (
      <Layout>
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center mb-4 gap-3">
          <div className="d-flex align-items-center w-100 w-md-auto">
            <Button
              variant="outline-secondary"
              className="me-3 rounded-circle"
              onClick={() => setCurrentView("dashboard")}
            >
              <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
              <h3 className="fw-bold mb-0">Sponsorship Attendance</h3>
            </div>
          </div>
          <div className="d-grid gap-2 d-md-flex ms-md-auto w-100 w-md-auto">
            <Button
              variant="outline-primary"
              onClick={() => setShowPdfOptions(true)}
            >
              PDF Options
            </Button>
            <Button variant="outline-primary" onClick={generateSponsorshipPDF}>
              Download Report
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingSponId(null);
                setSponForm({
                  name: "",
                  crn: "",
                  urn: "",
                  phone: "",
                  date: "",
                  venue: "",
                  startTime: "",
                  endTime: "",
                });
                setShowSponModal(true);
              }}
            >
              Add Record
            </Button>
            <div className="d-inline-block">
              <input
                type="file"
                id="spon-file"
                hidden
                accept=".xlsx, .xls"
                onChange={handleSponFileUpload}
              />
              <label
                htmlFor="spon-file"
                className="btn btn-success text-white w-100 mb-0"
              >
                Upload Excel
              </label>
            </div>
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <Table hover responsive className="mb-0">
            <thead className="table-dark">
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Time</th>
                <th>Name</th>
                <th>CRN</th>
                <th>URN</th>
                <th>Venue</th>
                <th>Contact</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sponsorshipList.map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td>{formatDate(s.date)}</td>
                  <td>
                    {s.startTime} - {s.endTime}
                  </td>
                  <td className="fw-bold">{s.name}</td>
                  <td>{s.crn}</td>
                  <td>{s.urn}</td>
                  <td>{s.venue}</td>
                  <td>{s.phone}</td>
                  <td>
                    <Button
                      variant="link"
                      className="p-0 me-2"
                      onClick={() => handleEditSponsorship(s)}
                    >
                      <i className="bi bi-pencil-square text-primary"></i>
                    </Button>
                    <Button
                      variant="link"
                      className="p-0 text-danger"
                      onClick={() => handleDeleteSponsorship(s.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {renderModals()}
      </Layout>
    );
  }

  // ==========================================
  //          VIEW: MEETINGS (ATTENDANCE)
  // ==========================================
  if (currentView === "attendance_sessions") {
    return (
      <Layout>
        <div className="d-flex align-items-center mb-4">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={() => setCurrentView("dashboard")}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">Attendance Meetings</h3>
            <span className="text-muted small">
              Select a meeting to view or edit
            </span>
          </div>
          <div className="ms-auto">
            <Button
              variant="primary"
              onClick={() => {
                setEditingSessionId(null);
                setSessionForm({ date: "", time: "", venue: "", agenda: "" });
                setShowSessionModal(true);
              }}
            >
              Create Meeting
            </Button>
          </div>
        </div>
        <Row className="g-3">
          {sessions.map((session, idx) => (
            <Col md={4} key={session.id}>
              <Card
                className="border-0 shadow-sm cursor-pointer card-hover"
                onClick={() => handleOpenSession(session)}
              >
                <Card.Body className="p-4 position-relative">
                  <div className="position-absolute top-0 end-0 p-3">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(session.id);
                        setSessionForm(session);
                        setShowSessionModal(true);
                      }}
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </div>
                  <h5 className="fw-bold mb-1">
                    Meeting {sessions.length - idx}
                  </h5>
                  <Badge bg="light" text="dark" className="border mb-2">
                    {formatDate(session.date)}
                  </Badge>
                  <div className="small text-muted">
                    {session.time ? `${session.time}` : ""} &bull;{" "}
                    {session.venue}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
        {renderModals()}
      </Layout>
    );
  }

  if (currentView === "attendance_details") {
    return (
      <Layout>
        <div className="d-flex align-items-center mb-4 gap-3">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={() => setCurrentView("attendance_sessions")}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">Meeting Details</h3>
            <span className="text-muted small">
              {formatDate(activeSession?.date)} &bull; {activeSession?.venue}
            </span>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Button variant="outline-primary" onClick={generateAttendancePDF}>
              Download PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingSessionStudentId(null);
                setAttStudentForm({ name: "", urn: "", phone: "", team: "" });
                setShowAttStudentModal(true);
              }}
            >
              Add Student
            </Button>
            <div className="d-inline-block">
              <input
                type="file"
                id="att-file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleAttendanceFileUpload}
              />
              <label
                htmlFor="att-file"
                className="btn btn-success text-white mb-0"
              >
                Upload Excel
              </label>
            </div>
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <Table hover responsive className="mb-0">
            <thead className="table-dark">
              <tr>
                <th>S.No</th>
                <th>Name</th>
                <th>URN</th>
                <th>Contact</th>
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
                  <td>{s.phone}</td>
                  <td>{s.team}</td>
                  <td>
                    <Button
                      variant="link"
                      onClick={() => handleEditSessionStudent(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="link"
                      className="text-danger"
                      onClick={() => handleDeleteSessionStudent(s.id)}
                    >
                      Del
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {renderModals()}
      </Layout>
    );
  }

  // ==========================================
  //            MODAL RENDERER
  // ==========================================
  function renderModals() {
    return (
      <>
        {/* SUB-EVENT MODAL (INTERNAL) */}
        <Modal
          show={showItemModal}
          onHide={() => setShowItemModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>New Internal Item</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Control
              placeholder="Item Name (e.g. Solo Song)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleAddItem}>
              Create
            </Button>
          </Modal.Footer>
        </Modal>

        {/* PARTICIPANT MODAL */}
        <Modal
          show={showPartModal}
          onHide={() => setShowPartModal(false)}
          centered
          size="lg"
        >
          <Modal.Body>
            <Form className="d-grid gap-3">
              <Row>
                <Col>
                  <Form.Control
                    placeholder="Name"
                    value={partForm.name}
                    onChange={(e) =>
                      setPartForm({ ...partForm, name: e.target.value })
                    }
                  />
                </Col>
                <Col>
                  <Form.Control
                    placeholder="Phone"
                    value={partForm.phone}
                    onChange={(e) =>
                      setPartForm({ ...partForm, phone: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <Row>
                <Col>
                  <Form.Control
                    placeholder="CRN"
                    value={partForm.crn}
                    onChange={(e) =>
                      setPartForm({ ...partForm, crn: e.target.value })
                    }
                  />
                </Col>
                <Col>
                  <Form.Control
                    placeholder="URN"
                    value={partForm.urn}
                    onChange={(e) =>
                      setPartForm({ ...partForm, urn: e.target.value })
                    }
                  />
                </Col>
                <Col>
                  <Form.Control
                    placeholder="Branch"
                    value={partForm.branch}
                    onChange={(e) =>
                      setPartForm({ ...partForm, branch: e.target.value })
                    }
                  />
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={handleSaveParticipant}>Save</Button>
          </Modal.Footer>
        </Modal>

        {/* SPONSORSHIP MODAL */}
        <Modal
          show={showSponModal}
          onHide={() => setShowSponModal(false)}
          centered
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {editingSponId ? "Edit" : "Add"} Sponsorship
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form className="d-grid gap-3">
              <Row>
                <Col md={6}>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={sponForm.name}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, name: e.target.value })
                    }
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={sponForm.phone}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, phone: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Label>CRN</Form.Label>
                  <Form.Control
                    value={sponForm.crn}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, crn: e.target.value })
                    }
                  />
                </Col>
                <Col md={6}>
                  <Form.Label>URN</Form.Label>
                  <Form.Control
                    value={sponForm.urn}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, urn: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <hr />
              <Row>
                <Col md={4}>
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={sponForm.date}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, date: e.target.value })
                    }
                  />
                </Col>
                <Col md={4}>
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={sponForm.startTime}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, startTime: e.target.value })
                    }
                  />
                </Col>
                <Col md={4}>
                  <Form.Label>End Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={sponForm.endTime}
                    onChange={(e) =>
                      setSponForm({ ...sponForm, endTime: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <Form.Label>Venue</Form.Label>
              <Form.Control
                value={sponForm.venue}
                placeholder="e.g. Principals Office"
                onChange={(e) =>
                  setSponForm({ ...sponForm, venue: e.target.value })
                }
              />
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleSaveSponsorship}>
              Save Record
            </Button>
          </Modal.Footer>
        </Modal>

        {/* PROOF MODAL */}
        <Modal
          show={showProofModal}
          onHide={() => setShowProofModal(false)}
          centered
        >
          <Modal.Body>
            <Form.Control
              placeholder="URL"
              value={eventProofUrl}
              onChange={(e) => setEventProofUrl(e.target.value)}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleSaveProof}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>

        {/* PDF OPTIONS */}
        <Modal
          show={showPdfOptions}
          onHide={() => setShowPdfOptions(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Select PDF Columns</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <div className="d-grid gap-2">
                {Object.keys(pdfFields).map((key) => (
                  <Form.Check
                    key={key}
                    type="switch"
                    id={`check-${key}`}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    checked={pdfFields[key]}
                    onChange={() =>
                      setPdfFields({ ...pdfFields, [key]: !pdfFields[key] })
                    }
                  />
                ))}
              </div>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowPdfOptions(false)}
            >
              Close
            </Button>
            <Button variant="primary" onClick={generateSponsorshipPDF}>
              Generate PDF
            </Button>
          </Modal.Footer>
        </Modal>

        {/* SESSION MODAL */}
        <Modal
          show={showSessionModal}
          onHide={() => setShowSessionModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {editingSessionId ? "Edit" : "Create"} Meeting
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form className="d-grid gap-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={sessionForm.date}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, date: e.target.value })
                }
              />
              <Row>
                <Col>
                  <Form.Label>Time</Form.Label>
                  <Form.Control
                    type="time"
                    value={sessionForm.time}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, time: e.target.value })
                    }
                  />
                </Col>
                <Col>
                  <Form.Label>Venue</Form.Label>
                  <Form.Control
                    value={sessionForm.venue}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, venue: e.target.value })
                    }
                  />
                </Col>
              </Row>
              <Form.Label>Agenda</Form.Label>
              <Form.Control
                as="textarea"
                value={sessionForm.agenda}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, agenda: e.target.value })
                }
              />
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={handleCreateSession}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>

        {/* SESSION STUDENT MODAL */}
        <Modal
          show={showAttStudentModal}
          onHide={() => setShowAttStudentModal(false)}
          centered
        >
          <Modal.Body className="d-grid gap-3">
            <Form.Control
              placeholder="Name"
              value={attStudentForm.name}
              onChange={(e) =>
                setAttStudentForm({ ...attStudentForm, name: e.target.value })
              }
            />
            <Form.Control
              placeholder="URN"
              value={attStudentForm.urn}
              onChange={(e) =>
                setAttStudentForm({ ...attStudentForm, urn: e.target.value })
              }
            />
            <Form.Control
              placeholder="Phone"
              value={attStudentForm.phone}
              onChange={(e) =>
                setAttStudentForm({ ...attStudentForm, phone: e.target.value })
              }
            />
            <Form.Control
              placeholder="Team"
              value={attStudentForm.team}
              onChange={(e) =>
                setAttStudentForm({ ...attStudentForm, team: e.target.value })
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={handleSaveStudentToSession}>Save</Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }

  return null;
}
