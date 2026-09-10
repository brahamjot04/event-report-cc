import { useState, useEffect, useCallback } from "react";
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
  Button,
  Modal,
  Form,
  Row,
  Col,
  FloatingLabel,
  Table,
  Badge,
  OverlayTrigger,
  Tooltip,
  Accordion,
} from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import readXlsxFile from "read-excel-file";
import { useToast } from "../../context/ToastContext";

export default function EventSponsorship({
  eventId,
  eventData,
  eventTitle,
  goBack,
}) {
  const { showSuccess, showError, showWarning, confirm } = useToast();
  const [sponsors, setSponsors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);

  // Default PDF Columns
  const [pdfFields, setPdfFields] = useState({
    name: true,
    crn: true,
    urn: true,
    date: true,
    venue: true,
    time: true,
    phone: true,
  });

  const fetchSponsors = useCallback(async () => {
    const q = query(
      collection(db, "events", eventId, "sponsorship_records"),
      orderBy("date", "asc"),
      orderBy("startTime", "asc"),
    );
    const snap = await getDocs(q);
    setSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [eventId]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

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
    const ok = await confirm({
      title: "Delete Record",
      message: "Are you sure you want to delete this sponsorship record?",
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) {
      await deleteDoc(doc(db, "events", eventId, "sponsorship_records", id));
      showSuccess("Record deleted.");
      fetchSponsors();
    }
  };

  const handleEditClick = (s) => {
    setEditingId(s.id);
    setForm(s);
    setShowModal(true);
  };

  // --- EXCEL UPLOAD LOGIC ---
  const handleSponFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readXlsxFile(file).then(async (rows) => {
      if (rows.length < 2) {
        showWarning("File empty");
        return;
      }

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

      showSuccess(`Imported ${newRecs.length} records!`);
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

      const grouped = sponsors.reduce((acc, item) => {
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

      doc.save(`Sponsorship_Report.pdf`);
    } catch (err) {
      console.error(err);
      showError("Error generating PDF. Please try again.");
    }
  };

  const getInitials = (name) =>
    name ? name.substring(0, 2).toUpperCase() : "SP";

  return (
    <>
      {/* HEADER */}
      <div className="d-flex align-items-center mb-4 justify-content-between">
        <div className="d-flex align-items-center">
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
            <h3 className="fw-bold mb-0">Sponsorship</h3>
            <p className="text-muted small mb-0">
              Manage attendance and records
            </p>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button
            onClick={() => {
              setEditingId(null);
              setForm({});
              setShowModal(true);
            }}
            size="sm"
            className="d-flex align-items-center"
          >
            <i className="bi bi-plus-lg me-2"></i> Add Record
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
              className="btn btn-success text-white mb-0 btn-sm d-flex align-items-center h-100"
            >
              <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>{" "}
              Import Excel
            </label>
          </div>

          <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip>Download PDF Report</Tooltip>}
          >
            <Button
              variant="outline-danger"
              onClick={generateSponsorshipPDF}
              size="sm"
              className="d-flex align-items-center"
            >
              <i className="bi bi-file-earmark-pdf-fill"></i>
            </Button>
          </OverlayTrigger>
        </div>
      </div>

      {/* PDF OPTIONS ACCORDION */}
      <div className="mb-4">
        <Accordion defaultActiveKey={null}>
          <Accordion.Item eventKey="0">
            <Accordion.Header className="py-2">
              <i className="bi bi-sliders me-2"></i> PDF Export Options
            </Accordion.Header>
            <Accordion.Body className="p-3">
              <Form>
                <div className="row">
                  {Object.keys(pdfFields).map((key) => (
                    <div key={key} className="col-6 mb-2">
                      <Form.Check
                        type="switch"
                        id={`check-${key}`}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        checked={pdfFields[key]}
                        onChange={() =>
                          setPdfFields({ ...pdfFields, [key]: !pdfFields[key] })
                        }
                      />
                    </div>
                  ))}
                </div>
              </Form>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>

      {/* MODERN TABLE LAYOUT */}
      {/* Add the fit-content style here */}
      <div
        className="soft-card p-0 overflow-hidden shadow-sm"
        style={{ height: "fit-content" }}
      >
        <Table hover responsive className="mb-0 align-middle">
          <thead style={{ backgroundColor: "var(--soft-hover)" }}>
            <tr>
              <th
                className="ps-4 py-3 text-secondary text-uppercase small"
                style={{ width: "25%" }}
              >
                Sponsor Name
              </th>
              <th className="text-secondary text-uppercase small">
                ID (CRN/URN)
              </th>
              <th className="text-secondary text-uppercase small">Contact</th>
              <th className="text-secondary text-uppercase small">
                Date & Time
              </th>
              <th className="text-secondary text-uppercase small">Venue</th>
              <th className="text-end pe-4 text-secondary text-uppercase small">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sponsors.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="text-center py-4 text-muted border-0"
                >
                  <i className="bi bi-inbox display-4 opacity-25 d-block mb-3"></i>
                  No sponsorship records found.
                </td>
              </tr>
            ) : (
              sponsors.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div
                        className="avatar-circle me-3 flex-shrink-0"
                        style={{
                          width: "35px",
                          height: "35px",
                          fontSize: "0.9rem",
                          backgroundColor: "var(--bg-main)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        {getInitials(s.name)}
                      </div>
                      <span className="fw-bold text-body">{s.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-column small">
                      {s.crn && (
                        <span className="text-muted">
                          CRN: <span className="text-primary">{s.crn}</span>
                        </span>
                      )}
                      {s.urn && (
                        <span className="text-muted">URN: {s.urn}</span>
                      )}
                      {!s.crn && !s.urn && (
                        <span className="text-muted">-</span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted small">{s.phone || "-"}</td>
                  <td>
                    <div className="d-flex flex-column small">
                      <span className="fw-bold text-body">
                        {formatDate(s.date) || "-"}
                      </span>
                      <span className="text-muted">
                        {s.startTime
                          ? `${s.startTime} - ${s.endTime}`
                          : "All Day"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge bg="light" text="dark" className="border fw-normal">
                      {s.venue || "N/A"}
                    </Badge>
                  </td>
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-primary p-1"
                        onClick={() => handleEditClick(s)}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        className="border-0 bg-transparent text-danger p-1"
                        onClick={() => handleDelete(s.id)}
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

      {/* ADD/EDIT MODAL */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <div className="soft-card border-0 p-0 overflow-hidden">
          <Modal.Header
            closeButton
            className="border-bottom"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Modal.Title className="fw-bold h5">
              {editingId ? "Edit" : "Add"} Sponsor Record
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Form className="d-grid gap-3">
              <FloatingLabel controlId="floatingName" label="Name">
                <Form.Control
                  placeholder="Name"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-control"
                />
              </FloatingLabel>
              <FloatingLabel controlId="floatingPhone" label="Phone">
                <Form.Control
                  placeholder="Phone"
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="form-control"
                />
              </FloatingLabel>
              <Row>
                <Col>
                  <FloatingLabel controlId="floatingCRN" label="CRN">
                    <Form.Control
                      placeholder="CRN"
                      value={form.crn || ""}
                      onChange={(e) =>
                        setForm({ ...form, crn: e.target.value })
                      }
                      className="form-control"
                    />
                  </FloatingLabel>
                </Col>
                <Col>
                  <FloatingLabel controlId="floatingURN" label="URN">
                    <Form.Control
                      placeholder="URN"
                      value={form.urn || ""}
                      onChange={(e) =>
                        setForm({ ...form, urn: e.target.value })
                      }
                      className="form-control"
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
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                      className="form-control"
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
                      className="form-control"
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
                      className="form-control"
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
                      className="form-control"
                    />
                  </FloatingLabel>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0">
            <Button onClick={handleSave} variant="primary" className="w-100">
              Save Record
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}
