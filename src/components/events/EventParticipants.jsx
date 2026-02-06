import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  Accordion,
  Table,
  Badge,
  Modal,
  Form,
  Button,
  Row,
  Col,
  InputGroup,
  ListGroup,
} from "react-bootstrap";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function EventParticipants({
  eventId,
  initialEventData,
  goBack,
}) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(
    initialEventData?.categories || [],
  );
  const [eventProofUrl, setEventProofUrl] = useState(
    initialEventData?.proofUrl || "",
  );

  // Modals State
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);

  // Forms State
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [activeItem, setActiveItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  // UPDATED: Replaced 'category' with 'position'
  const [partForm, setPartForm] = useState({
    name: "",
    crn: "",
    urn: "",
    branch: "",
    phone: "",
    position: "",
  });

  useEffect(() => {
    fetchItems();
  }, [eventId]);

  const fetchItems = async () => {
    const snap = await getDocs(collection(db, "events", eventId, "items"));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const handleAddCategory = async () => {
    if (!newCategoryInput) return;
    await updateDoc(doc(db, "events", eventId), {
      categories: arrayUnion(newCategoryInput),
    });
    setCategories([...categories, newCategoryInput]);
    setNewCategoryInput("");
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Delete ${cat}?`)) return;
    await updateDoc(doc(db, "events", eventId), {
      categories: arrayRemove(cat),
    });
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleAddItem = async () => {
    if (!newItemName) return;
    await addDoc(collection(db, "events", eventId, "items"), {
      name: newItemName,
      category: newItemCategory,
      participants: [],
    });
    fetchItems();
    setShowItemModal(false);
    setNewItemName("");
    setNewItemCategory("");
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm("Delete Sub-Event?")) {
      await deleteDoc(doc(db, "events", eventId, "items", itemId));
      fetchItems();
    }
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let u = [...(activeItem.participants || [])];
    if (editingIndex !== null) u[editingIndex] = partForm;
    else u.push(partForm);

    await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
      participants: u,
    });
    fetchItems();
    setShowPartModal(false);
  };

  const handleDeleteParticipant = async (idx, item) => {
    if (!window.confirm("Remove Student?")) return;
    const p = item.participants.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "events", eventId, "items", item.id), {
      participants: p,
    });
    fetchItems();
  };

  const formatDate = (date) => {
    if (!date) return "";
    let dateObj;
    if (typeof date === "string") {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return "";
    }
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleFileUpload = (e) => {
    const f = e.target.files[0];
    if (!f || !activeItem) return;
    readXlsxFile(f).then((r) => {
      const headers = r[0].map((h) => String(h).toLowerCase());
      const getIdx = (k) =>
        headers.findIndex((h) => k.some((x) => h.includes(x)));
      const idx = {
        name: getIdx(["name"]),
        crn: getIdx(["crn"]),
        urn: getIdx(["urn"]),
        branch: getIdx(["branch"]),
        phone: getIdx(["phone"]),
        // UPDATED: Look for position columns
        pos: getIdx(["position", "role", "designation"]),
      };
      const n = r
        .slice(1)
        .map((row) => ({
          name: idx.name > -1 ? row[idx.name] : "",
          crn: idx.crn > -1 ? row[idx.crn] : "",
          urn: idx.urn > -1 ? row[idx.urn] : "",
          branch: idx.branch > -1 ? row[idx.branch] : "",
          phone: idx.phone > -1 ? row[idx.phone] : "",
          // UPDATED: Map to position
          position: idx.pos > -1 ? row[idx.pos] : "",
        }))
        .filter((x) => x.name);

      const u = [...(activeItem.participants || []), ...n];
      updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
        participants: u,
      });
      fetchItems();
      alert("Imported!");
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // --- 1. HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      "Guru Nanak Dev Engineering College, Gill Park, Ludhiana",
      centerX,
      15,
      { align: "center" },
    );

    doc.setFontSize(12);
    doc.text("Cultural Committee", centerX, 22, { align: "center" });

    doc.text(
      `Event Report - ${initialEventData.title} (${formatDate(initialEventData.date)} to ${formatDate(initialEventData.endDate)})`,
      centerX,
      29,
      { align: "center" },
    );

    doc.text(`Venue - ${initialEventData.venue}`, centerX, 36, {
      align: "center",
    });

    // --- 2. PROOF LINK ---
    let startY = 45;
    if (eventProofUrl) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink(`Event Proof Link: ${eventProofUrl}`, 14, startY, {
        url: eventProofUrl,
      });
      doc.setTextColor(0, 0, 0);
      startY += 8;
    }

    // --- 3. TABLES ---
    let finalY = startY;

    items.forEach((item) => {
      if (finalY > 180) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${item.name} (${item.category || "General"})`, 14, finalY);
      finalY += 3;

      const rows = item.participants?.map((p, i) => [
        i + 1,
        p.name,
        p.urn,
        p.crn,
        p.branch,
        p.position || "-", // UPDATED: PDF now shows Position
      ]);

      autoTable(doc, {
        head: [["S.No", "Name", "URN", "CRN", "Branch", "Position"]],
        body: rows,
        startY: finalY,
        theme: "grid",
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        styles: { fontSize: 10, cellPadding: 2 },
      });

      finalY = doc.lastAutoTable.finalY + 10;
    });

    // UPDATED: Removed Signature Block
    doc.save(`${initialEventData.title}_Report.pdf`);
  };

  const handleSaveProof = async () => {
    await updateDoc(doc(db, "events", eventId), { proofUrl: eventProofUrl });
    setShowProofModal(false);
  };

  return (
    <>
      {/* HEADER */}
      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between mb-4 gap-3">
        <div className="d-flex align-items-center">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <h3 className="fw-bold mb-0">Participant Details</h3>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-success"
            onClick={() => setShowProofModal(true)}
          >
            <i className="bi bi-link-45deg me-1"></i>{" "}
            {eventProofUrl ? "Proof Linked" : "Link Proof"}
          </Button>
          <Button variant="outline-primary" onClick={generatePDF}>
            <i className="bi bi-file-earmark-pdf me-1"></i> Report
          </Button>
          <Button
            variant="info"
            className="text-white"
            onClick={() => setShowCategoryModal(true)}
          >
            <i className="bi bi-tags me-1"></i> Categories
          </Button>
          <Button variant="primary" onClick={() => setShowItemModal(true)}>
            <i className="bi bi-plus-lg me-1"></i> Sub-Event
          </Button>
        </div>
      </div>

      {/* LIST */}
      <Accordion defaultActiveKey="0">
        {items.map((item, index) => (
          <Accordion.Item
            eventKey={index.toString()}
            key={item.id}
            className="mb-3 border-0 shadow-sm overflow-hidden"
          >
            <Accordion.Header>
              <span className="fw-bold me-2">{item.name}</span>
              {item.category && (
                <Badge bg="info" className="me-2 text-dark">
                  {item.category}
                </Badge>
              )}
              <Badge bg="secondary">{item.participants?.length || 0}</Badge>
            </Accordion.Header>

            <Accordion.Body className="p-0">
              <div className="p-3 d-flex gap-2 align-items-center border-bottom bg-body-tertiary">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setActiveItem(item);
                    setEditingIndex(null);
                    setPartForm({});
                    setShowPartModal(true);
                  }}
                >
                  Add Student
                </Button>

                <div className="d-inline-block">
                  <input
                    type="file"
                    id={`f-${item.id}`}
                    hidden
                    accept=".xlsx,.xls"
                    onClick={() => setActiveItem(item)}
                    onChange={handleFileUpload}
                  />
                  <label
                    htmlFor={`f-${item.id}`}
                    className="btn btn-outline-primary btn-sm mb-0"
                  >
                    Upload Excel
                  </label>
                </div>

                <Button
                  size="sm"
                  variant="outline-danger"
                  className="ms-auto"
                  onClick={() => handleDeleteItem(item.id)}
                >
                  <i className="bi bi-trash"></i>
                </Button>
              </div>

              <Table hover responsive className="mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>URN</th>
                    <th>Branch</th>
                    <th>Phone</th>
                    <th>Position</th> {/* UPDATED LABEL */}
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
                      <td>{p.position || "-"}</td> {/* UPDATED DATA */}
                      <td>
                        <div className="d-flex gap-2">
                          {/* UPDATED: Pencil Icon for Edit */}
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="border-0"
                            onClick={() => {
                              setActiveItem(item);
                              setEditingIndex(idx);
                              setPartForm(p);
                              setShowPartModal(true);
                            }}
                          >
                            <i className="bi bi-pencil-fill text-primary"></i>
                          </Button>

                          {/* UPDATED: Trash Icon for Delete */}
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="border-0"
                            onClick={() => handleDeleteParticipant(idx, item)}
                          >
                            <i className="bi bi-trash-fill text-danger"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* --- MODALS --- */}
      <Modal
        show={showCategoryModal}
        onHide={() => setShowCategoryModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Manage Categories</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ListGroup className="mb-3">
            {categories.map((cat, idx) => (
              <ListGroup.Item
                key={idx}
                className="d-flex justify-content-between"
              >
                {cat}{" "}
                <i
                  className="bi bi-trash text-danger cursor-pointer"
                  onClick={() => handleDeleteCategory(cat)}
                ></i>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <InputGroup>
            <Form.Control
              placeholder="New Category"
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
            />
            <Button onClick={handleAddCategory}>Add</Button>
          </InputGroup>
        </Modal.Body>
      </Modal>

      <Modal
        show={showItemModal}
        onHide={() => setShowItemModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>New Sub-Event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
            >
              <option value="">Select...</option>
              {categories.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleAddItem}>Create</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showPartModal}
        onHide={() => setShowPartModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Student Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-3">
            <Row>
              <Col>
                <Form.Control
                  placeholder="Name"
                  value={partForm.name || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, name: e.target.value })
                  }
                />
              </Col>
              <Col>
                <Form.Control
                  placeholder="Phone"
                  value={partForm.phone || ""}
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
                  value={partForm.crn || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, crn: e.target.value })
                  }
                />
              </Col>
              <Col>
                <Form.Control
                  placeholder="URN"
                  value={partForm.urn || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, urn: e.target.value })
                  }
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Control
                  placeholder="Branch"
                  value={partForm.branch || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, branch: e.target.value })
                  }
                />
              </Col>

              {/* UPDATED: Replaced Category Select with Optional Position Input */}
              <Col>
                <Form.Control
                  placeholder="Position (Optional)"
                  value={partForm.position || ""}
                  onChange={(e) =>
                    setPartForm({ ...partForm, position: e.target.value })
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

      <Modal
        show={showProofModal}
        onHide={() => setShowProofModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Link Event Proof</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Proof URL (Drive/Photos Link)</Form.Label>
            <Form.Control
              placeholder="https://..."
              value={eventProofUrl}
              onChange={(e) => setEventProofUrl(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProofModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveProof}>
            Save Link
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
