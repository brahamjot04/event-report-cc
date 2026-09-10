import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  Button,
  Form,
  Badge,
  Spinner,
  Row,
  Col,
  InputGroup,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { YF_EVENTS, YF_CATEGORIES } from "../../../constants/youthFestivalEvents";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

const DAYS = ["Day 1", "Day 2", "Day 3"];

/**
 * Maps each Youth Festival event → Venue + Day + Time + Notes.
 * Venues are stored in Firestore: events/{eventId}/yf_venues (collection).
 * Mapping stored in: events/{eventId}/meta/yf_venue_mapping (single doc).
 */
export default function EventYouthFestivalVenues({ eventId, goBack }) {
  const { showSuccess, showError, confirm } = useToast();

  // mapping: { [yfEventId]: { venueId, venueName, day, time, notes } }
  const [mapping, setMapping] = useState({});
  // venues from Firestore: [{ id, name }]
  const [venues, setVenues] = useState([]);
  const [newVenueName, setNewVenueName] = useState("");
  const [addingVenue, setAddingVenue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch venues ──────────────────────────────────────────
  const fetchVenues = useCallback(async () => {
    try {
      const snap = await getDocs(
        collection(db, "events", eventId, "yf_venues")
      );
      setVenues(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    } catch (e) {
      console.error(e);
      showError("Failed to load venues.");
    }
  }, [eventId, showError]);

  // ── Fetch mapping ─────────────────────────────────────────
  const fetchMapping = useCallback(async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "events", eventId, "meta", "yf_venue_mapping");
      const snap = await getDoc(docRef);
      if (snap.exists()) setMapping(snap.data().mapping || {});
    } catch (e) {
      console.error(e);
      showError("Failed to load venue mapping.");
    } finally {
      setLoading(false);
    }
  }, [eventId, showError]);

  useEffect(() => {
    fetchVenues();
    fetchMapping();
  }, [fetchVenues, fetchMapping]);

  // ── Add venue ─────────────────────────────────────────────
  const handleAddVenue = async () => {
    const name = newVenueName.trim();
    if (!name) return;
    if (venues.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      showError("A venue with this name already exists.");
      return;
    }
    setAddingVenue(true);
    try {
      const ref = await addDoc(
        collection(db, "events", eventId, "yf_venues"),
        { name }
      );
      setVenues((prev) => [...prev, { id: ref.id, name }]);
      setNewVenueName("");
      showSuccess(`"${name}" added.`);
    } catch {
      showError("Failed to add venue.");
    } finally {
      setAddingVenue(false);
    }
  };

  // ── Delete venue ──────────────────────────────────────────
  const handleDeleteVenue = async (venue) => {
    const ok = await confirm(
      `Delete venue "${venue.name}"? Events mapped to it will lose their venue assignment.`,
      { variant: "danger" }
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "yf_venues", venue.id));
      // Clear this venue from mapping
      setMapping((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((evId) => {
          if (next[evId]?.venueId === venue.id) {
            next[evId] = { ...next[evId], venueId: "", venueName: "" };
          }
        });
        return next;
      });
      setVenues((prev) => prev.filter((v) => v.id !== venue.id));
      showSuccess("Venue deleted.");
    } catch {
      showError("Failed to delete venue.");
    }
  };

  // ── Update event mapping field ────────────────────────────
  const updateEventMapping = (yfEvId, field, value) => {
    setMapping((prev) => ({
      ...prev,
      [yfEvId]: { ...(prev[yfEvId] || {}), [field]: value },
    }));
  };

  const handleVenueSelect = (yfEvId, venueId) => {
    const venue = venues.find((v) => v.id === venueId);
    setMapping((prev) => ({
      ...prev,
      [yfEvId]: {
        ...(prev[yfEvId] || {}),
        venueId: venueId,
        venueName: venue?.name || "",
      },
    }));
  };

  // ── Save mapping ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "events", eventId, "meta", "yf_venue_mapping"),
        { mapping },
        { merge: true }
      );
      showSuccess("Venue mapping saved.");
    } catch {
      showError("Failed to save venue mapping.");
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = YF_EVENTS.filter((ev) => mapping[ev.id]?.venueId).length;

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <Button
          variant="outline-secondary"
          className="rounded-circle shadow-sm flex-shrink-0"
          onClick={goBack}
          style={{ width: 45, height: 45 }}
        >
          <i className="bi bi-arrow-left" />
        </Button>
        <div className="flex-grow-1">
          <small className="text-muted text-uppercase fw-bold">Youth Festival</small>
          <h4 className="fw-bold mb-0">Venue Mapping</h4>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Badge bg="secondary">
            {mappedCount} / {YF_EVENTS.length} mapped
          </Badge>
          <Button
            variant="primary"
            className="rounded-pill px-4"
            onClick={handleSave}
            disabled={saving}
          >
            <i className="bi bi-save me-2" />
            {saving ? "Saving…" : "Save Mapping"}
          </Button>
        </div>
      </div>

      {/* ── Manage Venues ─────────────────────────────────── */}
      <div
        className="p-3 rounded mb-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <p className="text-muted small fw-bold mb-3">
          <i className="bi bi-geo-alt-fill me-1 text-primary" />
          MANAGE VENUES
        </p>

        {/* Add venue input */}
        <InputGroup className="mb-3">
          <Form.Control
            placeholder="Enter venue name (e.g. Main Auditorium)"
            value={newVenueName}
            onChange={(e) => setNewVenueName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddVenue()}
            style={inputStyle}
          />
          <Button
            variant="primary"
            onClick={handleAddVenue}
            disabled={!newVenueName.trim() || addingVenue}
          >
            <i className="bi bi-plus me-1" />
            Add Venue
          </Button>
        </InputGroup>

        {/* Venue list */}
        {venues.length === 0 ? (
          <p className="text-muted small">
            No venues added yet. Add at least one venue before mapping events.
          </p>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {venues.map((v) => (
              <div
                key={v.id}
                className="d-flex align-items-center gap-1 px-2 py-1 rounded"
                style={{
                  background: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <i className="bi bi-geo-alt text-primary small" />
                <span className="small fw-medium">{v.name}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-1 text-danger"
                  onClick={() => handleDeleteVenue(v)}
                  title="Delete venue"
                >
                  <i className="bi bi-x" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Event → Venue mapping ──────────────────────────── */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : venues.length === 0 ? (
        <div
          className="text-center py-5 rounded"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <i className="bi bi-geo-alt fs-1 text-muted" />
          <p className="text-muted mt-2">
            Add at least one venue above to start mapping events.
          </p>
        </div>
      ) : (
        <>
          {YF_CATEGORIES.map((cat) => {
            const catEvents = YF_EVENTS.filter((e) => e.category === cat);
            return (
              <div key={cat} className="mb-4">
                <h6 className="fw-bold text-muted mb-2 text-uppercase">{cat}</h6>
                <div className="d-grid gap-2">
                  {catEvents.map((ev) => {
                    const m = mapping[ev.id] || {};
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="fw-medium flex-grow-1">{ev.name}</span>
                          {m.venueId && (
                            <Badge bg="success">
                              <i className="bi bi-geo-alt me-1" />
                              {m.venueName}
                            </Badge>
                          )}
                        </div>
                        <Row className="g-2">
                          <Col md={4}>
                            <Form.Select
                              size="sm"
                              value={m.venueId || ""}
                              onChange={(e) => handleVenueSelect(ev.id, e.target.value)}
                              style={inputStyle}
                            >
                              <option value="">— Select Venue —</option>
                              {venues.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Select
                              size="sm"
                              value={m.day || ""}
                              onChange={(e) =>
                                updateEventMapping(ev.id, "day", e.target.value)
                              }
                              style={inputStyle}
                            >
                              <option value="">— Day —</option>
                              {DAYS.map((d) => (
                                <option key={d}>{d}</option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              type="time"
                              size="sm"
                              value={m.time || ""}
                              onChange={(e) =>
                                updateEventMapping(ev.id, "time", e.target.value)
                              }
                              style={inputStyle}
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Control
                              size="sm"
                              placeholder="Notes (optional)"
                              value={m.notes || ""}
                              onChange={(e) =>
                                updateEventMapping(ev.id, "notes", e.target.value)
                              }
                              style={inputStyle}
                            />
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="d-flex justify-content-end mt-3">
            <Button
              variant="primary"
              className="rounded-pill px-4"
              onClick={handleSave}
              disabled={saving}
            >
              <i className="bi bi-save me-2" />
              {saving ? "Saving…" : "Save Mapping"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
