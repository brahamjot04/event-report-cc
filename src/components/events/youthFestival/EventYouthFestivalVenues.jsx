import { useState, useEffect, useCallback } from "react";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { loadWithCache, invalidateCache } from "../../../utils/dataCache";
import {
  Button,
  Form,
  Badge,
  Spinner,
  Row,
  Col,
  InputGroup,
  Table,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { logAction } from "../../../utils/logger";
import { YF_EVENTS, YF_CATEGORIES, YF_EVENTS_BY_ID } from "../../../constants/youthFestivalEvents";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

const DAYS = ["Day 1", "Day 2", "Day 3"];

/**
 * Maps each Youth Festival event → Venue + Day + Time + Notes.
 * Includes List View and Timetable Grid View.
 */
export default function EventYouthFestivalVenues({ eventId, goBack }) {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [mapping, setMapping] = useState({});
  const [venues, setVenues] = useState([]);
  const [newVenueName, setNewVenueName] = useState("");
  const [addingVenue, setAddingVenue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View mode: 'list' | 'grid'
  const [viewMode, setViewMode] = useState("list");

  // ── Fetch venues ──────────────────────────────────────────
  const fetchVenues = useCallback(async () => {
    loadWithCache(
      `yf_venues_${eventId}`,
      async () => {
        const snap = await getDocs(collection(db, "events", eventId, "yf_venues"));
        return snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
      },
      (data) => setVenues(data),
      () => showError("Failed to load venues.")
    );
  }, [eventId, showError]);

  // ── Fetch mapping ─────────────────────────────────────────
  const fetchMapping = useCallback(async () => {
    loadWithCache(
      `yf_venue_mapping_${eventId}`,
      async () => {
        const docRef = doc(db, "events", eventId, "meta", "yf_venue_mapping");
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data().mapping || {} : {};
      },
      (data, isCached) => {
        setMapping(data);
        if (isCached) setLoading(false);
      },
      () => showError("Failed to load venue mapping.")
    );
    setLoading(false);
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
      invalidateCache(`yf_venues_${eventId}`);
      await logAction("ADD_VENUE", `Added venue "${name}" for festival`, user);
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
      invalidateCache(`yf_venues_${eventId}`);
      invalidateCache(`yf_venue_mapping_${eventId}`);
      await logAction("DELETE_VENUE", `Deleted venue "${venue.name}"`, user);
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
      invalidateCache(`yf_venue_mapping_${eventId}`);
      await logAction("SAVE_VENUE_MAPPING", `Updated festival venue and schedule mappings`, user);
      showSuccess("Venue mapping saved.");
    } catch {
      showError("Failed to save venue mapping.");
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = YF_EVENTS.filter((ev) => mapping[ev.id]?.venueId).length;

  // Conflict calculation
  const conflicts = {};
  YF_EVENTS.forEach((ev1) => {
    const m1 = mapping[ev1.id];
    if (!m1?.venueId || !m1?.day || !m1?.time) return;
    YF_EVENTS.forEach((ev2) => {
      if (ev1.id === ev2.id) return;
      const m2 = mapping[ev2.id];
      if (
        m2?.venueId === m1.venueId &&
        m2?.day === m1.day &&
        m2?.time === m1.time
      ) {
        conflicts[ev1.id] = true;
      }
    });
  });
  const conflictCount = Object.keys(conflicts).length;

  // ── Render Timetable Grid View ──────────────────────────────
  const renderTimetableGrid = () => (
    <div className="table-responsive">
      <Table
        bordered
        hover
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-primary)",
          borderColor: "var(--border-color)",
        }}
      >
        <thead>
          <tr className="bg-body-tertiary">
            <th style={{ width: "20%" }}>Venue</th>
            {DAYS.map((day) => (
              <th key={day} style={{ width: "26.6%" }} className="text-center">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => (
            <tr key={v.id}>
              <td className="fw-bold align-middle">
                <i className="bi bi-geo-alt-fill text-primary me-2" />
                {v.name}
              </td>
              {DAYS.map((day) => {
                // Find all events mapped to (this venue, this day)
                const mappedEvents = YF_EVENTS.filter((ev) => {
                  const m = mapping[ev.id];
                  return m && m.venueId === v.id && m.day === day;
                }).sort((a, b) => {
                  const tA = mapping[a.id]?.time || "";
                  const tB = mapping[b.id]?.time || "";
                  return tA.localeCompare(tB);
                });

                return (
                  <td key={day} className="p-2 align-top">
                    {mappedEvents.length === 0 ? (
                      <small className="text-muted italic d-block text-center py-2">
                        — Empty —
                      </small>
                    ) : (
                      mappedEvents.map((ev) => {
                        const m = mapping[ev.id];
                        const isConflicting = conflicts[ev.id];
                        return (
                          <div
                            key={ev.id}
                            className={`p-2 rounded mb-2 shadow-sm ${
                              isConflicting ? "border-danger border-2" : ""
                            }`}
                            style={{
                              background: isConflicting ? "var(--badge-past-bg)" : "var(--bg-main)",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="fw-bold small">{ev.name}</span>
                              {isConflicting && (
                                <Badge bg="danger" style={{ fontSize: "0.65em" }}>
                                  ⚠️ Conflict
                                </Badge>
                              )}
                            </div>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                              <Badge bg="info" text="dark" style={{ fontSize: "0.7em" }}>
                                {ev.category}
                              </Badge>
                              {m.time && (
                                <small className="fw-semibold text-primary">
                                  <i className="bi bi-clock me-1" />
                                  {m.time}
                                </small>
                              )}
                            </div>
                            {m.notes && (
                              <small className="text-muted d-block mt-1 italic">
                                Note: {m.notes}
                              </small>
                            )}
                          </div>
                        );
                      })
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

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
          {conflictCount > 0 && (
            <Badge bg="danger" className="p-2">
              <i className="bi bi-exclamation-triangle-fill me-1" />
              {conflictCount} Time Conflicts
            </Badge>
          )}
          <Badge bg="secondary">
            {mappedCount} / {YF_EVENTS.length} mapped
          </Badge>
          <Button
            variant="primary"
            className="px-4"
            onClick={handleSave}
            disabled={saving}
          >
            <i className="bi bi-save me-2" />
            {saving ? "Saving…" : "Save Mapping"}
          </Button>
        </div>
      </div>

      {/* Top Conflict Alert */}
      {conflictCount > 0 && (
        <div
          className="p-3 rounded mb-4 d-flex align-items-center gap-3 text-danger border-danger"
          style={{
            background: "var(--badge-past-bg)",
            border: "1px solid var(--badge-past-text)",
          }}
        >
          <i className="bi bi-exclamation-triangle-fill fs-3 flex-shrink-0" />
          <div>
            <div className="fw-bold">Schedule Time Conflict Detected!</div>
            <small>
              {conflictCount} events share the exact same venue, day, and time slot. Check highlighted items below.
            </small>
          </div>
        </div>
      )}

      {/* View Switcher: List vs Timetable Grid */}
      <div
        className="d-flex gap-2 mb-4"
        style={{ borderBottom: "2px solid var(--border-color)" }}
      >
        <button
          className={`btn btn-sm px-3 pb-2 rounded-0 border-0 fw-bold ${
            viewMode === "list"
              ? "text-primary border-bottom border-2 border-primary"
              : "text-muted"
          }`}
          style={{ marginBottom: -2 }}
          onClick={() => setViewMode("list")}
        >
          <i className="bi bi-list-task me-2" />
          List View (Edit Mapping)
        </button>
        <button
          className={`btn btn-sm px-3 pb-2 rounded-0 border-0 fw-bold ${
            viewMode === "grid"
              ? "text-primary border-bottom border-2 border-primary"
              : "text-muted"
          }`}
          style={{ marginBottom: -2 }}
          onClick={() => setViewMode("grid")}
        >
          <i className="bi bi-grid-3x3-gap-fill me-2" />
          Timetable Grid View
        </button>
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

      {/* ── Main Content Area ──────────────────────────────── */}
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
      ) : viewMode === "grid" ? (
        renderTimetableGrid()
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
                          {conflicts[ev.id] && (
                            <Badge bg="danger">
                              ⚠️ Time Conflict
                            </Badge>
                          )}
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
              className="px-4"
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
