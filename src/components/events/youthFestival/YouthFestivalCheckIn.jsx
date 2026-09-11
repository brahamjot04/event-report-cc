import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  updateDoc,
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
  Table,
  Modal,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { logAction } from "../../../utils/logger";
import { YF_EVENTS_BY_ID } from "../../../constants/youthFestivalEvents";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

function downloadCsv(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function YouthFestivalCheckIn({ eventId, goBack }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'arrived' | 'pending'
  const [searchQuery, setSearchQuery] = useState("");
  const [roomMap, setRoomMap] = useState({});

  // Modals state
  const [inspectCollege, setInspectCollege] = useState(null);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [remarksCollege, setRemarksCollege] = useState(null);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // ── Fetch Colleges ──────────────────────────────────────────
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

  // ── Fetch Room Allotments ──────────────────────────────────
  const fetchRoomMap = useCallback(async () => {
    try {
      const snap = await getDocs(
        collection(db, "events", eventId, "yf_accommodation_allotments")
      );
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.participantId && data.room) {
          map[data.participantId] = data.room;
        }
      });
      setRoomMap(map);
    } catch {
      // non-fatal
    }
  }, [eventId]);

  useEffect(() => {
    fetchColleges();
    fetchRoomMap();
  }, [fetchColleges, fetchRoomMap]);

  // ── 1-Click Check-in Toggle ─────────────────────────────────
  const handleToggleCheckIn = async (college) => {
    const newStatus = !college.checkedIn;
    setUpdatingId(college.id);

    const now = new Date();
    const volunteerName =
      user?.displayName || user?.email?.split("@")[0] || "Desk Volunteer";

    const updateData = {
      checkedIn: newStatus,
      checkedInAt: newStatus ? now.toISOString() : null,
      checkedInBy: newStatus ? volunteerName : null,
    };

    try {
      await updateDoc(
        doc(db, "events", eventId, "yf_colleges", college.id),
        updateData
      );

      const updatedList = colleges.map((c) =>
        c.id === college.id ? { ...c, ...updateData } : c
      );
      setColleges(updatedList);
      setCachedColleges(eventId, updatedList);

      await logAction(
        newStatus ? "COLLEGE_CHECKIN" : "COLLEGE_CHECKOUT",
        `Marked contingent "${college.name}" (${college.code || "No Code"}) as ${newStatus ? "ARRIVED" : "PENDING"}`,
        user
      );

      showSuccess(
        newStatus
          ? `✓ "${college.name}" checked in successfully!`
          : `Marked "${college.name}" as pending arrival.`
      );
    } catch (e) {
      console.error(e);
      showError("Failed to update check-in status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Save Desk Remarks ───────────────────────────────────────
  const handleOpenRemarksModal = (college) => {
    setRemarksCollege(college);
    setRemarksDraft(college.deskRemarks || "");
  };

  const handleSaveRemarks = async () => {
    if (!remarksCollege) return;
    setSavingRemarks(true);
    try {
      await updateDoc(
        doc(db, "events", eventId, "yf_colleges", remarksCollege.id),
        { deskRemarks: remarksDraft.trim() }
      );
      const updatedList = colleges.map((c) =>
        c.id === remarksCollege.id
          ? { ...c, deskRemarks: remarksDraft.trim() }
          : c
      );
      setColleges(updatedList);
      setCachedColleges(eventId, updatedList);
      showSuccess("Desk remarks saved.");
      setRemarksCollege(null);
    } catch (e) {
      console.error(e);
      showError("Failed to save remarks.");
    } finally {
      setSavingRemarks(false);
    }
  };

  // ── CSV Export 1: Detailed Participant-by-Event Roster ─────
  const exportParticipantRosterCsv = () => {
    const rows = [
      [
        "S.No",
        "College Code",
        "College Name",
        "Arrival Status",
        "Category",
        "Event Name",
        "Participant Name",
        "Contact",
        "Role",
        "Allotted Room",
      ],
    ];

    let counter = 1;
    colleges.forEach((col) => {
      const colArrival = col.checkedIn ? "Arrived" : "Pending";
      (col.participants || []).forEach((p) => {
        const ev = YF_EVENTS_BY_ID[p.eventId];
        rows.push([
          counter++,
          `"${col.code || ""}"`,
          `"${col.name || ""}"`,
          `"${colArrival}"`,
          `"${ev?.category || "Other"}"`,
          `"${ev?.name || p.eventId || ""}"`,
          `"${p.name || ""}"`,
          `"${p.contact || ""}"`,
          `"${p.role === "A" ? "Accompanist" : "Participant"}"`,
          `"${roomMap[p.id] || "Not Allotted"}"`,
        ]);
      });
    });

    const csvContent = rows.map((e) => e.join(",")).join("\n");
    downloadCsv(`YouthFestival_Participants_Desk_Roster.csv`, csvContent);
    showSuccess("Participant Roster exported successfully!");
  };

  // ── CSV Export 2: College Contingent Summary Sheet ──────────
  const exportCollegeSummaryCsv = () => {
    const rows = [
      [
        "S.No",
        "College Code",
        "College Name",
        "Arrival Status",
        "Arrival Time",
        "Checked In By",
        "Contingent In-charges",
        "Phone Numbers",
        "Total Participants",
        "Needs Accommodation",
        "Desk Remarks",
      ],
    ];

    colleges.forEach((col, idx) => {
      const inchargeNames = (col.incharges || [])
        .map((ic) => ic.name)
        .filter(Boolean)
        .join("; ");
      const inchargePhones = (col.incharges || [])
        .map((ic) => ic.phone)
        .filter(Boolean)
        .join("; ");

      let formattedTime = "";
      if (col.checkedInAt) {
        const d = new Date(col.checkedInAt);
        formattedTime = !isNaN(d.getTime())
          ? d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
          : col.checkedInAt;
      }

      rows.push([
        idx + 1,
        `"${col.code || ""}"`,
        `"${col.name || ""}"`,
        `"${col.checkedIn ? "Arrived" : "Pending"}"`,
        `"${formattedTime}"`,
        `"${col.checkedInBy || ""}"`,
        `"${inchargeNames}"`,
        `"${inchargePhones}"`,
        col.participants?.length || 0,
        `"${col.needsAccommodation ? "Yes" : "No"}"`,
        `"${col.deskRemarks || ""}"`,
      ]);
    });

    const csvContent = rows.map((e) => e.join(",")).join("\n");
    downloadCsv(`YouthFestival_Colleges_Arrival_Summary.csv`, csvContent);
    showSuccess("College Summary exported successfully!");
  };

  // ── Metrics Calculation ─────────────────────────────────────
  const totalColleges = colleges.length;
  const arrivedColleges = colleges.filter((c) => c.checkedIn).length;
  const pendingColleges = totalColleges - arrivedColleges;
  const arrivedParticipants = colleges
    .filter((c) => c.checkedIn)
    .reduce((sum, c) => sum + (c.participants?.length || 0), 0);
  const totalParticipants = colleges.reduce(
    (sum, c) => sum + (c.participants?.length || 0),
    0
  );

  // ── Search & Filter ─────────────────────────────────────────
  const filteredColleges = colleges.filter((col) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (col.name || "").toLowerCase().includes(q) ||
      (col.code || "").toLowerCase().includes(q) ||
      (col.incharges || []).some(
        (ic) =>
          (ic.name || "").toLowerCase().includes(q) ||
          (ic.phone || "").toLowerCase().includes(q)
      );

    if (!matchSearch) return false;
    if (activeTab === "arrived") return col.checkedIn;
    if (activeTab === "pending") return !col.checkedIn;
    return true;
  });

  return (
    <div>
      {/* HEADER WITH BACK BUTTON & EXPORT BUTTONS */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Button
            variant="outline-secondary"
            className="rounded-pill px-3"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left me-1"></i> Back
          </Button>
          <div>
            <h3 className="fw-bold mb-0">Desk Check-in & Arrivals</h3>
            <p className="text-muted small mb-0">
              Real-time registration desk monitoring, attendance verification & roster exports
            </p>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-primary"
            size="sm"
            className="rounded-pill px-3"
            onClick={exportCollegeSummaryCsv}
            disabled={colleges.length === 0}
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i> Contingent Summary (CSV)
          </Button>
          <Button
            variant="success"
            size="sm"
            className="rounded-pill px-3"
            onClick={exportParticipantRosterCsv}
            disabled={colleges.length === 0}
          >
            <i className="bi bi-download me-1"></i> Participant Roster (CSV)
          </Button>
        </div>
      </div>

      {/* METRIC COUNTERS STRIP */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <div className="soft-card p-3 text-start">
            <small className="text-muted fw-bold text-uppercase" style={{ fontSize: "11px" }}>
              Total Colleges
            </small>
            <h3 className="fw-bold mb-0 mt-1">{totalColleges}</h3>
            <small className="text-muted">{totalParticipants} Participants</small>
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div
            className="soft-card p-3 text-start"
            style={{ borderLeft: "4px solid var(--bs-success)" }}
          >
            <small className="text-success fw-bold text-uppercase" style={{ fontSize: "11px" }}>
              Reported / Arrived
            </small>
            <h3 className="fw-bold text-success mb-0 mt-1">{arrivedColleges}</h3>
            <small className="text-muted">{arrivedParticipants} Present</small>
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div
            className="soft-card p-3 text-start"
            style={{ borderLeft: "4px solid var(--bs-warning)" }}
          >
            <small className="text-warning fw-bold text-uppercase" style={{ fontSize: "11px" }}>
              Pending Arrival
            </small>
            <h3 className="fw-bold text-warning mb-0 mt-1">{pendingColleges}</h3>
            <small className="text-muted">Teams Expected</small>
          </div>
        </Col>
        <Col xs={6} md={3}>
          <div className="soft-card p-3 text-start">
            <small className="text-muted fw-bold text-uppercase" style={{ fontSize: "11px" }}>
              Check-in Rate
            </small>
            <h3 className="fw-bold mb-0 mt-1">
              {totalColleges > 0 ? Math.round((arrivedColleges / totalColleges) * 100) : 0}%
            </h3>
            <small className="text-muted">Attendance Progress</small>
          </div>
        </Col>
      </Row>

      {/* SEARCH AND FILTER CHIPS */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant={activeTab === "all" ? "primary" : "outline-secondary"}
            className="rounded-pill px-3"
            onClick={() => setActiveTab("all")}
          >
            All Colleges ({totalColleges})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "arrived" ? "success" : "outline-secondary"}
            className="rounded-pill px-3"
            onClick={() => setActiveTab("arrived")}
          >
            <i className="bi bi-check-circle-fill me-1"></i> Arrived ({arrivedColleges})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "pending" ? "warning" : "outline-secondary"}
            className="rounded-pill px-3"
            onClick={() => setActiveTab("pending")}
          >
            <i className="bi bi-clock-history me-1"></i> Pending ({pendingColleges})
          </Button>
        </div>

        <InputGroup style={{ maxWidth: "340px" }}>
          <InputGroup.Text style={inputStyle}>
            <i className="bi bi-search text-muted"></i>
          </InputGroup.Text>
          <Form.Control
            placeholder="Search college, code, in-charge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={inputStyle}
          />
        </InputGroup>
      </div>

      {/* MAIN CHECK-IN TABLE */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : filteredColleges.length === 0 ? (
        <div className="soft-card text-center py-5 text-muted">
          <i className="bi bi-building-slash display-4 opacity-25 d-block mb-3"></i>
          {searchQuery
            ? "No colleges match your search criteria."
            : activeTab === "arrived"
            ? "No colleges have checked in yet."
            : activeTab === "pending"
            ? "All registered colleges have reported and checked in!"
            : "No colleges registered yet."}
        </div>
      ) : (
        <div className="soft-card p-0 overflow-hidden" style={{ height: "fit-content" }}>
          <Table hover responsive className="mb-0 align-middle">
            <thead style={{ backgroundColor: "var(--soft-hover)" }}>
              <tr className="small text-uppercase text-muted">
                <th className="ps-4 py-3 text-start">College Details</th>
                <th className="text-start">Contingent In-charge</th>
                <th className="text-center">Team Roster</th>
                <th className="text-center">Status</th>
                <th className="text-start">Arrival Info</th>
                <th className="text-end pe-4">Desk Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredColleges.map((col) => {
                const incharge = col.incharges?.[0];
                const isArrived = col.checkedIn;
                const isUpdating = updatingId === col.id;

                let arrivalTimeStr = "";
                if (col.checkedInAt) {
                  const d = new Date(col.checkedInAt);
                  arrivalTimeStr = !isNaN(d.getTime())
                    ? d.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                }

                return (
                  <tr
                    key={col.id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      backgroundColor: isArrived
                        ? "rgba(25, 135, 84, 0.03)"
                        : "transparent",
                    }}
                  >
                    {/* College Details */}
                    <td className="ps-4 py-3 text-start">
                      <div className="d-flex align-items-center gap-2">
                        {col.code && (
                          <Badge bg="secondary" className="fw-normal">
                            {col.code}
                          </Badge>
                        )}
                        <span className="fw-bold text-body">{col.name}</span>
                      </div>
                      {col.deskRemarks && (
                        <div className="small text-muted mt-1 fst-italic">
                          <i className="bi bi-chat-left-text me-1"></i>
                          {col.deskRemarks}
                        </div>
                      )}
                    </td>

                    {/* Contingent In-charge */}
                    <td className="text-start small">
                      {incharge ? (
                        <>
                          <div className="fw-semibold text-body">
                            {incharge.name}
                          </div>
                          {incharge.phone && (
                            <a
                              href={`tel:${incharge.phone}`}
                              className="text-primary text-decoration-none"
                            >
                              <i className="bi bi-telephone-fill me-1"></i>
                              {incharge.phone}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">Not specified</span>
                      )}
                    </td>

                    {/* Team Roster */}
                    <td className="text-center">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="rounded-pill px-2 py-1 small"
                        style={{ fontSize: "12px" }}
                        onClick={() => {
                          setInspectCollege(col);
                          setShowInspectModal(true);
                        }}
                      >
                        <i className="bi bi-people me-1"></i>
                        {col.participants?.length || 0} Members
                      </Button>
                      {col.needsAccommodation && (
                        <div className="small text-primary mt-1" style={{ fontSize: "11px" }}>
                          <i className="bi bi-house me-1"></i> Hostel Req.
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="text-center">
                      {isArrived ? (
                        <Badge
                          bg="success"
                          className="bg-opacity-10 text-success rounded-pill px-3 py-2"
                        >
                          <i className="bi bi-check-circle-fill me-1"></i> Arrived
                        </Badge>
                      ) : (
                        <Badge
                          bg="warning"
                          className="bg-opacity-10 text-warning rounded-pill px-3 py-2"
                        >
                          <i className="bi bi-clock me-1"></i> Pending
                        </Badge>
                      )}
                    </td>

                    {/* Arrival Info */}
                    <td className="text-start small text-muted">
                      {isArrived ? (
                        <div>
                          <div className="text-body fw-semibold">
                            {arrivalTimeStr || "Reported"}
                          </div>
                          <div style={{ fontSize: "11px" }}>
                            by {col.checkedInBy || "Desk"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted opacity-75">—</span>
                      )}
                    </td>

                    {/* Desk Actions */}
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-2 align-items-center">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="rounded-pill px-2"
                          title="Add / Edit Desk Notes"
                          onClick={() => handleOpenRemarksModal(col)}
                        >
                          <i className="bi bi-pencil-square"></i>
                        </Button>

                        {isArrived ? (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="rounded-pill px-3"
                            disabled={isUpdating}
                            onClick={() => handleToggleCheckIn(col)}
                          >
                            {isUpdating ? (
                              <Spinner size="sm" animation="border" />
                            ) : (
                              "Undo"
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="success"
                            size="sm"
                            className="rounded-pill px-3"
                            disabled={isUpdating}
                            onClick={() => handleToggleCheckIn(col)}
                          >
                            {isUpdating ? (
                              <Spinner size="sm" animation="border" />
                            ) : (
                              <>
                                <i className="bi bi-check-lg me-1"></i> Check In
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* INSPECT PARTICIPANTS MODAL */}
      <Modal
        show={showInspectModal}
        onHide={() => setShowInspectModal(false)}
        size="lg"
        centered
      >
        <div
          className="soft-card border-0"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold">
              <i className="bi bi-people-fill me-2 text-primary"></i>
              {inspectCollege?.name} — Participant Roster
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-start pt-3">
            {inspectCollege && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted small">
                    Total Registered: <strong>{inspectCollege.participants?.length || 0}</strong>
                  </span>
                  <Badge bg={inspectCollege.checkedIn ? "success" : "warning"}>
                    {inspectCollege.checkedIn ? "Contingent Arrived" : "Pending Arrival"}
                  </Badge>
                </div>

                <div
                  className="rounded overflow-hidden border"
                  style={{
                    borderColor: "var(--border-color)",
                    maxHeight: "340px",
                    overflowY: "auto",
                  }}
                >
                  <Table hover size="sm" className="mb-0 align-middle">
                    <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                      <tr className="small text-muted">
                        <th className="ps-3 py-2">S.No</th>
                        <th>Participant Name</th>
                        <th>Role</th>
                        <th>Event Item</th>
                        <th>Contact</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inspectCollege.participants || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-muted">
                            No participants registered for this college.
                          </td>
                        </tr>
                      ) : (
                        (inspectCollege.participants || []).map((p, idx) => {
                          const ev = YF_EVENTS_BY_ID[p.eventId];
                          return (
                            <tr key={p.id || idx}>
                              <td className="ps-3 py-2 small text-muted">{idx + 1}</td>
                              <td className="fw-semibold text-body small">{p.name}</td>
                              <td>
                                <Badge
                                  bg={p.role === "A" ? "secondary" : "primary"}
                                  className="small"
                                >
                                  {p.role === "A" ? "Accompanist" : "Participant"}
                                </Badge>
                              </td>
                              <td className="small text-muted">{ev?.name || p.eventId || "—"}</td>
                              <td className="small text-muted">{p.contact || "—"}</td>
                              <td className="small text-muted">{roomMap[p.id] || "—"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="secondary"
              className="rounded-pill px-4"
              onClick={() => setShowInspectModal(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      {/* EDIT DESK REMARKS MODAL */}
      <Modal
        show={!!remarksCollege}
        onHide={() => setRemarksCollege(null)}
        centered
      >
        <div
          className="soft-card border-0"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold">
              Desk Remarks — {remarksCollege?.name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-start pt-3">
            <Form.Group>
              <Form.Label className="small text-muted fw-bold">
                REMARKS / VERIFICATION NOTES
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Dossier submitted, ID cards stamped, payment verified..."
                value={remarksDraft}
                onChange={(e) => setRemarksDraft(e.target.value)}
                style={inputStyle}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="outline-secondary"
              className="rounded-pill px-3"
              onClick={() => setRemarksCollege(null)}
              disabled={savingRemarks}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="rounded-pill px-4"
              onClick={handleSaveRemarks}
              disabled={savingRemarks}
            >
              {savingRemarks ? "Saving..." : "Save Remarks"}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </div>
  );
}
