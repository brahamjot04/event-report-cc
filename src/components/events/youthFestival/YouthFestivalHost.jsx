import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { loadCollegesWithCache, setCachedColleges } from "../../../utils/yfDataCache";
import {
  Button,
  Form,
  InputGroup,
  Badge,
  Spinner,
  Row,
  Col,
  Accordion,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { logAction } from "../../../utils/logger";
import { YF_EVENTS, YF_EVENTS_BY_ID, YF_CATEGORIES } from "../../../constants/youthFestivalEvents";
import CollegeModal from "./CollegeModal";
import ParticipantCard from "./ParticipantCard";
import ExportPdfModal from "./ExportPdfModal";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

const EMPTY_P_FORM = { name: "", contact: "", role: "P", eventId: "" };

export default function YouthFestivalHost({ eventId, goBack }) {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("colleges");
  // Store only the ID — selectedCollege is derived so it always reflects latest state
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId) || null;
  const [highlightedCollegeId, setHighlightedCollegeId] = useState(null);
  const lastCollegeIdRef = useRef(null);

  const handleOpenCollege = (collegeId) => {
    lastCollegeIdRef.current = collegeId;
    setSelectedCollegeId(collegeId);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleBackToCollegesList = () => {
    const fromId = lastCollegeIdRef.current;
    setSelectedCollegeId(null);
    if (fromId) {
      setHighlightedCollegeId(fromId);
      setTimeout(() => {
        const el = document.getElementById(`college-card-${fromId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      setTimeout(() => setHighlightedCollegeId(null), 2200);
    }
  };

  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);

  const [activeFormEventId, setActiveFormEventId] = useState(null);
  const [pForm, setPForm] = useState({ ...EMPTY_P_FORM });
  const [editingParticipant, setEditingParticipant] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roomMap, setRoomMap] = useState({});

  // ── Initial fetch (with instant cache support) ─────────────────────────────
  const fetchColleges = useCallback(async () => {
    loadCollegesWithCache(
      eventId,
      db,
      (list, isCached) => {
        setColleges(list);
        if (isCached) setLoading(false);
      },
      () => showError("Failed to load colleges.")
    );
    setLoading(false);
  }, [eventId, showError]);

  const fetchRoomMap = useCallback(async () => {
    try {
      const snap = await getDocs(
        collection(db, "events", eventId, "yf_accommodation_allotments")
      );
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.participantId && data.room) map[data.participantId] = data.room;
      });
      setRoomMap(map);
    } catch {
      // non-fatal
    }
  }, [eventId]);

  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const snap = await getDocs(
        collection(db, "events", eventId, "yf_tags")
      );
      setTags(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    } catch {
      // non-fatal
    }
  }, [eventId]);

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      showError("Tag already exists.");
      return;
    }
    setAddingTag(true);
    try {
      const ref = await addDoc(
        collection(db, "events", eventId, "yf_tags"),
        { name }
      );
      setTags((prev) => [...prev, { id: ref.id, name }]);
      setNewTagName("");
      await logAction("ADD_TAG", `Added custom tag "${name}"`, user);
      showSuccess(`Tag "${name}" created.`);
    } catch {
      showError("Failed to add tag.");
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTag = async (tag) => {
    const ok = await confirm(`Delete custom tag "${tag.name}"?`, { variant: "danger" });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "yf_tags", tag.id));
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      await logAction("DELETE_TAG", `Deleted custom tag "${tag.name}"`, user);
      showSuccess("Tag deleted.");
    } catch {
      showError("Failed to delete tag.");
    }
  };

  useEffect(() => {
    fetchColleges();
    fetchRoomMap();
    fetchTags();
  }, [fetchColleges, fetchRoomMap, fetchTags]);

  // ── College CRUD (local state updates, no refetch) ────────
  const handleSaveCollege = async (payload) => {
    try {
      if (editingCollege) {
        await updateDoc(
          doc(db, "events", eventId, "yf_colleges", editingCollege.id),
          payload
        );
        const updatedList = colleges.map((c) =>
          c.id === editingCollege.id ? { ...c, ...payload } : c
        );
        setColleges(updatedList);
        setCachedColleges(eventId, updatedList);
        await logAction("EDIT_COLLEGE", `Updated college "${payload.name}"`, user);
        showSuccess("College updated.");
      } else {
        const ref = await addDoc(
          collection(db, "events", eventId, "yf_colleges"),
          payload
        );
        const updatedList = [
          ...colleges,
          { id: ref.id, ...payload, participants: [] },
        ];
        setColleges(updatedList);
        setCachedColleges(eventId, updatedList);
        await logAction("REGISTER_COLLEGE", `Registered college "${payload.name}"`, user);
        showSuccess("College registered.");
      }
      setShowCollegeModal(false);
      setEditingCollege(null);
    } catch (e) {
      console.error(e);
      showError("Failed to save college.");
    }
  };

  const handleDeleteCollege = async (college) => {
    const ok = await confirm(
      `Delete "${college.name}" and all its participants?`,
      { variant: "danger" }
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "yf_colleges", college.id));
      const updatedList = colleges.filter((c) => c.id !== college.id);
      setColleges(updatedList);
      setCachedColleges(eventId, updatedList);
      if (selectedCollegeId === college.id) setSelectedCollegeId(null);
      await logAction("DELETE_COLLEGE", `Deleted college "${college.name}"`, user);
      showSuccess("College deleted.");
    } catch {
      showError("Failed to delete college.");
    }
  };

  // ── Participant CRUD (local state updates, no refetch) ────
  const resetPForm = () => {
    setPForm({ ...EMPTY_P_FORM });
    setEditingParticipant(null);
    setActiveFormEventId(null);
  };

  const openFormForEvent = (evId) => {
    resetPForm();
    setPForm({ ...EMPTY_P_FORM, eventId: evId });
    setActiveFormEventId(evId);
  };

  const updateCollegeParticipants = (collegeId, updater) => {
    setColleges((prev) => {
      const next = prev.map((c) =>
        c.id === collegeId
          ? { ...c, participants: updater(c.participants || []) }
          : c
      );
      setCachedColleges(eventId, next);
      return next;
    });
  };

  const handleSaveParticipant = async () => {
    if (!pForm.name.trim() || !selectedCollege || !pForm.eventId) return;
    const ref = collection(
      db,
      "events",
      eventId,
      "yf_colleges",
      selectedCollege.id,
      "participants"
    );
    try {
      if (editingParticipant) {
        await updateDoc(doc(ref, editingParticipant.id), pForm);
        updateCollegeParticipants(selectedCollege.id, (ps) =>
          ps.map((p) =>
            p.id === editingParticipant.id ? { ...p, ...pForm } : p
          )
        );
        await logAction(
          "EDIT_PARTICIPANT",
          `Updated participant "${pForm.name}" (${selectedCollege.name})`,
          user
        );
        showSuccess("Participant updated.");
      } else {
        const newRef = await addDoc(ref, pForm);
        updateCollegeParticipants(selectedCollege.id, (ps) => [
          ...ps,
          { id: newRef.id, ...pForm },
        ]);
        await logAction(
          "ADD_PARTICIPANT",
          `Added participant "${pForm.name}" (${selectedCollege.name})`,
          user
        );
        showSuccess("Participant added.");
      }
      resetPForm();
    } catch {
      showError("Failed to save participant.");
    }
  };

  const handleDeleteParticipant = async (participant) => {
    const ok = await confirm(`Remove "${participant.name}"?`, { variant: "danger" });
    if (!ok) return;
    try {
      await deleteDoc(
        doc(
          db,
          "events",
          eventId,
          "yf_colleges",
          selectedCollege.id,
          "participants",
          participant.id
        )
      );
      updateCollegeParticipants(selectedCollege.id, (ps) =>
        ps.filter((p) => p.id !== participant.id)
      );
      await logAction(
        "DELETE_PARTICIPANT",
        `Removed participant "${participant.name}" (${selectedCollege.name})`,
        user
      );
      showSuccess("Participant removed.");
    } catch {
      showError("Failed to remove participant.");
    }
  };

  const startEditParticipant = (p) => {
    setPForm({ name: p.name, contact: p.contact || "", role: p.role, eventId: p.eventId });
    setEditingParticipant(p);
    setActiveFormEventId(p.eventId);
  };

  // ── Search ────────────────────────────────────────────────
  const allParticipants = colleges.flatMap((c) =>
    (c.participants || []).map((p) => ({ ...p, _college: c }))
  );
  const q = searchQuery.toLowerCase().trim();
  const matchedParticipants = q
    ? allParticipants.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p._college?.name?.toLowerCase().includes(q) ||
          p.contact?.includes(q)
      )
    : [];
  const matchedColleges = q
    ? colleges.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.incharges?.some(
            (ic) => ic.name?.toLowerCase().includes(q) || ic.contact?.includes(q)
          )
      )
    : [];

  // ── Event-wise (global tab) ───────────────────────────────
  const eventStats = YF_EVENTS.map((ev) => {
    const collegesForEvent = colleges
      .filter((c) => (c.selectedEvents || []).includes(ev.id))
      .map((c) => ({
        ...c,
        evParticipants: (c.participants || []).filter((p) => p.eventId === ev.id),
      }));
    return { ...ev, collegesForEvent };
  }).filter((ev) => ev.collegesForEvent.length > 0);

  // ── Inline participant form ────────────────────────────────
  const renderParticipantForm = (evId) => {
    const ev = YF_EVENTS_BY_ID[evId];
    const existing = selectedCollege
      ? (selectedCollege.participants || []).filter((p) => p.eventId === evId)
      : [];
    const pCount = existing.filter((p) => p.role === "P").length;
    const aCount = existing.filter((p) => p.role === "A").length;

    return (
      <div
        className="p-3 rounded mb-2"
        style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
      >
        <p className="fw-bold small mb-2">
          {editingParticipant ? "Edit Participant" : `Add to ${ev?.name || evId}`}
          <small className="text-muted ms-2 fw-normal">
            {pCount}/{ev?.maxP || "?"}P · {aCount}/{ev?.maxA || "?"}A
          </small>
        </p>
        <Row className="g-2 mb-2">
          <Col>
            <Form.Control
              placeholder="Student name"
              value={pForm.name}
              onChange={(e) => setPForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </Col>
          <Col>
            <Form.Control
              placeholder="Contact number"
              value={pForm.contact}
              onChange={(e) => setPForm((f) => ({ ...f, contact: e.target.value }))}
              style={inputStyle}
            />
          </Col>
          <Col xs="auto">
            <Form.Select
              value={pForm.role}
              onChange={(e) => setPForm((f) => ({ ...f, role: e.target.value }))}
              style={inputStyle}
            >
              <option value="P">Participant (P)</option>
              {(ev?.maxA || 0) > 0 && <option value="A">Alternate (A)</option>}
            </Form.Select>
          </Col>
        </Row>
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveParticipant}
            disabled={!pForm.name.trim()}
          >
            {editingParticipant ? "Save" : "Add"}
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={resetPForm}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  // ── College Detail: events grouped by category ────────────
  const renderCollegeDetail = () => {
    const c = selectedCollege;
    const totalParticipants = (c.participants || []).length;

    // Group selected events by category
    const grouped = YF_CATEGORIES.map((cat) => ({
      cat,
      events: YF_EVENTS.filter(
        (ev) => ev.category === cat && (c.selectedEvents || []).includes(ev.id)
      ),
    })).filter((g) => g.events.length > 0);

    return (
      <div>
        {/* Breadcrumb */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleBackToCollegesList}
            >
              <i className="bi bi-arrow-left me-1" />
              All Colleges
            </Button>
            <h5 className="fw-bold mb-0">{c.name}</h5>
            {c.needsAccommodation && (
              <Badge bg="primary">
                <i className="bi bi-house-fill me-1" />
                Accommodation
              </Badge>
            )}
            <Badge bg="secondary">
              {totalParticipants} participant{totalParticipants !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                setEditingCollege(c);
                setShowCollegeModal(true);
              }}
            >
              <i className="bi bi-pencil me-1" />
              Edit College
            </Button>
          </div>
        </div>

        {/* Incharges */}
        {c.incharges?.filter((ic) => ic.name).length > 0 && (
          <div
            className="p-3 rounded mb-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <p className="text-muted small fw-bold mb-2">INCHARGES</p>
            {c.incharges.filter((ic) => ic.name).map((ic, i) => (
              <div key={i} className="d-flex gap-3 align-items-center mb-1 flex-wrap">
                <span className="fw-medium">
                  <i className="bi bi-person-badge me-1 text-muted" />
                  {ic.name}
                </span>
                {ic.contact && (
                  <>
                    <a href={`tel:${ic.contact}`} className="text-muted small text-decoration-none">
                      <i className="bi bi-telephone me-1" />
                      {ic.contact}
                    </a>
                    <a
                      href={`https://wa.me/91${ic.contact.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-success small text-decoration-none"
                    >
                      <i className="bi bi-whatsapp me-1" />
                      WA
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Events grouped by category */}
        {grouped.length === 0 ? (
          <p className="text-muted">No events selected for this college.</p>
        ) : (
          grouped.map(({ cat, events }) => (
            <div key={cat} className="mb-4">
              {/* Category heading */}
              <div
                className="px-3 py-2 rounded mb-2 d-flex align-items-center gap-2"
                style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
              >
                <span className="fw-bold text-uppercase small text-muted">{cat}</span>
                <Badge bg="secondary" className="ms-auto">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <Accordion flush>
                {events.map((ev) => {
                  const evParticipants = (c.participants || []).filter(
                    (p) => p.eventId === ev.id
                  );
                  const pCount = evParticipants.filter((p) => p.role === "P").length;
                  const aCount = evParticipants.filter((p) => p.role === "A").length;
                  const isFull = pCount >= ev.maxP && aCount >= (ev.maxA || 0);

                  return (
                    <Accordion.Item
                      key={ev.id}
                      eventKey={ev.id}
                      style={{
                        background: "var(--bg-card)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <Accordion.Header>
                        <div className="d-flex align-items-center gap-2 w-100 me-3">
                          <span className="fw-medium">{ev.name}</span>
                          <span className="ms-auto d-flex gap-1">
                            <Badge
                              bg={pCount > 0 ? "primary" : "light"}
                              text={pCount > 0 ? "white" : "dark"}
                            >
                              {pCount}/{ev.maxP}P
                            </Badge>
                            {ev.maxA > 0 && (
                              <Badge
                                bg={aCount > 0 ? "secondary" : "light"}
                                text={aCount > 0 ? "white" : "dark"}
                              >
                                {aCount}/{ev.maxA}A
                              </Badge>
                            )}
                            {evParticipants.length > 0 && (
                              <Badge bg="success">✓</Badge>
                            )}
                          </span>
                        </div>
                      </Accordion.Header>

                      <Accordion.Body className="pt-2">
                        {evParticipants.length === 0 ? (
                          <p className="text-muted small mb-2">No participants added yet.</p>
                        ) : (
                          evParticipants.map((p) => (
                            <div key={p.id} className="mb-2">
                              <ParticipantCard
                                participant={p}
                                college={c}
                                allottedRoom={roomMap[p.id]}
                              />
                              <div className="d-flex gap-1 mt-1">
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={() => startEditParticipant(p)}
                                >
                                  <i className="bi bi-pencil" />
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteParticipant(p)}
                                >
                                  <i className="bi bi-trash3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}

                        {activeFormEventId === ev.id
                          ? renderParticipantForm(ev.id)
                          : !isFull && (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="mt-1"
                                onClick={() => openFormForEvent(ev.id)}
                              >
                                <i className="bi bi-plus me-1" />
                                Add Participant
                              </Button>
                            )}
                        {isFull && activeFormEventId !== ev.id && (
                          <small className="text-muted d-block mt-1">
                            <i className="bi bi-check-circle-fill text-success me-1" />
                            All slots filled
                          </small>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            </div>
          ))
        )}
      </div>
    );
  };

  // ── Colleges list ─────────────────────────────────────────
  const renderCollegesList = () => (
    <div>
      {/* Manage Custom Tags Panel (Backend stored) */}
      <div
        className="p-3 rounded mb-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <p className="text-muted small fw-bold mb-2">
          <i className="bi bi-tags-fill me-1 text-primary" />
          MANAGE CUSTOM COLLEGE TAGS / LABELS
        </p>
        <InputGroup className="mb-2">
          <Form.Control
            placeholder="Create custom label (e.g. VIP Contingent, Late Arrival)"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
            style={inputStyle}
          />
          <Button
            variant="primary"
            onClick={handleAddTag}
            disabled={!newTagName.trim() || addingTag}
          >
            <i className="bi bi-plus me-1" />
            Add Tag
          </Button>
        </InputGroup>
        {tags.length === 0 ? (
          <small className="text-muted">
            No custom tags created. Created tags will be saved in Firebase and can be assigned to colleges.
          </small>
        ) : (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {tags.map((t) => (
              <div
                key={t.id}
                className="d-flex align-items-center gap-1 px-2 py-1 rounded"
                style={{
                  background: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <i className="bi bi-tag text-primary small" />
                <span className="small fw-medium">{t.name}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-1 text-danger text-decoration-none"
                  onClick={() => handleDeleteTag(t)}
                >
                  <i className="bi bi-x" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="fw-bold mb-0">Participating Colleges ({colleges.length})</h6>
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setShowExportModal(true)}
            disabled={colleges.length === 0}
          >
            <i className="bi bi-file-earmark-pdf me-1" />
            Export Reports
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingCollege(null);
              setShowCollegeModal(true);
            }}
          >
            <i className="bi bi-plus me-1" />
            Register College
          </Button>
        </div>
      </div>

      {colleges.length === 0 ? (
        <p className="text-muted">No colleges registered yet.</p>
      ) : (
        colleges.map((c) => (
          <div
            key={c.id}
            id={`college-card-${c.id}`}
            className={`p-3 rounded mb-2 ${highlightedCollegeId === c.id ? "card-return-highlight" : ""}`}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <div className="d-flex align-items-start justify-content-between gap-2">
              <div
                style={{ cursor: "pointer" }}
                onClick={() => handleOpenCollege(c.id)}
                className="flex-grow-1"
              >
                <div className="fw-bold">{c.name}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  <Badge bg="secondary">{c.selectedEvents?.length || 0} events</Badge>
                  <Badge bg="secondary">{c.participants?.length || 0} participants</Badge>
                  {c.checkedIn ? (
                    <Badge bg="success" className="bg-opacity-10 text-success">
                      <i className="bi bi-check-circle-fill me-1" /> Arrived
                    </Badge>
                  ) : (
                    <Badge bg="warning" className="bg-opacity-10 text-warning">
                      <i className="bi bi-clock me-1" /> Pending Arrival
                    </Badge>
                  )}
                  {c.needsAccommodation && (
                    <Badge bg="primary">
                      <i className="bi bi-house-fill me-1" />
                      Accommodation
                    </Badge>
                  )}
                  {c.selectedTags?.map((tag, idx) => (
                    <Badge key={idx} bg="info" text="dark">
                      <i className="bi bi-tag-fill me-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
                {c.incharges?.filter((ic) => ic.name).map((ic, i) => (
                  <small key={i} className="text-muted d-block mt-1">
                    <i className="bi bi-person-badge me-1" />
                    {ic.name}
                    {ic.contact && ` • ${ic.contact}`}
                  </small>
                ))}
              </div>
              <div className="d-flex gap-1 flex-shrink-0">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setEditingCollege(c);
                    setShowCollegeModal(true);
                  }}
                >
                  <i className="bi bi-pencil" />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDeleteCollege(c)}
                >
                  <i className="bi bi-trash3" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ── Global event-wise tab ─────────────────────────────────
  const renderEventsView = () => {
    const categoryGroups = YF_CATEGORIES.map((cat) => ({
      cat,
      events: eventStats.filter((ev) => ev.category === cat),
    })).filter((g) => g.events.length > 0);

    return (
      <div>
        <h6 className="fw-bold mb-1">Event-wise Overview</h6>
        <p className="text-muted small mb-3">
          Only events where at least one college is participating are shown.
        </p>
        {categoryGroups.length === 0 ? (
          <p className="text-muted">No participants entered yet.</p>
        ) : (
          categoryGroups.map(({ cat, events }) => (
            <div key={cat} className="mb-4">
              <div
                className="px-3 py-2 rounded mb-2"
                style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
              >
                <span className="fw-bold text-uppercase small text-muted">{cat}</span>
              </div>
              <Accordion flush>
                {events.map((ev) => {
                  const totalP = ev.collegesForEvent.reduce(
                    (n, c) => n + c.evParticipants.filter((p) => p.role === "P").length,
                    0
                  );
                  return (
                    <Accordion.Item
                      key={ev.id}
                      eventKey={ev.id}
                      style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
                    >
                      <Accordion.Header>
                        <div className="d-flex align-items-center gap-2 w-100 me-3">
                          <span className="fw-medium">{ev.name}</span>
                          <Badge bg="secondary" className="ms-auto">
                            {ev.collegesForEvent.length} college{ev.collegesForEvent.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge bg={totalP > 0 ? "success" : "light"} text={totalP > 0 ? "white" : "dark"}>
                            {totalP}P total
                          </Badge>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body className="pt-1">
                        {ev.collegesForEvent.map((c) => (
                          <div key={c.id} className="mb-3">
                            <p
                              className="fw-bold small mb-1 text-muted"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                handleOpenCollege(c.id);
                                setActiveTab("colleges");
                              }}
                            >
                              <i className="bi bi-building me-1" />
                              {c.name}
                              <i className="bi bi-arrow-right ms-2 text-primary" />
                            </p>
                            {c.evParticipants.length === 0 ? (
                              <small className="text-muted ms-3">No entries yet.</small>
                            ) : (
                              c.evParticipants.map((p) => (
                                <ParticipantCard
                                  key={p.id}
                                  participant={p}
                                  college={c}
                                  allottedRoom={roomMap[p.id]}
                                />
                              ))
                            )}
                          </div>
                        ))}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            </div>
          ))
        )}
      </div>
    );
  };

  // ── Search results ────────────────────────────────────────
  const renderSearch = () => (
    <div>
      <h6 className="fw-bold mb-3">Search Results</h6>
      {q.length < 2 ? (
        <p className="text-muted">Type at least 2 characters to search…</p>
      ) : matchedParticipants.length === 0 && matchedColleges.length === 0 ? (
        <p className="text-muted">No results found for &ldquo;{q}&rdquo;</p>
      ) : (
        <>
          {matchedColleges.length > 0 && (
            <div className="mb-4">
              <p className="text-muted small fw-bold">COLLEGES ({matchedColleges.length})</p>
              {matchedColleges.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded mb-2 d-flex justify-content-between align-items-center"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    handleOpenCollege(c.id);
                    setActiveTab("colleges");
                    setSearchQuery("");
                  }}
                >
                  <div>
                    <div className="fw-bold">{c.name}</div>
                    <small className="text-muted">
                      {c.selectedEvents?.length || 0} events · {c.participants?.length || 0} participants
                    </small>
                  </div>
                  <i className="bi bi-chevron-right text-muted" />
                </div>
              ))}
            </div>
          )}
          {matchedParticipants.length > 0 && (
            <div>
              <p className="text-muted small fw-bold">PARTICIPANTS ({matchedParticipants.length})</p>
              {matchedParticipants.map((p) => (
                <ParticipantCard
                  key={p.id}
                  participant={p}
                  college={p._college}
                  allottedRoom={roomMap[p.id]}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Root render ───────────────────────────────────────────
  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Button
          variant="outline-secondary"
          className="rounded-circle shadow-sm flex-shrink-0"
          onClick={goBack}
          style={{ width: 45, height: 45 }}
        >
          <i className="bi bi-arrow-left" />
        </Button>
        <div>
          <small className="text-muted text-uppercase fw-bold">Youth Festival</small>
          <h4 className="fw-bold mb-0">Colleges &amp; Participants</h4>
        </div>
      </div>

      {/* Unified search bar */}
      <InputGroup className="mb-4 shadow-sm">
        <InputGroup.Text style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <i className="bi bi-search text-muted" />
        </InputGroup.Text>
        <Form.Control
          placeholder="Search colleges, participants, incharges…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
        />
        {searchQuery && (
          <Button variant="outline-secondary" onClick={() => setSearchQuery("")}>
            <i className="bi bi-x" />
          </Button>
        )}
      </InputGroup>

      {searchQuery.length >= 2 ? (
        renderSearch()
      ) : (
        <>
          {/* Tabs */}
          <div
            className="d-flex gap-2 mb-4"
            style={{ borderBottom: "2px solid var(--border-color)" }}
          >
            {[
              { key: "colleges", label: "Colleges", icon: "bi-building" },
              { key: "events", label: "Event-wise", icon: "bi-trophy" },
            ].map((t) => (
              <button
                key={t.key}
                className={`btn btn-sm px-3 pb-2 rounded-0 border-0 fw-bold ${
                  activeTab === t.key
                    ? "text-primary border-bottom border-2 border-primary"
                    : "text-muted"
                }`}
                style={{ marginBottom: -2 }}
                onClick={() => {
                  setActiveTab(t.key);
                  setSelectedCollegeId(null);
                  resetPForm();
                }}
              >
                <i className={`bi ${t.icon} me-2`} />
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : activeTab === "colleges" ? (
            selectedCollege ? renderCollegeDetail() : renderCollegesList()
          ) : (
            renderEventsView()
          )}
        </>
      )}

      <CollegeModal
        key={editingCollege?.id || "new"}
        show={showCollegeModal}
        onHide={() => {
          setShowCollegeModal(false);
          setEditingCollege(null);
        }}
        onSave={handleSaveCollege}
        existingCollege={editingCollege}
        availableTags={tags}
      />

      <ExportPdfModal
        show={showExportModal}
        onHide={() => setShowExportModal(false)}
        colleges={colleges}
        eventTitle={eventId}
      />
    </>
  );
}
