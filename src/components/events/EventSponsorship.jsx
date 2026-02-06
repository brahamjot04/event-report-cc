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
  FloatingLabel, // Added FloatingLabel import
} from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import readXlsxFile from "read-excel-file";

export default function EventSponsorship({
  eventId,
  eventData,
  eventTitle,
  goBack,
}) {
  const [sponsors, setSponsors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);

  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);

  // Default PDF Columns
  const [pdfFields, setPdfFields] = useState({
    name: true,
    crn: true,
    urn: true,
    date: false,
    venue: true,
    time: true,
    phone: false,
  });

  useEffect(() => {
    fetchSponsors();
  }, [eventId]);

  const fetchSponsors = async () => {
    const q = query(
      collection(db, "events", eventId, "sponsorship_records"),
      orderBy("date", "asc"),
      orderBy("startTime", "asc"),
    );
    const snap = await getDocs(q);
    setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleSave = async () => {
    if (!form.name) return;
    if (editingId) {
      await updateDoc(
        doc(db, "events", eventId, "sponsorship_records", editingId),
        form,
      );
    } else {
      await addDoc(
        collection(db, "events", eventId, "sponsorship_records"),
        form,
      );
    }
    setShowModal(false);
    fetchSponsors();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete?")) {
      await deleteDoc(doc(db, "events", eventId, "sponsorship_records", id));
      fetchSponsors();
    }
  };

  // --- EXCEL UPLOAD LOGIC ---
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
          addDoc(collection(db, "events", eventId, "sponsorship_records"), r),
        ),
      );

      alert(`Imported ${newRecs.length} records!`);
      fetchSponsors();
      e.target.value = "";
    });
  };

  // --- PDF GENERATION LOGIC ---
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
  };

  const generateSponsorshipPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Sponsorship Attendance Report", 14, 15);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");

      const finalTitle = eventTitle || eventData?.title || "Event Details";
      doc.text(`Event: ${finalTitle}`, 14, 23);

      // Group by Date
      const grouped = sponsors.reduce((acc, item) => {
        const d = item.date;
        if (!acc[d]) acc[d] = [];
        acc[d].push(item);
        return acc;
      }, {});

      const sortedDates = Object.keys(grouped).sort();
      let finalY = 30;

      // Define Columns based on user selection
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

      // Footer Signatures
      if (finalY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        finalY = 40;
      }
      doc.setLineWidth(0.5);
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

      doc.save(`Sponsorship_Report.pdf`);
      setShowPdfOptions(false);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF");
    }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-4 justify-content-between">
        <div className="d-flex align-items-center">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <h3 className="fw-bold mb-0">Sponsorship</h3>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            onClick={() => setShowPdfOptions(true)}
          >
            <i className="bi bi-gear-fill me-2"></i>PDF Options
          </Button>

          <Button variant="outline-danger" onClick={generateSponsorshipPDF}>
            <i className="bi bi-file-earmark-pdf-fill me-2"></i>Download Report
          </Button>

          <Button
            onClick={() => {
              setEditingId(null);
              setForm({});
              setShowModal(true);
            }}
          >
            <i className="bi bi-plus-lg me-2"></i>Add Record
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
              <th>Name</th>
              <th>Phone</th>
              {/* UPDATED: Added CRN, URN, and Time columns */}
              <th>CRN</th>
              <th>URN</th>
              <th>Date</th>
              <th>Time</th>
              <th>Venue</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.phone}</td>
                {/* UPDATED: Displaying CRN, URN, and Time */}
                <td>{s.crn}</td>
                <td>{s.urn}</td>
                <td>{formatDate(s.date)}</td>
                <td>
                  {s.startTime && s.endTime
                    ? `${s.startTime} - ${s.endTime}`
                    : "-"}
                </td>
                <td>{s.venue}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="border-0"
                      onClick={() => {
                        setEditingId(s.id);
                        setForm(s);
                        setShowModal(true);
                      }}
                    >
                      <i className="bi bi-pencil-fill text-primary"></i>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="border-0"
                      onClick={() => handleDelete(s.id)}
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

      {/* ADD/EDIT MODAL WITH FLOATING HEADINGS */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Edit" : "Add"} Sponsor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-3">
            {" "}
            {/* Added gap for spacing */}
            <FloatingLabel controlId="floatingName" label="Name">
              <Form.Control
                placeholder="Name"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FloatingLabel>
            <FloatingLabel controlId="floatingPhone" label="Phone">
              <Form.Control
                placeholder="Phone"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FloatingLabel>
            <Row>
              <Col>
                <FloatingLabel controlId="floatingCRN" label="CRN">
                  <Form.Control
                    placeholder="CRN"
                    value={form.crn || ""}
                    onChange={(e) => setForm({ ...form, crn: e.target.value })}
                  />
                </FloatingLabel>
              </Col>
              <Col>
                <FloatingLabel controlId="floatingURN" label="URN">
                  <Form.Control
                    placeholder="URN"
                    value={form.urn || ""}
                    onChange={(e) => setForm({ ...form, urn: e.target.value })}
                  />
                </FloatingLabel>
              </Col>
            </Row>
            <Row>
              <Col>
                <FloatingLabel controlId="floatingDate" label="Date">
                  <Form.Control
                    type="date"
                    value={form.date || ""}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </FloatingLabel>
              </Col>
              <Col>
                <FloatingLabel controlId="floatingVenue" label="Venue">
                  <Form.Control
                    placeholder="Venue"
                    value={form.venue || ""}
                    onChange={(e) =>
                      setForm({ ...form, venue: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
            </Row>
            <Row>
              <Col>
                <FloatingLabel controlId="floatingStart" label="Start Time">
                  <Form.Control
                    type="time"
                    value={form.startTime || ""}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
              <Col>
                <FloatingLabel controlId="floatingEnd" label="End Time">
                  <Form.Control
                    type="time"
                    value={form.endTime || ""}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSave}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* PDF OPTIONS MODAL */}
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
          <Button variant="secondary" onClick={() => setShowPdfOptions(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={generateSponsorshipPDF}>
            Generate PDF
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
