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
  Table,
  Badge,
  Modal,
  Form,
  Button,
  Row,
  Col,
  InputGroup,
  ListGroup,
  Dropdown,
  Card,
} from "react-bootstrap";
import { uploadToGitHub } from "../../utils/github";
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

  const [uploadingProof, setUploadingProof] = useState(false);

  // Forms State
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newItemIsGroup, setNewItemIsGroup] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  const [activeItem, setActiveItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  const [partForm, setPartForm] = useState({
    name: "",
    crn: "",
    urn: "",
    branch: "",
    phone: "",
    position: "",
    teamName: "",
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
    if (editingItemId) {
      // update existing
      await updateDoc(doc(db, "events", eventId, "items", editingItemId), {
        name: newItemName,
        category: newItemCategory,
        isGroupEvent: !!newItemIsGroup,
      });
      setEditingItemId(null);
    } else {
      await addDoc(collection(db, "events", eventId, "items"), {
        name: newItemName,
        category: newItemCategory,
        isGroupEvent: !!newItemIsGroup,
        participants: [],
      });
    }
    fetchItems();
    setShowItemModal(false);
    setNewItemName("");
    setNewItemCategory("");
    setNewItemIsGroup(false);
  };

  const handleDeleteItem = async (e, itemId) => {
    e.stopPropagation();
    if (window.confirm("Delete Sub-Event?")) {
      await deleteDoc(doc(db, "events", eventId, "items", itemId));
      fetchItems();
    }
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let u = [...(activeItem.participants || [])];
    const participantPayload = { ...partForm };
    if (editingIndex !== null) u[editingIndex] = participantPayload;
    else u.push(participantPayload);

    await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
      participants: u,
    });
    // Update local state immediately for better UX
    setActiveItem({ ...activeItem, participants: u });
    fetchItems(); // Background sync
    setShowPartModal(false);
  };

  const handleDeleteParticipant = async (idx) => {
    if (!window.confirm("Remove Student?")) return;
    const p = activeItem.participants.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
      participants: p,
    });
    setActiveItem({ ...activeItem, participants: p });
    fetchItems();
  };

  const formatDate = (date) => {
    if (!date) return "";
    let dateObj = typeof date === "string" ? new Date(date) : date;
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
        pos: getIdx(["position", "role", "designation"]),
        team: getIdx(["team", "teamname", "group", "team_name"]),
      };
      const n = r
        .slice(1)
        .map((row) => ({
          name: idx.name > -1 ? row[idx.name] : "",
          crn: idx.crn > -1 ? row[idx.crn] : "",
          urn: idx.urn > -1 ? row[idx.urn] : "",
          branch: idx.branch > -1 ? row[idx.branch] : "",
          phone: idx.phone > -1 ? row[idx.phone] : "",
          position: idx.pos > -1 ? row[idx.pos] : "",
          teamName: idx.team > -1 ? row[idx.team] : "",
        }))
        .filter((x) => x.name);

      const u = [...(activeItem.participants || []), ...n];
      updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
        participants: u,
      });
      setActiveItem({ ...activeItem, participants: u });
      fetchItems();
      alert("Imported!");
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Guru Nanak Dev Engineering College", centerX, 15, {
      align: "center",
    });
    doc.setFontSize(12);
    doc.text("Cultural Committee", centerX, 22, { align: "center" });
    doc.text(`Event Report - ${initialEventData.title}`, centerX, 29, {
      align: "center",
    });

    let startY = 40;
    if (eventProofUrl) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink(`Event Proof Link: ${eventProofUrl}`, 14, startY, {
        url: eventProofUrl,
      });
      doc.setTextColor(0, 0, 0);
      startY += 8;
    }

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
        p.position || "-",
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
    doc.save(`${initialEventData.title}_Report.pdf`);
  };

  const handleSaveProof = async () => {
    await updateDoc(doc(db, "events", eventId), { proofUrl: eventProofUrl });
    setShowProofModal(false);
  };

  // Helper for initials
  const getInitials = (name) =>
    name ? name.substring(0, 2).toUpperCase() : "SE";

  // --- RENDER: PARTICIPANT LIST VIEW (DRILL DOWN) ---
  if (activeItem) {
    const groupedParticipants = (activeItem.participants || []).reduce(
      (acc, p) => {
        const key = (p.teamName || p.team || "No Team").toString() || "No Team";
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      },
      {},
    );
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
            onClick={() => setActiveItem(null)}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">{activeItem.name}</h3>
            <span className="text-muted small">
              <Badge
                className="category-badge me-2"
                style={{
                  backgroundColor: "var(--soft-hover)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {activeItem.category || "General"}
              </Badge>
              {activeItem.participants?.length || 0} Participants
            </span>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Button
              variant="primary"
              className="d-flex align-items-center gap-2"
              onClick={() => {
                setEditingIndex(null);
                setPartForm({
                  name: "",
                  crn: "",
                  urn: "",
                  branch: "",
                  phone: "",
                  position: "",
                  teamName: "",
                });
                setShowPartModal(true);
              }}
            >
              <i className="bi bi-person-plus-fill"></i>{" "}
              <span className="d-none d-md-inline">Add Student</span>
            </Button>

            <div className="d-inline-block">
              <input
                type="file"
                id="excel-upload"
                hidden
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="excel-upload"
                className="btn btn-success text-white mb-0 d-flex align-items-center gap-2"
                style={{ height: "100%" }}
              >
                <i className="bi bi-file-earmark-spreadsheet-fill"></i>{" "}
                <span className="d-none d-md-inline">Import Excel</span>
              </label>
            </div>
          </div>
        </div>

        <div className="soft-card p-0 overflow-hidden shadow-sm">
          {activeItem.isGroupEvent ? (
            Object.keys(groupedParticipants).length === 0 ? (
              <div className="p-4 text-center text-muted">
                No participants added yet.
              </div>
            ) : (
              Object.entries(groupedParticipants).map(([team, list]) => (
                <div key={team} className="p-3">
                  <h6 className="fw-bold mb-2">{team}</h6>
                  <Table hover responsive className="mb-3 align-middle">
                    <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                      <tr>
                        <th
                          className="ps-4 py-3 text-secondary text-uppercase small"
                          style={{ width: "5%" }}
                        >
                          #
                        </th>
                        <th className="text-secondary text-uppercase small">
                          Student Name
                        </th>
                        <th className="text-secondary text-uppercase small">
                          URN
                        </th>
                        <th className="text-secondary text-uppercase small">
                          Branch
                        </th>
                        <th className="text-secondary text-uppercase small">
                          Position
                        </th>
                        <th className="text-end pe-4 text-secondary text-uppercase small">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                          }}
                        >
                          <td className="ps-4 text-muted">{idx + 1}</td>
                          <td className="fw-bold text-body">{p.name}</td>
                          <td className="text-muted">
                            <code className="text-primary">{p.urn}</code>
                          </td>
                          <td className="text-muted small">
                            {p.branch || "-"}
                          </td>
                          <td>
                            {p.position ? (
                              <Badge bg="warning" text="dark">
                                {p.position}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="text-end pe-4">
                            <div className="d-flex justify-content-end gap-2">
                              <Button
                                size="sm"
                                variant="light"
                                className="border-0 bg-transparent text-primary p-1"
                                onClick={() => {
                                  const g = activeItem.participants.findIndex(
                                    (pp) => pp === p,
                                  );
                                  setEditingIndex(g);
                                  setPartForm(p);
                                  setShowPartModal(true);
                                }}
                              >
                                <i className="bi bi-pencil-fill"></i>
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                className="border-0 bg-transparent text-danger p-1"
                                onClick={() => {
                                  const g = activeItem.participants.findIndex(
                                    (pp) => pp === p,
                                  );
                                  handleDeleteParticipant(g);
                                }}
                              >
                                <i className="bi bi-trash-fill"></i>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ))
            )
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr>
                  <th
                    className="ps-4 py-3 text-secondary text-uppercase small"
                    style={{ width: "5%" }}
                  >
                    #
                  </th>
                  <th className="text-secondary text-uppercase small">
                    Student Name
                  </th>
                  <th className="text-secondary text-uppercase small">URN</th>
                  <th className="text-secondary text-uppercase small">
                    Branch
                  </th>
                  <th className="text-secondary text-uppercase small">
                    Position
                  </th>
                  <th className="text-end pe-4 text-secondary text-uppercase small">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {!activeItem.participants ||
                activeItem.participants.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      <i className="bi bi-people display-4 opacity-25 d-block mb-3"></i>
                      No participants added yet.
                    </td>
                  </tr>
                ) : (
                  activeItem.participants.map((p, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 text-muted">{idx + 1}</td>
                      <td className="fw-bold text-body">{p.name}</td>
                      <td className="text-muted">
                        <code className="text-primary">{p.urn}</code>
                      </td>
                      <td className="text-muted small">{p.branch || "-"}</td>
                      <td>
                        {p.position ? (
                          <Badge bg="warning" text="dark">
                            {p.position}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant="light"
                            className="border-0 bg-transparent text-primary p-1"
                            onClick={() => {
                              setEditingIndex(idx);
                              setPartForm(p);
                              setShowPartModal(true);
                            }}
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            className="border-0 bg-transparent text-danger p-1"
                            onClick={() => handleDeleteParticipant(idx)}
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
          )}
        </div>

        {/* Modals are rendered below */}
        {renderModals()}
      </>
    );
  }

  // --- RENDER: SUB-EVENT GRID VIEW ---
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
          <h3 className="fw-bold mb-0">Event Participants</h3>
          <p className="text-muted small mb-0">
            Manage sub-events and student lists
          </p>
        </div>

        <div className="ms-auto d-flex gap-2">
          <Button
            variant="outline-success"
            onClick={() => setShowProofModal(true)}
            size="sm"
            className="d-flex align-items-center"
          >
            <i className="bi bi-link-45deg me-1"></i>{" "}
            {eventProofUrl ? "Proof Linked" : "Link Proof"}
          </Button>
          <Button
            variant="outline-danger"
            onClick={generatePDF}
            size="sm"
            className="d-flex align-items-center"
          >
            <i className="bi bi-file-earmark-pdf me-1"></i> Report
          </Button>
          <Button
            variant="info"
            className="text-white d-flex align-items-center"
            onClick={() => setShowCategoryModal(true)}
            size="sm"
          >
            <i className="bi bi-tags me-1"></i> Cats
          </Button>
        </div>
      </div>

      <Row className="g-4">
        {/* Add New Sub-Event Card (render first) */}
        <Col md={6} lg={4}>
          <div
            className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-4"
            style={{
              border: "2px dashed var(--border-dashed)",
              borderRadius: "16px",
              cursor: "pointer",
              minHeight: "180px",
              color: "var(--text-muted)",
              backgroundColor: "transparent",
            }}
            onClick={() => {
              setNewItemName("");
              setNewItemCategory("");
              setNewItemIsGroup(false);
              setEditingItemId(null);
              setShowItemModal(true);
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
            <h6 className="fw-bold mb-1">Create Sub-Event</h6>
            <small>Add new competition/activity</small>
          </div>
        </Col>

        {items.map((item) => (
          <Col md={6} lg={4} key={item.id}>
            <div
              className="soft-card h-100 d-flex flex-column position-relative text-start"
              style={{ cursor: "pointer", minHeight: "180px" }}
              onClick={() => setActiveItem(item)}
            >
              <div className="d-flex justify-content-between align-items-start mb-3">
                <Badge
                  className="category-badge fw-normal"
                  style={{
                    backgroundColor: "var(--soft-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {item.category || "General"}
                </Badge>

                <Dropdown onClick={(e) => e.stopPropagation()}>
                  <Dropdown.Toggle
                    variant="link"
                    className="text-muted p-0 no-caret"
                  >
                    <i className="bi bi-three-dots"></i>
                  </Dropdown.Toggle>
                  <Dropdown.Menu align="end">
                    <Dropdown.Item
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItemId(item.id);
                        setNewItemName(item.name || "");
                        setNewItemCategory(item.category || "");
                        setNewItemIsGroup(!!item.isGroupEvent);
                        setShowItemModal(true);
                      }}
                    >
                      <i className="bi bi-pencil-fill me-2"></i>Edit
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="text-danger"
                      onClick={(e) => handleDeleteItem(e, item.id)}
                    >
                      <i className="bi bi-trash me-2"></i>Delete
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>

              <div className="d-flex align-items-center mb-3">
                <div
                  className="avatar-circle me-3 flex-shrink-0"
                  style={{
                    width: "45px",
                    height: "45px",
                    fontSize: "1.2rem",
                    backgroundColor: "var(--soft-hover)",
                    color: "var(--text-primary)",
                  }}
                >
                  {getInitials(item.name)}
                </div>
                <h5 className="fw-bold mb-0 text-truncate">{item.name}</h5>
              </div>

              <div
                className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="small text-muted">
                  <i className="bi bi-people-fill me-2"></i>
                  {item.participants?.length || 0} Students
                </div>
                <Button size="sm" className="soft-open-btn rounded-pill px-3">
                  Open <i className="bi bi-arrow-right ms-1"></i>
                </Button>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {renderModals()}
    </>
  );

  function renderModals() {
    return (
      <>
        {/* CATEGORY MODAL */}
        <Modal
          show={showCategoryModal}
          onHide={() => setShowCategoryModal(false)}
          centered
        >
          <div className="soft-card border-0 p-0 overflow-hidden">
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">
                Manage Categories
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
              <ListGroup className="mb-3">
                {categories.map((cat, idx) => (
                  <ListGroup.Item
                    key={idx}
                    className="d-flex justify-content-between align-items-center bg-transparent border-bottom"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    {cat}
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
                  className="form-control"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                />
                <Button onClick={handleAddCategory} variant="primary">
                  Add
                </Button>
              </InputGroup>
            </Modal.Body>
          </div>
        </Modal>

        {/* ITEM MODAL */}
        <Modal
          show={showItemModal}
          onHide={() => setShowItemModal(false)}
          centered
        >
          <div className="soft-card border-0 p-0 overflow-hidden">
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">New Sub-Event</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted">
                  NAME
                </Form.Label>
                <Form.Control
                  className="form-control"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  id="isGroupSwitch"
                  label="Group Event (teams)"
                  checked={newItemIsGroup}
                  onChange={(e) => setNewItemIsGroup(e.target.checked)}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  CATEGORY
                </Form.Label>
                <Form.Select
                  className="form-select"
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
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItemId(null);
                  setNewItemIsGroup(false);
                }}
                className="me-2"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddItem}
                className="w-100"
              >
                {editingItemId ? "Save Changes" : "Create Sub-Event"}
              </Button>
            </Modal.Footer>
          </div>
        </Modal>

        {/* PARTICIPANT MODAL */}
        <Modal
          show={showPartModal}
          onHide={() => setShowPartModal(false)}
          centered
          size="lg"
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
                <Row>
                  <Col>
                    <Form.Control
                      placeholder="Name"
                      className="form-control"
                      value={partForm.name || ""}
                      onChange={(e) =>
                        setPartForm({ ...partForm, name: e.target.value })
                      }
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      placeholder="Phone"
                      className="form-control"
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
                      className="form-control"
                      value={partForm.crn || ""}
                      onChange={(e) =>
                        setPartForm({ ...partForm, crn: e.target.value })
                      }
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      placeholder="URN"
                      className="form-control"
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
                      className="form-control"
                      value={partForm.branch || ""}
                      onChange={(e) =>
                        setPartForm({ ...partForm, branch: e.target.value })
                      }
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      placeholder="Position (Optional)"
                      className="form-control"
                      value={partForm.position || ""}
                      onChange={(e) =>
                        setPartForm({ ...partForm, position: e.target.value })
                      }
                    />
                  </Col>
                </Row>
                {activeItem?.isGroupEvent && (
                  <Row>
                    <Col>
                      <Form.Control
                        placeholder="Team Name"
                        className="form-control"
                        value={partForm.teamName || ""}
                        onChange={(e) =>
                          setPartForm({ ...partForm, teamName: e.target.value })
                        }
                      />
                    </Col>
                  </Row>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button onClick={handleSaveParticipant} variant="primary">
                Save Student
              </Button>
            </Modal.Footer>
          </div>
        </Modal>

        {/* PROOF MODAL */}
        <Modal
          show={showProofModal}
          onHide={() => setShowProofModal(false)}
          centered
        >
          <div className="soft-card border-0 p-0 overflow-hidden">
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">Link Event Proof</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4">
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted">
                  URL (Drive/Photos)
                </Form.Label>
                <Form.Control
                  placeholder="https://..."
                  className="form-control"
                  value={eventProofUrl}
                  onChange={(e) => setEventProofUrl(e.target.value)}
                />
              </Form.Group>
              <div className="text-center my-3 text-muted small">- OR -</div>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  Upload File
                </Form.Label>
                <div className="d-flex gap-2">
                  <input
                    id={`proof-file-${eventId}`}
                    type="file"
                    accept="application/pdf,image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      try {
                        setUploadingProof(true);
                        const fileName = `${initialEventData?.title || eventId}_proof_${Date.now()}_${f.name}`;
                        const url = await uploadToGitHub(
                          f,
                          fileName,
                          `proofs/${eventId}`,
                        );
                        if (url) {
                          await updateDoc(doc(db, "events", eventId), {
                            proofUrl: url,
                          });
                          setEventProofUrl(url);
                          setShowProofModal(false);
                          alert("Proof uploaded successfully.");
                        }
                      } catch (err) {
                        alert("Upload failed: " + err.message);
                      } finally {
                        setUploadingProof(false);
                        e.target.value = null;
                      }
                    }}
                  />
                  <label
                    htmlFor={`proof-file-${eventId}`}
                    className="btn btn-outline-primary w-100"
                  >
                    {uploadingProof
                      ? "Uploading..."
                      : "Choose File (PDF/Image)"}
                  </label>
                </div>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="primary"
                onClick={handleSaveProof}
                className="w-100"
              >
                Save Link
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      </>
    );
  }
}
