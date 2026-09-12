import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { loadWithCache } from "../../utils/dataCache";
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
} from "react-bootstrap";
import { uploadToGitHub } from "../../utils/github";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../../context/ToastContext";
import ItemModal from "./participants/ItemModal";
import ParticipantModal from "./participants/ParticipantModal";

export default function EventParticipants({
  eventId,
  initialEventData,
  goBack,
}) {
  const { showSuccess, showError, showWarning, confirm } = useToast();
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
  const [showIdCardsModal, setShowIdCardsModal] = useState(false);

  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);
  const [idCardsContext, setIdCardsContext] = useState({
    type: "event",
    teamName: null,
  });
  const [teamPositionDrafts, setTeamPositionDrafts] = useState({});

  // Forms State
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newItemIsGroup, setNewItemIsGroup] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  const [activeItem, setActiveItem] = useState(null);
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const lastItemIdRef = useRef(null);

  const handleOpenItem = (item) => {
    lastItemIdRef.current = item.id;
    setActiveItem(item);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackToItemsList = () => {
    const fromId = lastItemIdRef.current;
    setActiveItem(null);
    if (fromId) {
      setHighlightedItemId(fromId);
      setTimeout(() => {
        const el = document.getElementById(`item-card-${fromId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      setTimeout(() => setHighlightedItemId(null), 2200);
    }
  };

  // Step-by-step Esc key: close item detail view before returning to dashboard
  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".modal.show")) return;
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)
      ) {
        activeEl.blur();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      handleBackToItemsList();
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem]);

  const [editingIndex, setEditingIndex] = useState(null);

  const [partForm, setPartForm] = useState({
    name: "",
    crn: "",
    urn: "",
    branch: "",
    phone: "",
    position: "",
    teamName: "",
    isCaptain: false,
  });

  // Filter State
  const [selectedCategory, setSelectedCategory] = useState(null);

  const toSafePathSegment = (value = "") =>
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "general";

  const getParticipantTeamName = (participant = {}) =>
    (participant.teamName || participant.team || "No Team").toString().trim() ||
    "No Team";

  const sortTeamParticipants = (participants = []) =>
    [...participants].sort((a, b) => {
      if (!!a.isCaptain !== !!b.isCaptain) return a.isCaptain ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  const getTeamMeta = (item, teamName) => {
    const safeTeamName = (teamName || "No Team").toString().trim() || "No Team";
    const teamMeta = item?.teamMeta || {};
    const existing = teamMeta[safeTeamName] || {};

    return {
      position: existing.position || "",
      idCards: Array.isArray(existing.idCards) ? existing.idCards : [],
    };
  };

  const fetchCategories = useCallback(async () => {
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);
    if (eventSnap.exists()) {
      setCategories(eventSnap.data().categories || []);
    }
  }, [eventId]);

  const fetchItems = useCallback(async () => {
    loadWithCache(
      `event_items_${eventId}`,
      async () => {
        const snap = await getDocs(collection(db, "events", eventId, "items"));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      (data) => setItems(data)
    );
  }, [eventId]);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  useEffect(() => {
    if (!activeItem?.isGroupEvent) {
      setTeamPositionDrafts({});
      return;
    }

    const groupedParticipants = (activeItem.participants || []).reduce(
      (acc, participant) => {
        const teamName = getParticipantTeamName(participant);
        acc[teamName] = true;
        return acc;
      },
      {},
    );

    const draftEntries = Object.keys(groupedParticipants).reduce(
      (acc, teamName) => {
        acc[teamName] = getTeamMeta(activeItem, teamName).position;
        return acc;
      },
      {},
    );

    setTeamPositionDrafts(draftEntries);
  }, [activeItem]);

  const handleAddCategory = async () => {
    if (!newCategoryInput) return;
    await updateDoc(doc(db, "events", eventId), {
      categories: arrayUnion(newCategoryInput),
    });
    setCategories([...categories, newCategoryInput]);
    setNewCategoryInput("");
  };

  const handleDeleteCategory = async (cat) => {
    const ok = await confirm({
      title: "Delete Category",
      message: `Are you sure you want to delete category "${cat}"?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    await updateDoc(doc(db, "events", eventId), {
      categories: arrayRemove(cat),
    });
    setCategories(categories.filter((c) => c !== cat));
    showSuccess(`Category "${cat}" deleted.`);
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
    const ok = await confirm({
      title: "Delete Sub-Event",
      message: "Are you sure you want to delete this sub-event and all its participants?",
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) {
      await deleteDoc(doc(db, "events", eventId, "items", itemId));
      showSuccess("Sub-event deleted.");
      fetchItems();
    }
  };

  const handleSaveParticipant = async () => {
    if (!activeItem) return;
    let u = [...(activeItem.participants || [])];
    const participantPayload = {
      ...partForm,
      isCaptain: !!partForm.isCaptain,
    };

    if (activeItem.isGroupEvent) {
      const teamName = getParticipantTeamName(participantPayload);
      if (!teamName || teamName === "No Team") {
        showWarning("Please enter a team name for group events.");
        return;
      }

      const teamPosition = getTeamMeta(activeItem, teamName).position;
      participantPayload.teamName = teamName;
      participantPayload.position = teamPosition;

      if (participantPayload.isCaptain) {
        u = u.map((participant, index) => {
          if (editingIndex !== null && index === editingIndex)
            return participant;
          if (getParticipantTeamName(participant) !== teamName)
            return participant;
          return {
            ...participant,
            isCaptain: false,
          };
        });
      }
    }

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

  const handleSaveTeamPosition = async (teamName) => {
    if (!activeItem) return;
    const safeTeamName = (teamName || "No Team").toString().trim() || "No Team";
    const nextPosition = (teamPositionDrafts[safeTeamName] || "")
      .toString()
      .trim();

    const teamMeta = { ...(activeItem.teamMeta || {}) };
    const existingMeta = getTeamMeta(activeItem, safeTeamName);

    teamMeta[safeTeamName] = {
      ...existingMeta,
      position: nextPosition,
    };

    const participants = (activeItem.participants || []).map((participant) => {
      if (getParticipantTeamName(participant) !== safeTeamName)
        return participant;
      return {
        ...participant,
        teamName: safeTeamName,
        position: nextPosition,
      };
    });

    await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
      teamMeta,
      participants,
    });

    setActiveItem({ ...activeItem, teamMeta, participants });
    fetchItems();
  };

  const handleUploadIdCard = async (file) => {
    if (!file || !activeItem) return;

    try {
      setUploadingIdCard(true);

      const basePath = `id-cards/${eventId}/${activeItem.id}`;
      const uploadPath =
        idCardsContext.type === "team"
          ? `${basePath}/${toSafePathSegment(idCardsContext.teamName || "No Team")}`
          : basePath;

      const fileName = `${initialEventData?.title || eventId}_${activeItem.name || activeItem.id}_${Date.now()}_${file.name}`;
      const url = await uploadToGitHub(file, fileName, uploadPath);
      if (!url) return;

      const uploadedFile = {
        name: file.name,
        url,
        uploadedAt: Date.now(),
      };

      if (idCardsContext.type === "team") {
        const teamName =
          (idCardsContext.teamName || "No Team").toString().trim() || "No Team";
        const teamMeta = { ...(activeItem.teamMeta || {}) };
        const existingMeta = getTeamMeta(activeItem, teamName);

        teamMeta[teamName] = {
          ...existingMeta,
          idCards: [...existingMeta.idCards, uploadedFile],
        };

        await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
          teamMeta,
        });
        setActiveItem({ ...activeItem, teamMeta });
      } else {
        const idCards = [...(activeItem.idCards || []), uploadedFile];

        await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
          idCards,
        });
        setActiveItem({ ...activeItem, idCards });
      }

      fetchItems();
      showSuccess("ID card uploaded successfully.");
    } catch (err) {
      showError("Upload failed: " + err.message);
    } finally {
      setUploadingIdCard(false);
    }
  };

  const handleDeleteIdCard = async (index, teamName = null) => {
    if (!activeItem) return;
    const ok = await confirm({
      title: "Delete File",
      message: "Are you sure you want to delete this uploaded file entry?",
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    if (teamName) {
      const safeTeamName =
        (teamName || "No Team").toString().trim() || "No Team";
      const teamMeta = { ...(activeItem.teamMeta || {}) };
      const existingMeta = getTeamMeta(activeItem, safeTeamName);

      teamMeta[safeTeamName] = {
        ...existingMeta,
        idCards: existingMeta.idCards.filter(
          (_, fileIndex) => fileIndex !== index,
        ),
      };

      await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
        teamMeta,
      });
      setActiveItem({ ...activeItem, teamMeta });
    } else {
      const idCards = (activeItem.idCards || []).filter(
        (_, fileIndex) => fileIndex !== index,
      );

      await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
        idCards,
      });
      setActiveItem({ ...activeItem, idCards });
    }

    showSuccess("Uploaded file entry deleted.");
    fetchItems();
  };

  const handleDeleteParticipant = async (idx) => {
    const ok = await confirm({
      title: "Remove Student",
      message: "Are you sure you want to remove this student?",
      confirmText: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    const p = activeItem.participants.filter((_, i) => i !== idx);
    await updateDoc(doc(db, "events", eventId, "items", activeItem.id), {
      participants: p,
    });
    setActiveItem({ ...activeItem, participants: p });
    showSuccess("Student removed.");
    fetchItems();
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
      showSuccess("Participants imported successfully!");
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

      const participantsForPdf = item.isGroupEvent
        ? sortTeamParticipants(item.participants || [])
        : item.participants || [];

      // Phone is NOT included here
      const rows = participantsForPdf.map((p, i) => [
        i + 1,
        item.isGroupEvent && p.isCaptain ? `${p.name} (Captain)` : p.name,
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
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
          <div className="d-flex align-items-start align-items-sm-center gap-3 flex-shrink-0">
            <Button
              variant="outline-secondary"
              className="rounded-circle shadow-sm flex-shrink-0"
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={handleBackToItemsList}
            >
              <i className="bi bi-arrow-left"></i>
            </Button>
            <div>
              <h3 className="fw-bold mb-0 text-nowrap">{activeItem.name}</h3>
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
          </div>
          <div className="d-flex flex-wrap gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
            {activeItem.isGroupEvent ? (
              <Button
                variant="outline-secondary"
                className="d-flex align-items-center gap-2"
                onClick={() => {
                  setIdCardsContext({ type: "event", teamName: null });
                  setShowIdCardsModal(true);
                }}
              >
                <i className="bi bi-folder2-open"></i>
                <span className="d-none d-md-inline">View Event Files</span>
              </Button>
            ) : (
              <Button
                variant="outline-secondary"
                className="d-flex align-items-center gap-2"
                onClick={() => {
                  setIdCardsContext({ type: "event", teamName: null });
                  setShowIdCardsModal(true);
                }}
              >
                <i className="bi bi-card-image"></i>
                <span className="d-none d-md-inline">ID Cards</span>
              </Button>
            )}

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
                  isCaptain: false,
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

        <div
          className="soft-card p-0 overflow-hidden shadow-sm"
          style={{ height: "fit-content" }}
        >
          {activeItem.isGroupEvent ? (
            Object.keys(groupedParticipants).length === 0 ? (
              // Empty State for Group Events
              <div className="p-4 text-center text-muted">
                <i className="bi bi-people display-4 opacity-25 d-block mb-3 mt-2"></i>
                No participants added yet.
              </div>
            ) : (
              Object.entries(groupedParticipants).map(([team, list]) => (
                <div key={team} className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2 gap-2 flex-wrap">
                    <h6 className="fw-bold mb-0 text-start">{team}</h6>
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <Form.Control
                        size="sm"
                        style={{ maxWidth: "220px" }}
                        placeholder="Team Position"
                        value={teamPositionDrafts[team] ?? ""}
                        onChange={(e) =>
                          setTeamPositionDrafts((prev) => ({
                            ...prev,
                            [team]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleSaveTeamPosition(team)}
                      >
                        Save Position
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setIdCardsContext({ type: "team", teamName: team });
                          setShowIdCardsModal(true);
                        }}
                      >
                        ID Cards
                      </Button>
                    </div>
                  </div>
                  <Table
                    hover
                    responsive
                    className="mb-3 align-middle text-start"
                  >
                    <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                      <tr>
                        <th
                          className="ps-4 py-3 text-secondary text-uppercase small text-start"
                          style={{ width: "5%" }}
                        >
                          #
                        </th>
                        <th className="text-secondary text-uppercase small text-start">
                          Student Name
                        </th>
                        <th className="text-secondary text-uppercase small text-start">
                          URN
                        </th>
                        {/* PHONE COLUMN */}
                        <th className="text-secondary text-uppercase small text-start">
                          Phone
                        </th>
                        <th className="text-secondary text-uppercase small text-start">
                          Branch
                        </th>
                        <th className="text-secondary text-uppercase small text-start">
                          Position
                        </th>
                        <th className="text-end pe-4 text-secondary text-uppercase small">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortTeamParticipants(list).map((p, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                          }}
                        >
                          <td className="ps-4 text-muted text-start">
                            {idx + 1}
                          </td>
                          <td
                            className="fw-bold text-body text-start"
                            style={{ color: "var(--text-primary) !important" }}
                          >
                            {p.name}
                            {p.isCaptain ? (
                              <Badge bg="success" className="ms-2">
                                Captain
                              </Badge>
                            ) : null}
                          </td>
                          <td className="text-muted text-start">
                            <code className="text-primary">{p.urn}</code>
                          </td>
                          {/* PHONE DATA */}
                          <td className="text-muted small text-start">
                            {p.phone || "-"}
                          </td>
                          <td className="text-muted small text-start">
                            {p.branch || "-"}
                          </td>
                          <td className="text-start">
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
                                  setPartForm({
                                    ...p,
                                    isCaptain: !!p.isCaptain,
                                  });
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
            // Solo Event Table
            <Table hover responsive className="mb-0 align-middle text-start">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr>
                  <th
                    className="ps-4 py-3 text-secondary text-uppercase small text-start"
                    style={{ width: "5%" }}
                  >
                    #
                  </th>
                  <th className="text-secondary text-uppercase small text-start">
                    Student Name
                  </th>
                  <th className="text-secondary text-uppercase small text-start">
                    URN
                  </th>
                  {/* PHONE COLUMN */}
                  <th className="text-secondary text-uppercase small text-start">
                    Phone
                  </th>
                  <th className="text-secondary text-uppercase small text-start">
                    Branch
                  </th>
                  <th className="text-secondary text-uppercase small text-start">
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
                  // Empty State for Solo Events
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-4 text-muted border-0"
                    >
                      <i className="bi bi-people display-4 opacity-25 d-block mb-3 mt-2"></i>
                      No participants added yet.
                    </td>
                  </tr>
                ) : (
                  activeItem.participants.map((p, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 text-muted text-start">{idx + 1}</td>
                      <td
                        className="fw-bold text-body text-start"
                        style={{ color: "var(--text-primary) !important" }}
                      >
                        {p.name}
                      </td>
                      <td className="text-muted text-start">
                        <code className="text-primary">{p.urn}</code>
                      </td>
                      {/* PHONE DATA */}
                      <td className="text-muted small text-start">
                        {p.phone || "-"}
                      </td>
                      <td className="text-muted small text-start">
                        {p.branch || "-"}
                      </td>
                      <td className="text-start">
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
                              setPartForm({ ...p, isCaptain: !!p.isCaptain });
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
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-start align-items-sm-center gap-3 flex-shrink-0">
          <Button
            variant="outline-secondary"
            className="rounded-circle shadow-sm flex-shrink-0"
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
            <h3 className="fw-bold mb-0 text-nowrap">Event Participants</h3>
            <p className="text-muted small mb-0">
              Manage sub-events and student lists
            </p>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
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

      {/* Category Filter Chips */}
      <div className="mb-4 d-flex flex-wrap gap-2 align-items-center">
        <span className="text-muted small fw-bold me-2">Filter by:</span>
        <Button
          size="sm"
          variant={selectedCategory === null ? "primary" : "outline-secondary"}
          onClick={() => setSelectedCategory(null)}
        >
          All Events
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={selectedCategory === cat ? "primary" : "outline-secondary"}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
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

        {items
          .filter(
            (item) =>
              selectedCategory === null || item.category === selectedCategory,
          )
          .map((item) => (
            <Col md={6} lg={4} key={item.id} id={`item-card-${item.id}`}>
              <div
                className={`soft-card h-100 d-flex flex-column position-relative text-start ${highlightedItemId === item.id ? "card-return-highlight" : ""}`}
                style={{ cursor: "pointer", minHeight: "180px" }}
                onClick={() => handleOpenItem(item)}
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
                  <Button size="sm" className="soft-open-btn px-3">
                    Open <i className="bi bi-arrow-right ms-1"></i>
                  </Button>
                </div>
              </div>
            </Col>
          ))}

        {items.filter(
          (item) =>
            selectedCategory === null || item.category === selectedCategory,
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
              <i className="bi bi-inbox display-4 opacity-25 d-block mb-3"></i>
              <p className="text-muted mb-0">
                {selectedCategory
                  ? `No events found in "${selectedCategory}" category`
                  : "No sub-events created yet"}
              </p>
            </div>
          </Col>
        )}
      </Row>

      {renderModals()}
    </>
  );

  function renderModals() {
    const isTeamContext = idCardsContext.type === "team";
    const selectedTeamName =
      (idCardsContext.teamName || "No Team").toString().trim() || "No Team";
    const teamFiles = isTeamContext
      ? getTeamMeta(activeItem, selectedTeamName).idCards
      : [];
    const eventFiles = Array.isArray(activeItem?.idCards)
      ? activeItem.idCards
      : [];
    const groupedTeamFiles = Object.entries(activeItem?.teamMeta || {}).reduce(
      (acc, [teamName, meta]) => {
        const idCards = Array.isArray(meta?.idCards) ? meta.idCards : [];
        if (idCards.length > 0) {
          acc.push({ teamName, idCards });
        }
        return acc;
      },
      [],
    );

    return (
      <>
        {/* CATEGORY MODAL */}
        <Modal
          show={showCategoryModal}
          onHide={() => setShowCategoryModal(false)}
          centered
        >
          <div
            className="soft-card border-0 p-0 overflow-hidden"
            style={{ height: "auto" }}
          >
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
                    className="category-list-item d-flex justify-content-between align-items-center bg-transparent border-bottom px-0"
                    style={{
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {cat}
                    <i
                      className="bi bi-trash text-danger cursor-pointer category-trash"
                      onClick={() => handleDeleteCategory(cat)}
                    ></i>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <InputGroup className="category-input-group">
                <Form.Control
                  placeholder="New Category"
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
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
        <ItemModal
          show={showItemModal}
          onHide={() => {
            setShowItemModal(false);
            setEditingItemId(null);
            setNewItemIsGroup(false);
          }}
          editingItemId={editingItemId}
          newItemName={newItemName}
          setNewItemName={setNewItemName}
          newItemIsGroup={newItemIsGroup}
          setNewItemIsGroup={setNewItemIsGroup}
          newItemCategory={newItemCategory}
          setNewItemCategory={setNewItemCategory}
          categories={categories}
          onSave={handleAddItem}
        />

        {/* PARTICIPANT MODAL */}
        <ParticipantModal
          show={showPartModal}
          onHide={() => setShowPartModal(false)}
          partForm={partForm}
          setPartForm={setPartForm}
          activeItem={activeItem}
          onSave={handleSaveParticipant}
        />

        {/* PROOF MODAL */}
        <Modal
          show={showIdCardsModal}
          onHide={() => setShowIdCardsModal(false)}
          centered
          size="lg"
        >
          <div
            className="soft-card border-0 p-0 overflow-hidden"
            style={{ height: "auto" }}
          >
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">
                {isTeamContext
                  ? `Team ID Cards • ${selectedTeamName}`
                  : "Event ID Cards"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4 text-start">
              {(isTeamContext || !activeItem?.isGroupEvent) && (
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted">
                    Upload (PDF/Image)
                  </Form.Label>
                  <input
                    type="file"
                    className="form-control"
                    accept="application/pdf,image/*"
                    onChange={async (e) => {
                      const selectedFile = e.target.files[0];
                      if (!selectedFile) return;
                      await handleUploadIdCard(selectedFile);
                      e.target.value = null;
                    }}
                    disabled={uploadingIdCard}
                  />
                  {uploadingIdCard && (
                    <div className="small text-muted mt-2">Uploading...</div>
                  )}
                </Form.Group>
              )}

              {isTeamContext ? (
                teamFiles.length === 0 ? (
                  <p className="text-muted mb-0">
                    No files uploaded for this team.
                  </p>
                ) : (
                  <ListGroup>
                    {teamFiles.map((file, index) => (
                      <ListGroup.Item
                        key={`${file.url}-${index}`}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <a href={file.url} target="_blank" rel="noreferrer">
                          {file.name || `File ${index + 1}`}
                        </a>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() =>
                            handleDeleteIdCard(index, selectedTeamName)
                          }
                        >
                          Delete
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )
              ) : activeItem?.isGroupEvent ? (
                groupedTeamFiles.length === 0 ? (
                  <p className="text-muted mb-0">
                    No team files uploaded for this event yet.
                  </p>
                ) : (
                  groupedTeamFiles.map((group) => (
                    <div key={group.teamName} className="mb-3">
                      <h6 className="fw-bold mb-2">{group.teamName}</h6>
                      <ListGroup>
                        {group.idCards.map((file, index) => (
                          <ListGroup.Item
                            key={`${group.teamName}-${file.url}-${index}`}
                            className="d-flex justify-content-between align-items-center"
                          >
                            <a href={file.url} target="_blank" rel="noreferrer">
                              {file.name || `File ${index + 1}`}
                            </a>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() =>
                                handleDeleteIdCard(index, group.teamName)
                              }
                            >
                              Delete
                            </Button>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </div>
                  ))
                )
              ) : eventFiles.length === 0 ? (
                <p className="text-muted mb-0">
                  No files uploaded for this event.
                </p>
              ) : (
                <ListGroup>
                  {eventFiles.map((file, index) => (
                    <ListGroup.Item
                      key={`${file.url}-${index}`}
                      className="d-flex justify-content-between align-items-center"
                    >
                      <a href={file.url} target="_blank" rel="noreferrer">
                        {file.name || `File ${index + 1}`}
                      </a>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteIdCard(index)}
                      >
                        Delete
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="secondary"
                onClick={() => setShowIdCardsModal(false)}
                className="w-100"
              >
                Close
              </Button>
            </Modal.Footer>
          </div>
        </Modal>

        <Modal
          show={showProofModal}
          onHide={() => setShowProofModal(false)}
          centered
        >
          <div
            className="soft-card border-0 p-0 overflow-hidden"
            style={{ height: "auto" }}
          >
            <Modal.Header
              closeButton
              className="border-bottom"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Modal.Title className="fw-bold h5">Link Event Proof</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4 text-start">
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted">
                  URL (Drive/Photos)
                </Form.Label>
                <Form.Control
                  placeholder="https://..."
                  className="form-control"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
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
                          showSuccess("Proof uploaded successfully.");
                        }
                      } catch (err) {
                        showError("Upload failed: " + err.message);
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
