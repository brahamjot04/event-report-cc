import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Accordion, Table, Badge, Modal, Form, Button, Row, Col } from "react-bootstrap";
import Layout from "../components/Layout";
import readXlsxFile from 'read-excel-file';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Placeholder Signature
const SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACYSURBVHhe7ckxAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4MulQAASUv0W4AAAAASUVORK5CYII=";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [eventData, setEventData] = useState(null);
  const [items, setItems] = useState([]);
  
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  
  const [activeItem, setActiveItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  
  const [eventProofUrl, setEventProofUrl] = useState(""); 
  const [partForm, setPartForm] = useState({ name: "", crn: "", urn: "", branch: "", phone: "", position: "" });

  const fetchData = async () => {
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
  };

  useEffect(() => { fetchData(); }, [id]);

  // Actions...
  const handleDeleteEvent = async () => {
    if (!window.confirm("CRITICAL WARNING: Delete this ENTIRE EVENT?")) return;
    try {
        for (const item of items) await deleteDoc(doc(db, "events", id, "items", item.id));
        await deleteDoc(doc(db, "events", id));
        navigate("/");
    } catch (error) { console.error(error); }
  };

  const handleDeleteSubEvent = async (e, itemId) => {
    e.stopPropagation();
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
                tableRows.push([index + 1, p.name, p.urn, p.crn, p.branch, p.phone, p.position || "-"]);
            });
            autoTable(doc, {
                head: [["S.No", "Name", "URN", "CRN", "Branch", "Phone", "Position"]],
                body: tableRows, startY: finalY, theme: 'grid'
            });
            finalY = doc.lastAutoTable.finalY + 15;
            if (finalY > doc.internal.pageSize.height - 50) { doc.addPage(); finalY = 20; }
        });

        if (finalY > doc.internal.pageSize.height - 60) { doc.addPage(); finalY = 40; } else { finalY += 20; }
        
        try { doc.addImage(SIGNATURE_BASE64, 'PNG', 40, finalY - 15, 40, 15); } catch (e) {}
        doc.line(30, finalY, 90, finalY); doc.line(pageWidth - 90, finalY, pageWidth - 30, finalY);
        doc.text("Chairman", 60, finalY + 7, { align: 'center' });
        doc.text("Cultural Coordinator", pageWidth - 60, finalY + 7, { align: 'center' });

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
    setPartForm({ name: "", crn: "", urn: "", branch: "", phone: "", position: "" });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file || !activeItem) return;
    readXlsxFile(file).then((rows) => {
      if (rows.length < 2) return alert("Empty File");
      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const getIdx = (k) => headers.findIndex(h => k.some(x => h.includes(x)));
      const idx = { name: getIdx(['name']), crn: getIdx(['crn']), urn: getIdx(['urn']), branch: getIdx(['branch']), phone: getIdx(['phone']), pos: getIdx(['position']) };
      const newPart = rows.slice(1).map(r => ({
        name: idx.name > -1 ? r[idx.name] : "", crn: idx.crn > -1 ? r[idx.crn] : "",
        urn: idx.urn > -1 ? r[idx.urn] : "", branch: idx.branch > -1 ? r[idx.branch] : "",
        phone: idx.phone > -1 ? r[idx.phone] : "", position: idx.pos > -1 ? r[idx.pos] : ""
      })).filter(p => p.name || p.urn);
      const updated = [...(activeItem.participants || []), ...newPart];
      updateDoc(doc(db, "events", id, "items", activeItem.id), { participants: updated }).then(() => { fetchData(); alert("Imported!"); });
    });
  };

  if (!eventData) return <div className="p-5 text-center">Loading...</div>;

  return (
    <Layout>
      {/* MOBILE-OPTIMIZED HEADER 
         1. Uses flex-column on mobile to stack Title and Buttons vertically.
         2. Uses d-grid + gridTemplateColumns on mobile to make buttons 2x2.
      */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center mb-4 gap-3">
        
        {/* Title Section (Full width on mobile) */}
        <div className="d-flex align-items-center w-100 w-md-auto">
            <Button variant="outline-secondary" className="me-3 rounded-circle" onClick={() => navigate(-1)}>
                <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
                <h3 className="fw-bold mb-0 text-break">{eventData.title}</h3>
                <span className="text-muted small">
                    <i className="bi bi-geo-alt"></i> {eventData.venue} &bull; {eventData.date}
                </span>
            </div>
        </div>

        {/* Action Buttons 
           - Mobile: d-grid with 2 columns (1fr 1fr) -> 2 buttons per row
           - Desktop: d-md-flex (single row)
        */}
        <div 
          className="d-grid gap-2 d-md-flex ms-md-auto w-100 w-md-auto" 
          style={{ gridTemplateColumns: '1fr 1fr' }} // <--- Creates the 2x2 grid on mobile
        >
            <Button variant="outline-success" onClick={() => setShowProofModal(true)} className="text-nowrap">
                <i className={`bi ${eventProofUrl ? 'bi-check-circle-fill' : 'bi-link-45deg'} me-2`}></i>
                {eventProofUrl ? "Linked" : "Link Proof"}
            </Button>
            <Button variant="outline-primary" onClick={generatePDF}>
                <i className="bi bi-file-earmark-pdf me-2"></i> Report
            </Button>
            <Button variant="primary" onClick={() => setShowItemModal(true)} className="text-nowrap">
                <i className="bi bi-plus-circle me-2"></i> Add Sub-Event
            </Button>
            <Button variant="danger" onClick={handleDeleteEvent} title="Delete Event">
                <i className="bi bi-trash"></i>
            </Button>
        </div>
      </div>

      <Accordion defaultActiveKey="0">
        {items.map((item, index) => (
          <Accordion.Item eventKey={index.toString()} key={item.id} className="mb-3 border-0 shadow-sm rounded overflow-hidden">
            <Accordion.Header>
              <div className="d-flex w-100 justify-content-between pe-4">
                <span className="fw-bold">{item.name}</span>
                <div className="d-flex align-items-center gap-2">
                    <Badge bg="secondary">{item.participants?.length || 0} Participants</Badge>
                    <Button variant="link" size="sm" className="text-danger p-0 ms-2" onClick={(e) => handleDeleteSubEvent(e, item.id)}><i className="bi bi-x-circle-fill"></i></Button>
                </div>
              </div>
            </Accordion.Header>
            <Accordion.Body className="p-0">
              <div className="p-3 bg-body-tertiary border-bottom d-flex gap-2">
                <Button variant="outline-primary" size="sm" onClick={() => { setActiveItem(item); setEditingIndex(null); setPartForm({name:"",crn:"",urn:"",branch:"",phone:"",position:""}); setShowPartModal(true); }}>
                  <i className="bi bi-person-plus me-2"></i> Add Student
                </Button>
                <div className="d-inline-block">
                    <input type="file" id={`file-${item.id}`} hidden accept=".xlsx, .xls" onChange={handleFileUpload} onClick={() => setActiveItem(item)} />
                    <label htmlFor={`file-${item.id}`} className="btn btn-outline-success btn-sm"><i className="bi bi-file-earmark-spreadsheet me-2"></i> Upload Excel</label>
                </div>
              </div>
              <Table hover responsive className="mb-0">
                <thead><tr><th>S.No</th><th>CRN</th><th>URN</th><th>Name</th><th>Branch</th><th>Phone</th><th>Position</th><th>Action</th></tr></thead>
                <tbody>
                  {item.participants?.map((p, idx) => (
                    <tr key={idx}>
                      <td className="text-muted small">{idx + 1}</td><td>{p.crn}</td><td>{p.urn}</td><td className="fw-bold">{p.name}</td><td>{p.branch}</td><td>{p.phone}</td>
                      <td>{p.position ? <Badge bg="success">{p.position}</Badge> : '-'}</td>
                      <td>
                          <Button variant="link" size="sm" className="p-0 me-2" onClick={() => { setActiveItem(item); setEditingIndex(idx); setPartForm(p); setShowPartModal(true); }}><i className="bi bi-pencil-square text-primary"></i></Button>
                          <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => handleDeleteParticipant(idx, item)}><i className="bi bi-trash"></i></Button>
                      </td>
                    </tr>
                  ))}
                  {(!item.participants || item.participants.length === 0) && <tr><td colSpan="8" className="text-center text-muted p-4">No participants added.</td></tr>}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

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
            <Form.Control placeholder="Position (Optional)" value={partForm.position} onChange={e => setPartForm({...partForm, position: e.target.value})} />
          </Form>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowPartModal(false)}>Cancel</Button><Button variant="primary" onClick={handleSaveParticipant}>Save Record</Button></Modal.Footer>
      </Modal>
    </Layout>
  );
}