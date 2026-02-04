import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { Accordion, Table, Badge, Modal, Form, Button, Row, Col, Card } from "react-bootstrap";
import Layout from "../components/Layout";
import readXlsxFile from 'read-excel-file';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- VIEW STATE ---
  const [currentView, setCurrentView] = useState('dashboard');

  // --- DATA STATE ---
  const [eventData, setEventData] = useState(null);
  const [items, setItems] = useState([]); 
  
  const [sessions, setSessions] = useState([]); 
  const [activeSession, setActiveSession] = useState(null); 
  const [sessionStudents, setSessionStudents] = useState([]); 

  // --- MODALS ---
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false); 
  const [showProofModal, setShowProofModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false); 
  const [showAttStudentModal, setShowAttStudentModal] = useState(false); 

  // --- FORMS ---
  const [newItemName, setNewItemName] = useState("");
  const [eventProofUrl, setEventProofUrl] = useState(""); 
  
  const [activeItem, setActiveItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [partForm, setPartForm] = useState({ name: "", crn: "", urn: "", branch: "", phone: "", year: "", position: "" });

  // ATTENDANCE EDIT STATE
  // UPDATED: Session Form includes Venue, Time, Agenda
  const [sessionForm, setSessionForm] = useState({ date: "", time: "", venue: "", agenda: "" });
  const [editingSessionId, setEditingSessionId] = useState(null);

  const [attStudentForm, setAttStudentForm] = useState({ name: "", urn: "", phone: "", team: "" });
  const [editingSessionStudentId, setEditingSessionStudentId] = useState(null); 

  // --- FETCHING ---
  const fetchData = async () => {
    try {
        const eventSnap = await getDoc(doc(db, "events", id));
        if (eventSnap.exists()) {
            const data = eventSnap.data();
            setEventData(data);
            setEventProofUrl(data.proofUrl || "");
        } else {
            alert("Event not found!");
            navigate("/");
        }
        const itemsSnap = await getDocs(collection(db, "events", id, "items"));
        setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Error fetching data:", e); }
  };

  const fetchSessions = async () => {
    const q = query(collection(db, "events", id, "attendance_sessions"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchSessionStudents = async (sessionId) => {
      const snap = await getDocs(collection(db, "events", id, "attendance_sessions", sessionId, "students"));
      setSessionStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchData(); }, [id]);

  // --- MEETING SESSION FUNCTIONS ---

  // 1. OPEN CREATE MODAL
  const openCreateSessionModal = () => {
      setSessionForm({ date: "", time: "", venue: "", agenda: "" });
      setEditingSessionId(null);
      setShowSessionModal(true);
  };

  // 2. OPEN EDIT MODAL
  const openEditSessionModal = (e, session) => {
      e.stopPropagation(); // Stop opening the meeting details
      setSessionForm({ 
          date: session.date, 
          time: session.time || "", 
          venue: session.venue || "", 
          agenda: session.agenda || "" 
      });
      setEditingSessionId(session.id);
      setShowSessionModal(true);
  };

  // 3. SAVE SESSION (CREATE OR UPDATE)
  const handleSaveSession = async () => {
      if(!sessionForm.date) return alert("Please select a date");
      
      try {
          if (editingSessionId) {
              // Update
              await updateDoc(doc(db, "events", id, "attendance_sessions", editingSessionId), {
                  ...sessionForm
              });
          } else {
              // Create
              await addDoc(collection(db, "events", id, "attendance_sessions"), {
                  ...sessionForm,
                  createdAt: new Date()
              });
          }
          setShowSessionModal(false);
          fetchSessions();
      } catch(err) {
          console.error(err);
          alert("Error saving meeting.");
      }
  };

  const handleDeleteSession = async (e, sessionId) => {
      e.stopPropagation();
      if(!window.confirm("Delete meeting record?")) return;
      await deleteDoc(doc(db, "events", id, "attendance_sessions", sessionId));
      fetchSessions();
  };

  const handleOpenSession = (session) => {
      setActiveSession(session);
      fetchSessionStudents(session.id);
      setCurrentView('attendance_details');
  };

  // --- ATTENDANCE STUDENT FUNCTIONS ---
  const handleSaveStudentToSession = async () => {
      if(!activeSession) return;
      
      if (editingSessionStudentId) {
          await updateDoc(doc(db, "events", id, "attendance_sessions", activeSession.id, "students", editingSessionStudentId), attStudentForm);
      } else {
          await addDoc(collection(db, "events", id, "attendance_sessions", activeSession.id, "students"), attStudentForm);
      }
      
      setAttStudentForm({ name: "", urn: "", phone: "", team: "" });
      setEditingSessionStudentId(null);
      setShowAttStudentModal(false);
      fetchSessionStudents(activeSession.id);
  };

  const handleEditSessionStudent = (student) => {
      setAttStudentForm({ name: student.name, urn: student.urn, phone: student.phone, team: student.team });
      setEditingSessionStudentId(student.id);
      setShowAttStudentModal(true);
  };

  const handleDeleteSessionStudent = async (studentId) => {
      if(!window.confirm("Remove this student?")) return;
      await deleteDoc(doc(db, "events", id, "attendance_sessions", activeSession.id, "students", studentId));
      fetchSessionStudents(activeSession.id);
  };

  // GENERATE PDF (Updated with Venue/Time)
  const generateAttendancePDF = () => {
      if (!activeSession) return;
      try {
        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(16);
        doc.text("Cultural Committee - Attendance Report", 14, 15);
        
        doc.setFont("helvetica", "normal"); doc.setFontSize(11);
        doc.text(`Event: ${eventData.title}`, 14, 25);
        doc.text(`Date: ${activeSession.date}  |  Time: ${activeSession.time || "-"}`, 14, 32);
        doc.text(`Venue: ${activeSession.venue || "Not Specified"}`, 14, 39);
        doc.text(`Agenda: ${activeSession.agenda || "-"}`, 14, 46);
        
        const tableRows = sessionStudents.map((s, i) => [
            i + 1, s.name, s.urn, s.phone, s.team || "-"
        ]);

        autoTable(doc, {
            head: [["S.No", "Name", "URN", "Contact", "Team/Category"]],
            body: tableRows,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] }
        });
        
        doc.save(`${eventData.title}_Attendance_${activeSession.date}.pdf`);

      } catch (err) {
          console.error(err);
          alert("Failed to generate PDF");
      }
  };

  // --- UPLOAD LOGIC ---
  const handleAttendanceFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!activeSession) { alert("Error: No active meeting session found. Please reload."); return; }

      readXlsxFile(file).then(async (rows) => {
        if (rows.length < 2) return alert("File empty or missing headers.");
        
        const headers = rows[0].map(h => String(h).toLowerCase().trim());
        const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
        
        const idx = {
            name: getIdx(['name', 'student']),
            urn: getIdx(['urn', 'roll']),
            phone: getIdx(['phone', 'contact', 'mobile']),
            team: getIdx(['team', 'category', 'item'])
        };

        if(idx.name === -1 && idx.urn === -1) {
            alert("Error: Could not find 'Name' or 'URN' columns in Excel.");
            return;
        }

        const newStudents = rows.slice(1).map(row => ({
            name: idx.name > -1 ? row[idx.name] : "",
            urn: idx.urn > -1 ? row[idx.urn] : "",
            phone: idx.phone > -1 ? row[idx.phone] : "",
            team: idx.team > -1 ? row[idx.team] : ""
        })).filter(p => p.name || p.urn);

        if(newStudents.length === 0) return alert("No valid student records found.");

        const promises = newStudents.map(s => 
            addDoc(collection(db, "events", id, "attendance_sessions", activeSession.id, "students"), s)
        );

        await Promise.all(promises);
        alert(`Imported ${newStudents.length} students!`);
        fetchSessionStudents(activeSession.id);
        e.target.value = ""; 
      }).catch(err => {
          console.error(err);
          alert("Error reading Excel file.");
          e.target.value = "";
      });
  };

  // --- PARTICIPANTS LOGIC ---
  const handleDeleteEvent = async () => {
    if (!window.confirm("CRITICAL WARNING: Delete ENTIRE EVENT?")) return;
    try {
        for (const item of items) await deleteDoc(doc(db, "events", id, "items", item.id));
        await deleteDoc(doc(db, "events", id));
        navigate("/");
    } catch (error) { console.error(error); }
  };

  const handleDeleteSubEvent = async (itemId) => {
    if (!window.confirm("Delete this sub-event?")) return;
    await deleteDoc(doc(db, "events", id, "items", itemId));
    fetchData(); 
  };

  const handleDeleteParticipant = async (participantIndex, item) => {
    if (!window.confirm("Remove this student?")) return;
    const updatedParticipants = item.participants.filter((_, idx) => idx !== participantIndex);
    await updateDoc(doc(db, "events", id, "items", item.id), { participants: updatedParticipants });
    setItems(items.map(i => i.id === item.id ? { ...i, participants: updatedParticipants } : i));
  };

  const handleSaveProof = async () => {
    await updateDoc(doc(db, "events", id), { proofUrl: eventProofUrl });
    setShowProofModal(false); fetchData();
  };

  // GENERATE MAIN EVENT REPORT (No Signature)
  const generatePDF = () => {
    try {
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageWidth = doc.internal.pageSize.width;
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(18);
        doc.text("Guru Nanak Dev Engineering College, Gill Park Ludhiana", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(14); doc.text("Cultural Committee", pageWidth / 2, 23, { align: 'center' });
        doc.setLineWidth(0.5); doc.line(10, 27, pageWidth - 10, 27);

        doc.setFont("helvetica", "normal"); doc.setFontSize(12);
        doc.text(`Event Report: ${eventData.title}`, 14, 35);
        doc.text(`Date: ${eventData.date}   |   Venue: ${eventData.venue}`, 14, 42);

        if (eventProofUrl) {
            doc.setTextColor(0, 0, 255);
            doc.textWithLink("Click here to view Event Proof", 14, 49, { url: eventProofUrl });
            doc.setTextColor(0, 0, 0);
        } else { doc.text("(No Proof Attached)", 14, 49); }

        let finalY = 58;
        items.forEach((item) => {
            doc.setFont("helvetica", "bold"); doc.setFillColor(240, 240, 240);
            doc.rect(14, finalY, pageWidth - 28, 8, 'F');
            doc.text(item.name.toUpperCase(), 16, finalY + 5.5);
            finalY += 10;
            const tableRows = [];
            item.participants?.forEach((p, index) => {
                tableRows.push([index + 1, p.name, p.urn, p.crn, p.branch, p.year || "-", p.position || "-"]);
            });
            autoTable(doc, {
                head: [["S.No", "Name", "URN", "CRN", "Branch", "Year", "Position"]],
                body: tableRows, startY: finalY, theme: 'grid'
            });
            finalY = doc.lastAutoTable.finalY + 15;
            if (finalY > doc.internal.pageSize.height - 50) { doc.addPage(); finalY = 20; }
        });
        
        doc.save(`${eventData.title}_Report.pdf`);
    } catch (error) { alert("PDF Error"); }
  };

  const handleAddItem = async () => {
    if (!newItemName) return;
    await addDoc(collection(db, "events", id, "items"), { name: newItemName, participants: [] });
    fetchData(); setShowItemModal(false); setNewItemName("");
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let updated = [...(activeItem.participants || [])];
    if (editingIndex !== null) updated[editingIndex] = partForm; else updated.push(partForm);
    await updateDoc(doc(db, "events", id, "items", activeItem.id), { participants: updated });
    setItems(items.map(i => i.id === activeItem.id ? { ...i, participants: updated } : i));
    setShowPartModal(false); setEditingIndex(null);
    setPartForm({ name: "", crn: "", urn: "", branch: "", phone: "", year: "", position: "" });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeItem) return;

    readXlsxFile(file).then((rows) => {
      if (rows.length < 2) return alert("Empty File");
      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const getIdx = (k) => headers.findIndex(h => k.some(x => h.includes(x)));
      const idx = { 
          name: getIdx(['name']), crn: getIdx(['crn']), urn: getIdx(['urn']), 
          branch: getIdx(['branch']), phone: getIdx(['phone']), pos: getIdx(['position']),
          year: getIdx(['year', 'yr', 'semester'])
      };

      if(idx.name === -1 && idx.urn === -1) {
        alert("Error: Could not find 'Name' or 'URN' columns.");
        e.target.value = "";
        return;
      }

      const newPart = rows.slice(1).map(r => ({
        name: idx.name > -1 ? r[idx.name] : "", crn: idx.crn > -1 ? r[idx.crn] : "",
        urn: idx.urn > -1 ? r[idx.urn] : "", branch: idx.branch > -1 ? r[idx.branch] : "",
        phone: idx.phone > -1 ? r[idx.phone] : "", year: idx.year > -1 ? r[idx.year] : "",
        position: idx.pos > -1 ? r[idx.pos] : ""
      })).filter(p => p.name || p.urn);
      
      const updated = [...(activeItem.participants || []), ...newPart];
      updateDoc(doc(db, "events", id, "items", activeItem.id), { participants: updated })
        .then(() => { fetchData(); alert("Imported!"); e.target.value = ""; });
    });
  };

  if (!eventData) return <div className="p-5 text-center">Loading...</div>;

  // --- VIEWS ---

  if (currentView === 'dashboard') {
      return (
        <Layout>
            <div className="d-flex align-items-center mb-4">
                <Button variant="outline-secondary" className="me-3 rounded-circle" onClick={() => navigate(-1)}><i className="bi bi-arrow-left"></i></Button>
                <div>
                  <h3 className="fw-bold mb-0">{eventData.title}</h3>
                  <span className="text-muted small"><i className="bi bi-geo-alt"></i> {eventData.venue} &bull; {eventData.date}</span>
                </div>
            </div>
            <Row className="g-4">
                <Col md={6} lg={4}>
                    <Card className="h-100 border-0 shadow-sm cursor-pointer card-hover" onClick={() => setCurrentView('participants')}>
                        <Card.Body className="d-flex flex-column align-items-center justify-content-center p-5 text-center">
                            <div className="mb-4 text-primary"><i className="bi bi-people-fill" style={{ fontSize: '3.5rem' }}></i></div>
                            <h4 className="fw-bold text-body">Participant Details</h4>
                            <p className="text-muted small">Manage sub-events, add students, and generate reports.</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6} lg={4}>
                    <Card className="h-100 border-0 shadow-sm cursor-pointer card-hover" onClick={() => { fetchSessions(); setCurrentView('attendance_sessions'); }}>
                        <Card.Body className="d-flex flex-column align-items-center justify-content-center p-5 text-center">
                            <div className="mb-4 text-success"><i className="bi bi-calendar-check-fill" style={{ fontSize: '3.5rem' }}></i></div>
                            <h4 className="fw-bold text-body">Attendance Record</h4>
                            <p className="text-muted small">Manage pre-event meetings and track attendance.</p>
                        </Card.Body>
                    </Card>
                </Col>
                 <Col md={12} className="mt-5 text-center"><Button variant="link" className="text-danger text-decoration-none" onClick={handleDeleteEvent}><i className="bi bi-trash me-2"></i> Delete This Event</Button></Col>
            </Row>
        </Layout>
      );
  }

  if (currentView === 'participants') {
      return (
        <Layout>
            <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center mb-4 gap-3">
                <div className="d-flex align-items-center w-100 w-md-auto">
                    <Button variant="outline-secondary" className="me-3 rounded-circle" onClick={() => setCurrentView('dashboard')}><i className="bi bi-arrow-left"></i></Button>
                    <div><h3 className="fw-bold mb-0">Participant Details</h3><span className="text-muted small">{eventData.title}</span></div>
                </div>
                <div className="d-grid gap-2 d-md-flex ms-md-auto w-100 w-md-auto" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <Button variant="outline-success" onClick={() => setShowProofModal(true)} className="text-nowrap"><i className={`bi ${eventProofUrl ? 'bi-check-circle-fill' : 'bi-link-45deg'} me-2`}></i>{eventProofUrl ? "Linked" : "Link Proof"}</Button>
                    <Button variant="outline-primary" onClick={generatePDF}><i className="bi bi-file-earmark-pdf me-2"></i> Report</Button>
                    <Button variant="primary" onClick={() => setShowItemModal(true)} className="text-nowrap"><i className="bi bi-plus-circle me-2"></i> Add Sub-Event</Button>
                </div>
            </div>
            <Accordion defaultActiveKey="0">
                {items.map((item, index) => (
                <Accordion.Item eventKey={index.toString()} key={item.id} className="mb-3 border-0 shadow-sm rounded overflow-hidden">
                    <Accordion.Header>
                        <div className="d-flex w-100 justify-content-between pe-4">
                            <span className="fw-bold">{item.name}</span>
                            <Badge bg="secondary">{item.participants?.length || 0} Participants</Badge>
                        </div>
                    </Accordion.Header>
                    <Accordion.Body className="p-0">
                    <div className="p-3 bg-body-tertiary border-bottom d-flex gap-2 align-items-center">
                        <Button variant="outline-primary" size="sm" onClick={() => { setActiveItem(item); setEditingIndex(null); setPartForm({name:"",crn:"",urn:"",branch:"",phone:"",year:"",position:""}); setShowPartModal(true); }}>
                            <i className="bi bi-person-plus me-2"></i> Add Student
                        </Button>
                        <div className="d-inline-block">
                            <input type="file" id={`file-${item.id}`} hidden accept=".xlsx, .xls" onClick={() => setActiveItem(item)} onChange={handleFileUpload} />
                            <label htmlFor={`file-${item.id}`} className="btn btn-outline-success btn-sm mb-0"><i className="bi bi-file-earmark-spreadsheet me-2"></i> Upload Excel</label>
                        </div>
                        <Button variant="outline-danger" size="sm" className="ms-auto" onClick={() => handleDeleteSubEvent(item.id)} title="Delete Sub-Event"><i className="bi bi-trash"></i></Button>
                    </div>
                    <Table hover responsive className="mb-0">
                        <thead className="bg-body-tertiary"><tr><th>S.No</th><th>CRN</th><th>URN</th><th>Name</th><th>Branch</th><th>Year</th><th>Phone</th><th>Position</th><th>Action</th></tr></thead>
                        <tbody>
                        {item.participants?.map((p, idx) => (
                            <tr key={idx}>
                            <td className="text-muted small">{idx + 1}</td>
                            <td>{p.crn}</td><td>{p.urn}</td><td className="fw-bold">{p.name}</td><td>{p.branch}</td><td>{p.year || '-'}</td><td>{p.phone}</td>
                            <td>{p.position ? <Badge bg="success">{p.position}</Badge> : '-'}</td>
                            <td>
                                <Button variant="link" size="sm" className="p-0 me-2" onClick={() => { setActiveItem(item); setEditingIndex(idx); setPartForm(p); setShowPartModal(true); }}><i className="bi bi-pencil-square text-primary"></i></Button>
                                <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => handleDeleteParticipant(idx, item)}><i className="bi bi-trash"></i></Button>
                            </td>
                            </tr>
                        ))}
                        {(!item.participants || item.participants.length === 0) && <tr><td colSpan="9" className="text-center text-muted p-4">No participants added.</td></tr>}
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

  if (currentView === 'attendance_sessions') {
      return (
          <Layout>
            <div className="d-flex align-items-center mb-4">
                <Button variant="outline-secondary" className="me-3 rounded-circle" onClick={() => setCurrentView('dashboard')}><i className="bi bi-arrow-left"></i></Button>
                <div><h3 className="fw-bold mb-0">Attendance Meetings</h3><span className="text-muted small">Select a meeting to view or edit</span></div>
                <div className="ms-auto"><Button variant="primary" onClick={openCreateSessionModal}><i className="bi bi-plus-lg me-2"></i> Create Meeting</Button></div>
            </div>
            <Row className="g-3">
                {sessions.map((session, idx) => (
                    <Col md={6} lg={4} key={session.id}>
                        <Card className="border-0 shadow-sm cursor-pointer card-hover" onClick={() => handleOpenSession(session)}>
                            <Card.Body className="p-4 position-relative">
                                {/* Action Buttons */}
                                <div className="position-absolute top-0 end-0 p-3 d-flex gap-2">
                                     <Button variant="link" size="sm" className="p-0 text-primary" onClick={(e) => openEditSessionModal(e, session)} title="Edit Details">
                                        <i className="bi bi-pencil-square"></i>
                                     </Button>
                                     <Button variant="link" size="sm" className="p-0 text-danger" onClick={(e) => handleDeleteSession(e, session.id)} title="Delete Meeting">
                                        <i className="bi bi-trash"></i>
                                     </Button>
                                </div>

                                <div className="mb-3">
                                    <h5 className="fw-bold mb-1">Meeting {sessions.length - idx}</h5>
                                    <Badge bg="light" text="dark" className="border">{session.date}</Badge>
                                </div>
                                
                                <div className="text-muted small d-grid gap-1">
                                    <div><i className="bi bi-clock me-2"></i>{session.time ? `${session.time} Onwards` : "Time not set"}</div>
                                    <div><i className="bi bi-geo-alt me-2"></i>{session.venue || "Venue not set"}</div>
                                    {session.agenda && <div className="text-truncate" title={session.agenda}><i className="bi bi-list-task me-2"></i>{session.agenda}</div>}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
                {sessions.length === 0 && <Col md={12} className="text-center p-5 text-muted">No meetings created yet. Click "Create Meeting" to start.</Col>}
            </Row>
            {renderModals()}
          </Layout>
      );
  }

  if (currentView === 'attendance_details') {
      return (
          <Layout>
             <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center mb-4 gap-3">
                <div className="d-flex align-items-center w-100 w-md-auto">
                    <Button variant="outline-secondary" className="me-3 rounded-circle" onClick={() => setCurrentView('attendance_sessions')}><i className="bi bi-arrow-left"></i></Button>
                    <div>
                        <h3 className="fw-bold mb-0">Meeting Details</h3>
                        <span className="text-muted small">{activeSession?.date} &bull; {activeSession?.venue} &bull; {activeSession?.time}</span>
                    </div>
                </div>
                <div className="d-grid gap-2 d-md-flex ms-md-auto w-100 w-md-auto">
                    <Button variant="outline-primary" onClick={generateAttendancePDF}><i className="bi bi-file-earmark-pdf me-2"></i> Download PDF</Button>
                    <Button variant="primary" onClick={() => { setEditingSessionStudentId(null); setAttStudentForm({name:"",urn:"",phone:"",team:""}); setShowAttStudentModal(true); }}><i className="bi bi-person-plus me-2"></i> Add Student</Button>
                    <div className="d-inline-block">
                        <input type="file" id="att-file" hidden accept=".xlsx, .xls" onChange={handleAttendanceFileUpload} />
                        <label htmlFor="att-file" className="btn btn-success text-white w-100 mb-0"><i className="bi bi-file-earmark-spreadsheet me-2"></i> Upload Excel</label>
                    </div>
                </div>
             </div>
             <Card className="border-0 shadow-sm">
                <Table hover responsive className="mb-0">
                    <thead className="bg-body-tertiary"><tr><th>S.No</th><th>Name</th><th>URN</th><th>Contact Number</th><th>Team Name (Category)</th><th>Action</th></tr></thead>
                    <tbody>
                        {sessionStudents.map((student, idx) => (
                            <tr key={student.id}>
                                <td>{idx + 1}</td><td className="fw-bold">{student.name}</td><td>{student.urn}</td><td>{student.phone}</td>
                                <td>{student.team ? <Badge bg="info" className="text-dark bg-opacity-25">{student.team}</Badge> : '-'}</td>
                                <td>
                                    <Button variant="link" className="p-0 me-3" onClick={() => handleEditSessionStudent(student)}><i className="bi bi-pencil-square text-primary"></i></Button>
                                    <Button variant="link" className="text-danger p-0" onClick={() => handleDeleteSessionStudent(student.id)}><i className="bi bi-trash"></i></Button>
                                </td>
                            </tr>
                        ))}
                        {sessionStudents.length === 0 && <tr><td colSpan="6" className="text-center p-5 text-muted">No attendance data for this meeting.</td></tr>}
                    </tbody>
                </Table>
             </Card>
             {renderModals()}
          </Layout>
      );
  }

  function renderModals() {
      return (
        <>
            <Modal show={showItemModal} onHide={() => setShowItemModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>New Sub-Event</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control placeholder="e.g. Solo Song" value={newItemName} onChange={e => setNewItemName(e.target.value)} autoFocus /></Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleAddItem}>Create</Button></Modal.Footer>
            </Modal>
            <Modal show={showProofModal} onHide={() => setShowProofModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Event Proof Link</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control placeholder="https://..." value={eventProofUrl} onChange={e => setEventProofUrl(e.target.value)} /></Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleSaveProof}>Save Link</Button></Modal.Footer>
            </Modal>
            <Modal show={showPartModal} onHide={() => setShowPartModal(false)} centered size="lg">
                <Modal.Header closeButton><Modal.Title>{editingIndex !== null ? "Edit" : "Add"} Participant</Modal.Title></Modal.Header>
                <Modal.Body>
                <Form className="d-grid gap-3">
                    <Row><Col md={6}><Form.Control placeholder="Name" value={partForm.name} onChange={e => setPartForm({...partForm, name: e.target.value})} /></Col><Col md={6}><Form.Control placeholder="Phone" value={partForm.phone} onChange={e => setPartForm({...partForm, phone: e.target.value})} /></Col></Row>
                    <Row><Col md={4}><Form.Control placeholder="CRN" value={partForm.crn} onChange={e => setPartForm({...partForm, crn: e.target.value})} /></Col><Col md={4}><Form.Control placeholder="URN" value={partForm.urn} onChange={e => setPartForm({...partForm, urn: e.target.value})} /></Col><Col md={4}><Form.Control placeholder="Branch" value={partForm.branch} onChange={e => setPartForm({...partForm, branch: e.target.value})} /></Col></Row>
                    <Row><Col md={6}><Form.Control placeholder="Year (e.g. D3)" value={partForm.year} onChange={e => setPartForm({...partForm, year: e.target.value})} /></Col><Col md={6}><Form.Control placeholder="Position" value={partForm.position} onChange={e => setPartForm({...partForm, position: e.target.value})} /></Col></Row>
                </Form>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={() => setShowPartModal(false)}>Cancel</Button><Button variant="primary" onClick={handleSaveParticipant}>Save Record</Button></Modal.Footer>
            </Modal>
            
            {/* UPDATED SESSION MODAL */}
            <Modal show={showSessionModal} onHide={() => setShowSessionModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>{editingSessionId ? "Edit" : "Create"} Meeting</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form className="d-grid gap-3">
                        <Form.Group>
                            <Form.Label>Date</Form.Label>
                            <Form.Control type="date" value={sessionForm.date} onChange={e => setSessionForm({...sessionForm, date: e.target.value})} />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Start Time</Form.Label>
                                    <Form.Control type="time" value={sessionForm.time} onChange={e => setSessionForm({...sessionForm, time: e.target.value})} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Venue</Form.Label>
                                    <Form.Control type="text" placeholder="e.g. OAT" value={sessionForm.venue} onChange={e => setSessionForm({...sessionForm, venue: e.target.value})} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group>
                            <Form.Label>Agenda</Form.Label>
                            <Form.Control as="textarea" rows={2} placeholder="Brief description of the meeting..." value={sessionForm.agenda} onChange={e => setSessionForm({...sessionForm, agenda: e.target.value})} />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleSaveSession}>{editingSessionId ? "Update" : "Create"}</Button></Modal.Footer>
            </Modal>
            
            <Modal show={showAttStudentModal} onHide={() => setShowAttStudentModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>{editingSessionStudentId ? "Edit" : "Add"} Student to Attendance</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form className="d-grid gap-3">
                        <Form.Control placeholder="Full Name" value={attStudentForm.name} onChange={e => setAttStudentForm({...attStudentForm, name: e.target.value})} />
                        <Form.Control placeholder="URN" value={attStudentForm.urn} onChange={e => setAttStudentForm({...attStudentForm, urn: e.target.value})} />
                        <Form.Control placeholder="Contact Number" value={attStudentForm.phone} onChange={e => setAttStudentForm({...attStudentForm, phone: e.target.value})} />
                        <Form.Control placeholder="Team Name / Category" value={attStudentForm.team} onChange={e => setAttStudentForm({...attStudentForm, team: e.target.value})} />
                    </Form>
                </Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleSaveStudentToSession}>{editingSessionStudentId ? "Update" : "Add"} Student</Button></Modal.Footer>
            </Modal>
        </>
      );
  }
  
  return null;
}