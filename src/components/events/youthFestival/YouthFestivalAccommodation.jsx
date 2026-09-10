import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
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

const CHECK_IN_STATUSES = ["Expected", "Checked-in", "Checked-out"];

const statusVariant = (s) => {
  if (s === "Checked-in") return "success";
  if (s === "Checked-out") return "secondary";
  return "warning";
};

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

/**
 * Hostel Dean Module (Accommodation).
 * Manages accommodation facilities in Firestore (events/{eventId}/yf_facilities).
 * Shows only colleges that require accommodation with separate Boys & Girls counts.
 * Performs real-time optimistic state updates without full page reloads.
 */
export default function YouthFestivalAccommodation({ eventId, goBack }) {
  const { showSuccess, showError, confirm } = useToast();

  const [colleges, setColleges] = useState([]); // filtered: needsAccommodation only
  const [allotments, setAllotments] = useState([]); // from yf_accommodation_allotments
  const [facilities, setFacilities] = useState([]); // from yf_facilities
  const [loading, setLoading] = useState(true);

  // Selected college ID for reactivity
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const selectedCollege = colleges.find((c) => c.id === selectedCollegeId) || null;

  // Manage facility input
  const [newFacilityName, setNewFacilityName] = useState("");
  const [addingFacility, setAddingFacility] = useState(false);

  // Allotment form
  const [allotmentForm, setAllotmentForm] = useState({
    personName: "",
    personType: "participant", // 'participant' | 'incharge'
    facility: "",
    room: "",
    checkInStatus: "Expected",
  });
  const [editingAllotment, setEditingAllotment] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // ── Initial Fetch (Only on mount) ─────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Colleges requiring accommodation
      const collegeSnap = await getDocs(
        collection(db, "events", eventId, "yf_colleges")
      );
      const accColleges = await Promise.all(
        collegeSnap.docs
          .filter((d) => d.data().needsAccommodation)
          .map(async (d) => {
            const participants = (
              await getDocs(
                collection(db, "events", eventId, "yf_colleges", d.id, "participants")
              )
            ).docs.map((p) => ({ id: p.id, ...p.data() }));
            return { id: d.id, ...d.data(), participants };
          })
      );
      setColleges(accColleges);

      // 2. Fetch Facilities
      const facSnap = await getDocs(
        collection(db, "events", eventId, "yf_facilities")
      );
      const facList = facSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));
      setFacilities(facList);

      // 3. Fetch Allotments
      const allotSnap = await getDocs(
        collection(db, "events", eventId, "yf_accommodation_allotments")
      );
      setAllotments(allotSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      showError("Failed to load accommodation data.");
    } finally {
      setLoading(false);
    }
  }, [eventId, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Facility CRUD (Optimistic Local Updates) ──────────────
  const handleAddFacility = async () => {
    const name = newFacilityName.trim();
    if (!name) return;
    if (facilities.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      showError("A facility with this name already exists.");
      return;
    }
    setAddingFacility(true);
    try {
      const ref = await addDoc(
        collection(db, "events", eventId, "yf_facilities"),
        { name }
      );
      const newFac = { id: ref.id, name };
      setFacilities((prev) => [...prev, newFac]);
      setNewFacilityName("");
      // Pre-select facility in allotment form if empty
      if (!allotmentForm.facility) {
        setAllotmentForm((f) => ({ ...f, facility: name }));
      }
      showSuccess(`Facility "${name}" added.`);
    } catch {
      showError("Failed to add facility.");
    } finally {
      setAddingFacility(false);
    }
  };

  const handleDeleteFacility = async (fac) => {
    const ok = await confirm(`Delete facility "${fac.name}"?`, { variant: "danger" });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "yf_facilities", fac.id));
      setFacilities((prev) => prev.filter((f) => f.id !== fac.id));
      showSuccess("Facility deleted.");
    } catch {
      showError("Failed to delete facility.");
    }
  };

  // ── Allotment CRUD (Optimistic Local Updates) ─────────────
  const resetForm = () => {
    setAllotmentForm({
      personName: "",
      personType: "participant",
      facility: facilities[0]?.name || "",
      room: "",
      checkInStatus: "Expected",
    });
    setEditingAllotment(null);
    setShowForm(false);
  };

  const handleSaveAllotment = async () => {
    if (!allotmentForm.personName.trim() || !allotmentForm.room.trim() || !selectedCollege)
      return;
    const payload = {
      ...allotmentForm,
      collegeId: selectedCollege.id,
      collegeName: selectedCollege.name,
    };
    try {
      if (editingAllotment) {
        await updateDoc(
          doc(db, "events", eventId, "yf_accommodation_allotments", editingAllotment.id),
          payload
        );
        setAllotments((prev) =>
          prev.map((a) =>
            a.id === editingAllotment.id ? { ...a, ...payload } : a
          )
        );
        showSuccess("Allotment updated.");
      } else {
        const ref = await addDoc(
          collection(db, "events", eventId, "yf_accommodation_allotments"),
          payload
        );
        setAllotments((prev) => [...prev, { id: ref.id, ...payload }]);
        showSuccess("Allotment saved.");
      }
      resetForm();
    } catch {
      showError("Failed to save allotment.");
    }
  };

  const handleDeleteAllotment = async (a) => {
    const ok = await confirm(`Remove allotment for "${a.personName}"?`, {
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteDoc(
        doc(db, "events", eventId, "yf_accommodation_allotments", a.id)
      );
      setAllotments((prev) => prev.filter((item) => item.id !== a.id));
      showSuccess("Allotment removed.");
    } catch {
      showError("Failed to remove allotment.");
    }
  };

  const handleStatusChange = async (a, status) => {
    try {
      await updateDoc(
        doc(db, "events", eventId, "yf_accommodation_allotments", a.id),
        { checkInStatus: status }
      );
      setAllotments((prev) =>
        prev.map((item) =>
          item.id === a.id ? { ...item, checkInStatus: status } : item
        )
      );
      showSuccess(`Status set to ${status}.`);
    } catch {
      showError("Failed to update status.");
    }
  };

  const startEdit = (a) => {
    setAllotmentForm({
      personName: a.personName,
      personType: a.personType,
      facility: a.facility,
      room: a.room,
      checkInStatus: a.checkInStatus,
    });
    setEditingAllotment(a);
    setShowForm(true);
  };

  // ── Derived Data ──────────────────────────────────────────
  const collegeAllotments = selectedCollege
    ? allotments.filter((a) => a.collegeId === selectedCollege.id)
    : [];

  const personSuggestions = selectedCollege
    ? [
        ...(selectedCollege.participants || []).map((p) => ({
          label: `${p.name} (Participant)`,
          type: "participant",
          name: p.name,
        })),
        ...(selectedCollege.incharges || [])
          .filter((ic) => ic.name)
          .map((ic) => ({
            label: `${ic.name} (Incharge)`,
            type: "incharge",
            name: ic.name,
          })),
      ]
    : [];

  const q = searchQuery.toLowerCase();
  const filteredAllotments = q
    ? allotments.filter(
        (a) =>
          a.personName?.toLowerCase().includes(q) ||
          a.collegeName?.toLowerCase().includes(q) ||
          a.room?.toLowerCase().includes(q) ||
          a.facility?.toLowerCase().includes(q)
      )
    : [];

  // ── Renders ───────────────────────────────────────────────
  const renderCollegeList = () => (
    <div>
      <h6 className="fw-bold mb-3">
        Colleges Requiring Accommodation ({colleges.length})
      </h6>
      {colleges.length === 0 ? (
        <p className="text-muted">No colleges have requested accommodation.</p>
      ) : (
        colleges.map((c) => {
          const cAllotments = allotments.filter((a) => a.collegeId === c.id);
          const checkedIn = cAllotments.filter(
            (a) => a.checkInStatus === "Checked-in"
          ).length;
          const boys = c.accommodation?.boysCount || 0;
          const girls = c.accommodation?.girlsCount || 0;
          const total = c.accommodation?.contingentSize || boys + girls;

          return (
            <div
              key={c.id}
              className="p-3 rounded mb-2"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
              }}
              onClick={() => setSelectedCollegeId(c.id)}
            >
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <div className="fw-bold">{c.name}</div>
                  <div className="text-muted small mt-1">
                    <span className="me-3">
                      <i className="bi bi-gender-male me-1 text-primary" />
                      Boys: <strong>{boys}</strong>
                    </span>
                    <span className="me-3">
                      <i className="bi bi-gender-female me-1 text-danger" />
                      Girls: <strong>{girls}</strong>
                    </span>
                    <span>
                      Total: <strong>{total}</strong>
                    </span>
                    {c.accommodation?.arrivalDate && (
                      <span className="ms-3">
                        <i className="bi bi-calendar-event me-1" />
                        Arrives: {c.accommodation.arrivalDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <Badge bg="success">{checkedIn} checked in</Badge>
                  <Badge bg="secondary">{cAllotments.length} allotted</Badge>
                  <i className="bi bi-chevron-right text-muted" />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderCollegeDetail = () => {
    const c = selectedCollege;
    const boys = c.accommodation?.boysCount || 0;
    const girls = c.accommodation?.girlsCount || 0;
    const total = c.accommodation?.contingentSize || boys + girls;

    return (
      <div>
        {/* Header */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <Button
            variant="outline-secondary"
            size="sm"
            className="rounded-pill"
            onClick={() => setSelectedCollegeId(null)}
          >
            <i className="bi bi-arrow-left me-1" />
            All Colleges
          </Button>
          <h5 className="fw-bold mb-0">{c.name}</h5>
        </div>

        {/* Accommodation info with separate Boys/Girls counts */}
        {c.accommodation && (
          <div
            className="p-3 rounded mb-4"
            style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
          >
            <p className="text-muted small fw-bold mb-2">BOARDING &amp; ALLOTMENT REQUIREMENTS</p>
            <Row className="g-3">
              <Col xs={6} md={3}>
                <small className="text-muted d-block">
                  <i className="bi bi-gender-male me-1 text-primary" />
                  Boys Requiring Allotment
                </small>
                <span className="fw-bold fs-6 text-primary">{boys}</span>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">
                  <i className="bi bi-gender-female me-1 text-danger" />
                  Girls Requiring Allotment
                </small>
                <span className="fw-bold fs-6 text-danger">{girls}</span>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">Total Contingent</small>
                <span className="fw-bold fs-6">{total}</span>
              </Col>
              <Col xs={6} md={3}>
                <small className="text-muted d-block">Currently Allotted</small>
                <span className="fw-bold fs-6 text-success">{collegeAllotments.length}</span>
              </Col>

              {c.accommodation.arrivalDate && (
                <Col xs={6} md={3}>
                  <small className="text-muted d-block">Arrival</small>
                  <span className="fw-medium">
                    {c.accommodation.arrivalDate}
                    {c.accommodation.arrivalTime && ` at ${c.accommodation.arrivalTime}`}
                  </span>
                </Col>
              )}
              {c.accommodation.departureDate && (
                <Col xs={6} md={3}>
                  <small className="text-muted d-block">Departure</small>
                  <span className="fw-medium">{c.accommodation.departureDate}</span>
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Allotment form */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <p className="text-muted small fw-bold mb-0">
            ROOM ALLOTMENTS ({collegeAllotments.length})
          </p>
          <Button
            variant="primary"
            size="sm"
            className="rounded-pill"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <i className="bi bi-plus me-1" />
            Allot Room
          </Button>
        </div>

        {showForm && (
          <div
            className="p-3 rounded mb-3"
            style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
          >
            <p className="fw-bold small mb-3">
              {editingAllotment ? "Edit Allotment" : "New Room Allotment"}
            </p>
            <div className="d-grid gap-2">
              <Row className="g-2">
                <Col md={8}>
                  <Form.Label className="text-muted small">Person</Form.Label>
                  <Form.Control
                    list="person-suggestions"
                    placeholder="Name or select from student/incharge list"
                    value={allotmentForm.personName}
                    onChange={(e) =>
                      setAllotmentForm((f) => ({ ...f, personName: e.target.value }))
                    }
                    style={inputStyle}
                  />
                  <datalist id="person-suggestions">
                    {personSuggestions.map((ps, i) => (
                      <option key={i} value={ps.name} />
                    ))}
                  </datalist>
                </Col>
                <Col md={4}>
                  <Form.Label className="text-muted small">Type</Form.Label>
                  <Form.Select
                    value={allotmentForm.personType}
                    onChange={(e) =>
                      setAllotmentForm((f) => ({ ...f, personType: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="participant">Participant</option>
                    <option value="incharge">Incharge</option>
                  </Form.Select>
                </Col>
              </Row>
              <Row className="g-2">
                <Col md={5}>
                  <Form.Label className="text-muted small">Facility</Form.Label>
                  {facilities.length === 0 ? (
                    <Form.Control
                      placeholder="Add a facility above first"
                      disabled
                      style={inputStyle}
                    />
                  ) : (
                    <Form.Select
                      value={allotmentForm.facility}
                      onChange={(e) =>
                        setAllotmentForm((f) => ({ ...f, facility: e.target.value }))
                      }
                      style={inputStyle}
                    >
                      <option value="">— Select Facility —</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </Col>
                <Col md={3}>
                  <Form.Label className="text-muted small">Room No.</Form.Label>
                  <Form.Control
                    placeholder="e.g. 204"
                    value={allotmentForm.room}
                    onChange={(e) =>
                      setAllotmentForm((f) => ({ ...f, room: e.target.value }))
                    }
                    style={inputStyle}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label className="text-muted small">Status</Form.Label>
                  <Form.Select
                    value={allotmentForm.checkInStatus}
                    onChange={(e) =>
                      setAllotmentForm((f) => ({ ...f, checkInStatus: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    {CHECK_IN_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
              <div className="d-flex gap-2 mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAllotment}
                  disabled={
                    !allotmentForm.personName.trim() ||
                    !allotmentForm.room.trim() ||
                    !allotmentForm.facility
                  }
                >
                  {editingAllotment ? "Save" : "Allot"}
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Allotments list */}
        {collegeAllotments.length === 0 ? (
          <p className="text-muted small">No rooms allotted yet.</p>
        ) : (
          <div className="d-grid gap-2">
            {collegeAllotments.map((a) => (
              <div
                key={a.id}
                className="p-3 rounded d-flex align-items-center justify-content-between gap-2"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                <div>
                  <span className="fw-bold">{a.personName}</span>
                  <Badge bg="light" text="dark" className="ms-2">
                    {a.personType === "incharge" ? "Incharge" : "Participant"}
                  </Badge>
                  <div className="text-muted small mt-1">
                    <i className="bi bi-door-open me-1" />
                    {a.facility} — Room {a.room}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Form.Select
                    size="sm"
                    value={a.checkInStatus}
                    onChange={(e) => handleStatusChange(a, e.target.value)}
                    style={{ ...inputStyle, width: "auto" }}
                  >
                    {CHECK_IN_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Form.Select>
                  <Badge bg={statusVariant(a.checkInStatus)}>
                    {a.checkInStatus}
                  </Badge>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => startEdit(a)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteAllotment(a)}
                  >
                    <i className="bi bi-trash3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSearchResults = () => (
    <div>
      <h6 className="fw-bold mb-3">
        Search Results ({filteredAllotments.length})
      </h6>
      {filteredAllotments.length === 0 ? (
        <p className="text-muted">No matches found.</p>
      ) : (
        filteredAllotments.map((a) => (
          <div
            key={a.id}
            className="p-3 rounded mb-2"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <div className="fw-bold">{a.personName}</div>
            <small className="text-muted">
              {a.collegeName} • {a.facility} Room {a.room}
            </small>
            <div className="mt-1">
              <Badge bg={statusVariant(a.checkInStatus)}>{a.checkInStatus}</Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* Page header */}
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
          <small className="text-muted text-uppercase fw-bold">
            Youth Festival — Hostel Dean Module
          </small>
          <h4 className="fw-bold mb-0">Accommodation</h4>
        </div>
      </div>

      {/* ── Manage Facilities (Firebase only) ────────────────── */}
      <div
        className="p-3 rounded mb-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <p className="text-muted small fw-bold mb-3">
          <i className="bi bi-house-door-fill me-1 text-primary" />
          MANAGE ACCOMMODATION FACILITIES
        </p>
        <InputGroup className="mb-3">
          <Form.Control
            placeholder="Enter facility name (e.g. Boys Hostel 1, Guest House)"
            value={newFacilityName}
            onChange={(e) => setNewFacilityName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddFacility()}
            style={inputStyle}
          />
          <Button
            variant="primary"
            onClick={handleAddFacility}
            disabled={!newFacilityName.trim() || addingFacility}
          >
            <i className="bi bi-plus me-1" />
            Add Facility
          </Button>
        </InputGroup>

        {facilities.length === 0 ? (
          <p className="text-muted small mb-0">
            No facilities added yet. Add facilities here to enable room allotments.
          </p>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {facilities.map((f) => (
              <div
                key={f.id}
                className="d-flex align-items-center gap-1 px-2 py-1 rounded"
                style={{
                  background: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <i className="bi bi-building text-primary small" />
                <span className="small fw-medium">{f.name}</span>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 ms-1 text-danger"
                  onClick={() => handleDeleteFacility(f)}
                  title="Delete facility"
                >
                  <i className="bi bi-x" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      <InputGroup className="mb-4 shadow-sm">
        <InputGroup.Text style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <i className="bi bi-search text-muted" />
        </InputGroup.Text>
        <Form.Control
          placeholder="Search by name, college, room, facility…"
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

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : q.length >= 2 ? (
        renderSearchResults()
      ) : selectedCollege ? (
        renderCollegeDetail()
      ) : (
        renderCollegeList()
      )}
    </>
  );
}
