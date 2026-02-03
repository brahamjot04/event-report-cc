import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Accordion, Table, Badge, Modal, Form, Button, Row, Col } from "react-bootstrap";
import Layout from "../components/Layout";
import readXlsxFile from 'read-excel-file';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- PLACEHOLDER SIGNATURE ---
const SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACYSURBVHhe7ckxAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4MulQAASUv0W4AAAAASUVORK5CYII=";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [eventData, setEventData] = useState(null);
  const [items, setItems] = useState([]);
  
  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false); // NEW MODAL
  
  const [activeItem, setActiveItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  
  // Event Proof Link State
  const [eventProofUrl, setEventProofUrl] = useState(""); 

  const [partForm, setPartForm] = useState({ 
    name: "", crn: "", urn: "", branch: "", phone: "", position: ""
  });

  // Fetch Data
  const fetchData = async () => {
    const eventSnap = await getDoc(doc(db, "events", id));
    if (eventSnap.exists()) {
        const data = eventSnap.data();
        setEventData(data);
        setEventProofUrl(data.proofUrl || ""); // Load existing proof
    }

    const itemsSnap = await getDocs(collection(db, "events", id, "items"));
    setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchData(); }, [id]);

  // --- SAVE COMMON PROOF ---
  const handleSaveProof = async () => {
    await updateDoc(doc(db, "events", id), { proofUrl: eventProofUrl });
    setShowProofModal(false);
    fetchData(); // Refresh
  };

  // --- PDF GENERATOR ---
  const generatePDF = () => {
    try {
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // 1. HEADER
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Guru Nanak Dev Engineering College, Gill Park Ludhiana", pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text("Cultural Committee", pageWidth / 2, 23, { align: 'center' });
        
        doc.setLineWidth(0.5);
        doc.line(10, 27, pageWidth - 10, 27);

        // Event Info
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text(`Event Report: ${eventData.title}`, 14, 35);
        doc.text(`Date: ${eventData.date}   |   Venue: ${eventData.venue}`, 14, 42);

        // --- COMMON PROOF LINK IN PDF ---
        if (eventProofUrl) {
            doc.setTextColor(0, 0, 255);
            doc.textWithLink("Click here to view Event Proof", 14, 49, { url: eventProofUrl });
            doc.setTextColor(0, 0, 0); // Reset color
        } else {
            doc.setFontSize(10);
            doc.text("(No Proof Attached)", 14, 49);
        }

        let finalY = 58;

        // 2. TABLES
        items.forEach((item) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setFillColor(240, 240, 240);
            doc.rect(14, finalY, pageWidth - 28, 8, 'F');
            doc.text(item.name.toUpperCase(), 16, finalY + 5.5);
            
            finalY += 10;

            const tableColumn = ["S.No", "Name", "URN", "CRN", "Branch", "Phone", "Position"];
            const tableRows = [];

            if (item.participants && item.participants.length > 0) {
                const sorted = [...item.participants].sort((a, b) => {
                     if (a.position && !b.position) return -1;
                     if (!a.position && b.position) return 1;
                     return 0;
                });

                sorted.forEach((p, index) => {
                    tableRows.push([
                        index + 1,
                        p.name, p.urn, p.crn, p.branch, p.phone, p.position || "-"
                    ]);
                });

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: finalY,
                    theme: 'grid',
                    headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], lineWidth: 0.1, lineColor: [0,0,0] },
                    bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0] },
                    styles: { fontSize: 10, cellPadding: 3, valign: 'middle', halign: 'center' },
                    columnStyles: { 1: { halign: 'left' } }
                });

                finalY = doc.lastAutoTable.finalY + 15;
            } else {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(10);
                doc.text("(No participants recorded)", 14, finalY);
                finalY += 15;
            }

            if (finalY > pageHeight - 50) { doc.addPage(); finalY = 20; }
        });

        // 3. SIGNATURES
        if (finalY > pageHeight - 60) { doc.addPage(); finalY = 40; } else { finalY += 20; }
        
        const leftSigX = 30;
        const rightSigX = pageWidth - 80;
        const lineLen = 60;

        try {
            doc.addImage(SIGNATURE_BASE64, 'PNG', leftSigX + 10, finalY - 15, 40, 15);
        } catch (imgErr) { console.error("Signature Image Error:", imgErr); }

        doc.setLineWidth(0.5);
        doc.line(leftSigX, finalY, leftSigX + lineLen, finalY); 
        doc.line(rightSigX, finalY, rightSigX + lineLen, finalY); 

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Chairman", leftSigX + (lineLen/2), finalY + 7, { align: 'center' });
        doc.text("Cultural Coordinator", rightSigX + (lineLen/2), finalY + 7, { align: 'center' });

        doc.save(`${eventData.title}_Report.pdf`);
    
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("Failed to generate PDF. Check console.");
    }
  };

  // --- HELPER FUNCTIONS ---
  const handleAddItem = async () => {
    if (!newItemName) return;
    await addDoc(collection(db, "events", id, "items"), { name: newItemName, participants: [] });
    fetchData(); setShowItemModal(false); setNewItemName("");
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let updatedParticipants = [...(activeItem.participants || [])];
    if (editingIndex !== null) { updatedParticipants[editingIndex] = partForm; } 
    else { updatedParticipants.push(partForm); }

    await updateDoc(doc(db, "events", id, "items", activeItem.id), { participants: updatedParticipants });
    
    const updatedItems = items.map(i => i.id === activeItem.id ? { ...i, participants: updatedParticipants } : i);
    setItems(updatedItems);
    setShowPartModal(false); setEditingIndex(null);
    setPartForm({ name: "", crn: "", urn: "", branch: "", phone: "", position: "" });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeItem) return;
    readXlsxFile(file).then((rows) => {
      if (rows.length < 2) return alert("File appears to be empty.");
      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
      const idx = {
        name: getIdx(['name']), crn: getIdx(['crn']), urn: getIdx(['urn']), 
        branch: getIdx(['branch']), phone: getIdx(['phone']), pos: getIdx(['position'])
      };

      const newParticipants = rows.slice(1).map(row => ({
        name: idx.name > -1 ? row[idx.name] : "",
        crn: idx.crn > -1 ? row[idx.crn] : "",
        urn: idx.urn > -1 ? row[idx.urn] : "",
        branch: idx.branch > -1 ? row[idx.branch] : "",
        phone: idx.phone > -1 ? row[idx.phone] : "",
        position: idx.pos > -1 ? row[idx.pos] : ""
      })).filter(p => p.name || p.urn);

      const updatedParticipants = [...(activeItem.participants || []), ...newParticipants];
      updateDoc(doc(db, "events", id, "items", activeItem.id), { participants: updatedParticipants })
        .then(() => { fetchData(); alert(`Imported ${newParticipants.length} students!`); });
    });
  };

  const openEditModal = (p, idx, item) => { setActiveItem(item); setEditingIndex(idx); setPartForm(p); setShowPartModal(true); };
  const openAddModal = (item) => { setActiveItem(item); setEditingIndex(null); setPartForm({ name: "", crn: "", urn: "", branch: "", phone: "", position: "" }); setShowPartModal(true); };

  if (!eventData) return <div className="p-5 text-center">Loading...</div>;

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <Button variant="light" className="me-3 rounded-circle shadow-sm" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left"></i>
        </Button>
        <div>
          <h3 className="fw-bold mb-0">{eventData.title}</h3>
          <span className="text-muted small"><i className="bi bi-geo-alt"></i> {eventData.venue} &bull; {eventData.date}</span>
        </div>
        
        <div className="ms-auto d-flex gap-2">
            {/* COMMON PROOF BUTTON */}
            <Button variant="outline-success" onClick={() => setShowProofModal(true)}>
                <i className={`bi ${eventProofUrl ? 'bi-check-circle-fill' : 'bi-link-45deg'} me-2`}></i> 
                {eventProofUrl ? "Proof Linked" : "Link Proof"}
            </Button>

            <Button variant="outline-danger" onClick={generatePDF}>
                <i className="bi bi-file-earmark-pdf me-2"></i> Report
            </Button>
            <Button variant="primary" onClick={() => setShowItemModal(true)}>
                <i className="bi bi-plus-circle me-2"></i> Add Sub-Event
            </Button>
        </div>
      </div>

      <Accordion defaultActiveKey="0">
        {items.map((item, index) => (
          <Accordion.Item eventKey={index.toString()} key={item.id} className="mb-3 border-0 shadow-sm rounded overflow-hidden">
            <Accordion.Header>
              <div className="d-flex w-100 justify-content-between pe-4">
                <span className="fw-bold">{item.name}</span>
                <Badge bg="light" text="dark">{item.participants?.length || 0} Participants</Badge>
              </div>
            </Accordion.Header>
            <Accordion.Body className="p-0">
              <div className="p-3 bg-light border-bottom d-flex gap-2">
                <Button variant="outline-primary" size="sm" onClick={() => openAddModal(item)}>
                  <i className="bi bi-person-plus me-2"></i> Add Student
                </Button>
                <div className="d-inline-block">
                    <input type="file" id={`file-${item.id}`} hidden accept=".xlsx, .xls" onChange={handleFileUpload} onClick={() => setActiveItem(item)} />
                    <label htmlFor={`file-${item.id}`} className="btn btn-outline-success btn-sm">
                        <i className="bi bi-file-earmark-spreadsheet me-2"></i> Upload Excel
                    </label>
                </div>
              </div>
              <Table hover responsive className="mb-0">
                <thead className="bg-white">
                  <tr>
                    <th>S.No</th><th>CRN</th><th>URN</th><th>Name</th><th>Branch</th><th>Phone</th><th>Position</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {item.participants?.map((p, idx) => (
                    <tr key={idx}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>{p.crn}</td><td>{p.urn}</td><td className="fw-bold">{p.name}</td><td>{p.branch}</td><td>{p.phone}</td>
                      <td>{p.position ? <Badge bg="success">{p.position}</Badge> : '-'}</td>
                      <td><Button variant="link" size="sm" className="p-0" onClick={() => openEditModal(p, idx, item)}><i className="bi bi-pencil-square text-primary"></i></Button></td>
                    </tr>
                  ))}
                  {(!item.participants || item.participants.length === 0) && <tr><td colSpan="8" className="text-center text-muted p-4">No participants added.</td></tr>}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* --- MODALS --- */}
      
      {/* 1. Sub Event */}
      <Modal show={showItemModal} onHide={() => setShowItemModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>New Sub-Event</Modal.Title></Modal.Header>
        <Modal.Body><Form.Control placeholder="e.g. Solo Song" value={newItemName} onChange={e => setNewItemName(e.target.value)} autoFocus /></Modal.Body>
        <Modal.Footer><Button variant="primary" onClick={handleAddItem}>Create</Button></Modal.Footer>
      </Modal>

      {/* 2. Common Proof Link */}
      <Modal show={showProofModal} onHide={() => setShowProofModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Event Proof Link</Modal.Title></Modal.Header>
        <Modal.Body>
            <p className="text-muted small">Paste a Google Drive or SharePoint link containing all proofs for this event.</p>
            <Form.Control 
                placeholder="https://drive.google.com/..." 
                value={eventProofUrl} 
                onChange={e => setEventProofUrl(e.target.value)} 
                autoFocus 
            />
        </Modal.Body>
        <Modal.Footer>
            <Button variant="primary" onClick={handleSaveProof}>Save Link</Button>
        </Modal.Footer>
      </Modal>

      {/* 3. Participant */}
      <Modal show={showPartModal} onHide={() => setShowPartModal(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>{editingIndex !== null ? "Edit" : "Add"} Participant</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-3">
            <Row><Col md={6}><Form.Control placeholder="Name" value={partForm.name} onChange={e => setPartForm({...partForm, name: e.target.value})} /></Col>
            <Col md={6}><Form.Control placeholder="Phone" value={partForm.phone} onChange={e => setPartForm({...partForm, phone: e.target.value})} /></Col></Row>
            <Row><Col md={4}><Form.Control placeholder="CRN" value={partForm.crn} onChange={e => setPartForm({...partForm, crn: e.target.value})} /></Col>
            <Col md={4}><Form.Control placeholder="URN" value={partForm.urn} onChange={e => setPartForm({...partForm, urn: e.target.value})} /></Col>
            <Col md={4}><Form.Control placeholder="Branch" value={partForm.branch} onChange={e => setPartForm({...partForm, branch: e.target.value})} /></Col></Row>
            <Form.Control placeholder="Position (Optional)" value={partForm.position} onChange={e => setPartForm({...partForm, position: e.target.value})} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPartModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveParticipant}>Save Record</Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}