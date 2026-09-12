import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { loadWithCache } from "../../../utils/dataCache";
import {
  Button,
  Form,
  Badge,
  Spinner,
  Accordion,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { YF_EVENTS, YF_CATEGORIES } from "../../../constants/youthFestivalEvents";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

/**
 * GNDEC Contingent mode (non-host).
 * Roster of GNDEC students across 32 PTU events (P/A slots).
 * Stored in: events/{eventId}/meta/yf_contingent_roster
 */
export default function YouthFestivalContingent({ eventId, goBack }) {
  const { showSuccess, showError } = useToast();

  // roster: { [eventId]: { participants: [{name, contact, role}] } }
  const [roster, setRoster] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inline edit per event
  const [editingEvent, setEditingEvent] = useState(null);
  const [editRows, setEditRows] = useState([]);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchRoster = useCallback(async () => {
    loadWithCache(
      `yf_contingent_${eventId}`,
      async () => {
        const snap = await getDoc(doc(db, "events", eventId, "meta", "yf_contingent_roster"));
        return snap.exists() ? snap.data().roster || {} : {};
      },
      (data, isCached) => {
        setRoster(data);
        if (isCached) setLoading(false);
      },
      () => showError("Failed to load contingent roster.")
    );
    setLoading(false);
  }, [eventId, showError]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "events", eventId, "meta", "yf_contingent_roster"),
        { roster }
      );
      showSuccess("Roster saved.");
    } catch {
      showError("Failed to save roster.");
    } finally {
      setSaving(false);
    }
  };

  // ── Inline editing ────────────────────────────────────────
  const startEdit = (ev) => {
    setEditingEvent(ev.id);
    const existing = roster[ev.id]?.participants || [];
    // Pre-fill slots: maxP P rows + maxA A rows
    const pSlots = Array.from({ length: ev.maxP }, (_, i) => ({
      role: "P",
      name: existing.filter((r) => r.role === "P")[i]?.name || "",
      contact: existing.filter((r) => r.role === "P")[i]?.contact || "",
    }));
    const aSlots = Array.from({ length: ev.maxA }, (_, i) => ({
      role: "A",
      name: existing.filter((r) => r.role === "A")[i]?.name || "",
      contact: existing.filter((r) => r.role === "A")[i]?.contact || "",
    }));
    setEditRows([...pSlots, ...aSlots]);
  };

  const updateRow = (idx, field, value) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const saveEdit = () => {
    const participants = editRows.filter((r) => r.name.trim());
    setRoster((prev) => ({
      ...prev,
      [editingEvent]: { participants },
    }));
    setEditingEvent(null);
    setEditRows([]);
  };

  // ── Stats ─────────────────────────────────────────────────
  const totalRegistered = Object.values(roster).reduce(
    (acc, ev) => acc + (ev.participants?.length || 0),
    0
  );

  return (
    <>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-start align-items-sm-center gap-3">
          <Button
            variant="outline-secondary"
            className="rounded-circle shadow-sm flex-shrink-0"
            onClick={goBack}
            style={{ width: 45, height: 45 }}
          >
            <i className="bi bi-arrow-left" />
          </Button>
          <div>
            <small className="text-muted text-uppercase fw-bold">
              Youth Festival — GNDEC Contingent
            </small>
            <h4 className="fw-bold mb-0">Our Participation Roster</h4>
          </div>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 w-100 w-md-auto justify-content-start justify-content-md-end">
          <Badge bg="primary" className="p-2">{totalRegistered} students entered</Badge>
          <Button
            variant="primary"
            className="px-4"
            onClick={handleSave}
            disabled={saving}
          >
            <i className="bi bi-save me-2" />
            {saving ? "Saving…" : "Save Roster"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        YF_CATEGORIES.map((cat) => {
          const catEvents = YF_EVENTS.filter((e) => e.category === cat);
          return (
            <div key={cat} className="mb-5">
              <h6 className="fw-bold text-muted text-uppercase mb-3">{cat}</h6>
              <Accordion flush>
                {catEvents.map((ev) => {
                  const evRoster = roster[ev.id]?.participants || [];
                  const pCount = evRoster.filter((r) => r.role === "P").length;
                  const aCount = evRoster.filter((r) => r.role === "A").length;
                  const isEditing = editingEvent === ev.id;

                  return (
                    <Accordion.Item
                      key={ev.id}
                      eventKey={ev.id}
                      style={{
                        background: "var(--bg-card)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <Accordion.Header
                        onClick={() => !isEditing && startEdit(ev)}
                      >
                        <div className="d-flex align-items-center gap-2 w-100 me-3">
                          <span className="fw-medium">{ev.name}</span>
                          <span className="ms-auto d-flex gap-1">
                            <Badge bg={pCount > 0 ? "primary" : "light"} text={pCount > 0 ? "white" : "dark"}>
                              {pCount}/{ev.maxP}P
                            </Badge>
                            {ev.maxA > 0 && (
                              <Badge bg={aCount > 0 ? "secondary" : "light"} text={aCount > 0 ? "white" : "dark"}>
                                {aCount}/{ev.maxA}A
                              </Badge>
                            )}
                          </span>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        {isEditing ? (
                          <div>
                            <div className="d-grid gap-2 mb-3">
                              {editRows.map((row, idx) => (
                                <div
                                  key={idx}
                                  className="d-flex align-items-center gap-2"
                                >
                                  <Badge
                                    bg={row.role === "P" ? "primary" : "secondary"}
                                    style={{ minWidth: 28 }}
                                  >
                                    {row.role}
                                    {row.role === "P"
                                      ? idx + 1
                                      : idx - ev.maxP + 1}
                                  </Badge>
                                  <Form.Control
                                    size="sm"
                                    placeholder="Student name"
                                    value={row.name}
                                    onChange={(e) =>
                                      updateRow(idx, "name", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                  <Form.Control
                                    size="sm"
                                    placeholder="Contact"
                                    value={row.contact}
                                    onChange={(e) =>
                                      updateRow(idx, "contact", e.target.value)
                                    }
                                    style={inputStyle}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="d-flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={saveEdit}
                              >
                                Done
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingEvent(null);
                                  setEditRows([]);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : evRoster.length === 0 ? (
                          <div className="d-flex align-items-center gap-2">
                            <small className="text-muted">No entries yet.</small>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => startEdit(ev)}
                            >
                              <i className="bi bi-pencil me-1" />
                              Fill Roster
                            </Button>
                          </div>
                        ) : (
                          <div>
                            {evRoster.map((r, i) => (
                              <div
                                key={i}
                                className="d-flex align-items-center gap-2 mb-1"
                              >
                                <Badge bg={r.role === "P" ? "primary" : "secondary"}>
                                  {r.role}
                                </Badge>
                                <span className="fw-medium">{r.name}</span>
                                {r.contact && (
                                  <a
                                    href={`tel:${r.contact}`}
                                    className="text-muted small text-decoration-none"
                                  >
                                    <i className="bi bi-telephone me-1" />
                                    {r.contact}
                                  </a>
                                )}
                              </div>
                            ))}
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="mt-2"
                              onClick={() => startEdit(ev)}
                            >
                              <i className="bi bi-pencil me-1" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            </div>
          );
        })
      )}

      <div className="d-flex justify-content-end mt-3">
        <Button
          variant="primary"
          className="px-4"
          onClick={handleSave}
          disabled={saving}
        >
          <i className="bi bi-save me-2" />
          {saving ? "Saving…" : "Save Roster"}
        </Button>
      </div>
    </>
  );
}
