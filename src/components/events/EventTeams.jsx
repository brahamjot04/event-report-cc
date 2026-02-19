import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  Table,
  Button,
  Modal,
  Form,
  Badge,
  Row,
  Col,
  Dropdown,
  Card,
} from "react-bootstrap";
import readXlsxFile from "read-excel-file";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function EventTeams({ eventId, eventTitle, goBack }) {
  const [teams, setTeams] = useState([]);

  // Modal States
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Form States
  const [newTeamName, setNewTeamName] = useState("");

  const [activeTeam, setActiveTeam] = useState(null);
  const [editingMemberIndex, setEditingMemberIndex] = useState(null);

  const [memberForm, setMemberForm] = useState({
    name: "",
    urn: "",
    phone: "",
    branch: "",
    designation: "",
  });

  useEffect(() => {
    fetchTeams();
  }, [eventId]);

  const fetchTeams = async () => {
    const querySnapshot = await getDocs(
      collection(db, "events", eventId, "teams"),
    );
    const teamList = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const coreTeam = teamList.find(
      (t) => t.name.trim().toLowerCase() === "core team",
    );
    const otherTeams = teamList.filter(
      (t) => t.name.trim().toLowerCase() !== "core team",
    );

    if (coreTeam) {
      setTeams([coreTeam, ...otherTeams]);
    } else {
      setTeams(teamList);
    }
  };

  // --- TEAM MANAGEMENT ---
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    await addDoc(collection(db, "events", eventId, "teams"), {
      name: newTeamName,
      members: [],
    });
    setNewTeamName("");
    setShowTeamModal(false);
    fetchTeams();
  };

  const handleDeleteTeam = async (e, teamId) => {
    e.stopPropagation();
    if (window.confirm("Delete this team and all its members?")) {
      await deleteDoc(doc(db, "events", eventId, "teams", teamId));
      fetchTeams();
      if (activeTeam?.id === teamId) setActiveTeam(null);
    }
  };

  const openTeamDetails = (team) => {
    setActiveTeam(team);
  };

  // --- MEMBER MANAGEMENT ---
  const handleSaveMember = async () => {
    if (!activeTeam || !memberForm.name) return;

    const updatedMembers = [...(activeTeam.members || [])];

    if (editingMemberIndex !== null) {
      updatedMembers[editingMemberIndex] = memberForm;
    } else {
      updatedMembers.push(memberForm);
    }

    await updateDoc(doc(db, "events", eventId, "teams", activeTeam.id), {
      members: updatedMembers,
    });

    setActiveTeam({ ...activeTeam, members: updatedMembers });
    setShowMemberModal(false);
    fetchTeams();
  };

  const handleDeleteMember = async (memberIndex) => {
    if (window.confirm("Remove this member?")) {
      const updatedMembers = activeTeam.members.filter(
        (_, idx) => idx !== memberIndex,
      );
      await updateDoc(doc(db, "events", eventId, "teams", activeTeam.id), {
        members: updatedMembers,
      });
      setActiveTeam({ ...activeTeam, members: updatedMembers });
      fetchTeams();
    }
  };

  const openAddMemberModal = () => {
    setEditingMemberIndex(null);
    setMemberForm({
      name: "",
      urn: "",
      phone: "",
      branch: "",
      designation: "",
    });
    setShowMemberModal(true);
  };

  const openEditMemberModal = (member, index) => {
    setEditingMemberIndex(index);
    setMemberForm(member);
    setShowMemberModal(true);
  };

  // --- FILE HANDLING ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeTeam) return;

    readXlsxFile(file).then(async (rows) => {
      const headers = rows[0].map((h) => String(h).toLowerCase());
      const getIdx = (k) =>
        headers.findIndex((h) => k.some((x) => h.includes(x)));

      const idx = {
        name: getIdx(["name", "student"]),
        urn: getIdx(["urn", "roll"]),
        phone: getIdx(["phone", "mobile", "contact"]),
        branch: getIdx(["branch", "stream", "department"]),
        desig: getIdx(["designation", "role", "position"]),
      };

      const newMembers = rows
        .slice(1)
        .map((row) => ({
          name: idx.name > -1 ? row[idx.name] : "",
          urn: idx.urn > -1 ? row[idx.urn] : "",
          phone: idx.phone > -1 ? row[idx.phone] : "",
          branch: idx.branch > -1 ? row[idx.branch] : "",
          designation: idx.desig > -1 ? row[idx.desig] : "",
        }))
        .filter((m) => m.name);

      const updatedMembers = [...(activeTeam.members || []), ...newMembers];

      await updateDoc(doc(db, "events", eventId, "teams", activeTeam.id), {
        members: updatedMembers,
      });

      setActiveTeam({ ...activeTeam, members: updatedMembers });
      fetchTeams();
      alert(`Imported ${newMembers.length} members!`);
      e.target.value = "";
    });
  };

  // --- PDF GENERATION ---
  const generateAllTeamsPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Team Details Report`, 14, 15);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Event: ${eventTitle || "Event Details"}`, 14, 22);

    let finalY = 30;

    teams.forEach((team) => {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Team: ${team.name}`, 14, finalY);
      finalY += 3;

      const rows = (team.members || []).map((m, i) => [
        i + 1,
        m.name,
        m.urn || "-",
        m.branch || "-",
        m.designation || "-",
      ]);

      if (rows.length > 0) {
        autoTable(doc, {
          startY: finalY,
          head: [["S.No", "Student Name", "URN", "Branch", "Designation"]],
          body: rows,
          theme: "grid",
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 14, right: 14 },
        });
        finalY = doc.lastAutoTable.finalY + 15;
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("(No members)", 14, finalY + 5);
        finalY += 15;
      }
    });

    doc.save(`Teams_Report.pdf`);
  };

  const getInitials = (name) =>
    name ? name.substring(0, 2).toUpperCase() : "TM";

  // --- RENDER: TEAM DETAILS PAGE VIEW ---
  if (activeTeam) {
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
            onClick={() => setActiveTeam(null)}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <div>
            <h3 className="fw-bold mb-0">{activeTeam.name}</h3>
            <p className="text-muted small mb-0">
              {activeTeam.members?.length || 0} Members
            </p>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Button
              variant="primary"
              onClick={openAddMemberModal}
              className="d-flex align-items-center gap-2"
            >
              <i className="bi bi-person-plus-fill"></i>
              <span className="d-none d-md-inline">Add Member</span>
            </Button>
            <div className="d-inline-block">
              <input
                type="file"
                id="team-upload"
                hidden
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="team-upload"
                className="btn btn-success text-white mb-0 d-flex align-items-center gap-2"
              >
                <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                <span className="d-none d-md-inline">Import Excel</span>
              </label>
            </div>
          </div>
        </div>

        {/* Members Table */}
        <div
          className="soft-card p-0 overflow-hidden shadow-sm"
          style={{ height: "fit-content" }}
        >
          <Table hover responsive className="mb-0 align-middle">
            <thead style={{ backgroundColor: "var(--soft-hover)" }}>
              <tr>
                <th
                  className="ps-4 py-3 text-secondary text-uppercase small text-start"
                  style={{ width: "5%" }}
                >
                  #
                </th>
                <th className="text-secondary text-uppercase small text-start">
                  Name
                </th>
                <th className="text-secondary text-uppercase small text-start">
                  URN
                </th>
                <th className="text-secondary text-uppercase small text-start">
                  Branch
                </th>
                <th className="text-secondary text-uppercase small text-start">
                  Designation
                </th>
                <th className="text-end pe-4 text-secondary text-uppercase small">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {!activeTeam.members || activeTeam.members.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-4 text-muted border-0"
                  >
                    <i className="bi bi-people display-4 opacity-25 d-block mb-3 mt-2"></i>
                    No members in this team yet.
                  </td>
                </tr>
              ) : (
                activeTeam.members.map((member, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <td className="ps-4 text-muted text-start">{idx + 1}</td>
                    <td className="fw-bold text-body text-start">
                      {member.name}
                    </td>
                    <td className="text-muted text-start">
                      <code className="text-primary">{member.urn}</code>
                    </td>
                    <td className="text-muted small text-start">
                      {member.branch || "-"}
                    </td>
                    <td className="text-start">
                      {member.designation ? (
                        <Badge
                          bg="light"
                          text="dark"
                          className="border fw-normal"
                        >
                          {member.designation}
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
                          onClick={() => openEditMemberModal(member, idx)}
                        >
                          <i className="bi bi-pencil-fill"></i>
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          className="border-0 bg-transparent text-danger p-1"
                          onClick={() => handleDeleteMember(idx)}
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

        {/* Member Modal */}
        <Modal
          show={showMemberModal}
          onHide={() => setShowMemberModal(false)}
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
                {editingMemberIndex !== null ? "Edit" : "Add"} Member
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4 text-start">
              <Form className="d-grid gap-3">
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">
                    FULL NAME
                  </Form.Label>
                  <Form.Control
                    placeholder="Name"
                    className="form-control"
                    style={{
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                    value={memberForm.name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, name: e.target.value })
                    }
                  />
                </Form.Group>
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        URN
                      </Form.Label>
                      <Form.Control
                        placeholder="URN"
                        className="form-control"
                        style={{
                          backgroundColor: "var(--bg-main)",
                          color: "var(--text-primary)",
                          borderColor: "var(--border-color)",
                        }}
                        value={memberForm.urn}
                        onChange={(e) =>
                          setMemberForm({ ...memberForm, urn: e.target.value })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        PHONE
                      </Form.Label>
                      <Form.Control
                        placeholder="Phone"
                        className="form-control"
                        style={{
                          backgroundColor: "var(--bg-main)",
                          color: "var(--text-primary)",
                          borderColor: "var(--border-color)",
                        }}
                        value={memberForm.phone}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        BRANCH
                      </Form.Label>
                      <Form.Control
                        placeholder="Branch"
                        className="form-control"
                        style={{
                          backgroundColor: "var(--bg-main)",
                          color: "var(--text-primary)",
                          borderColor: "var(--border-color)",
                        }}
                        value={memberForm.branch}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            branch: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        DESIGNATION
                      </Form.Label>
                      <Form.Select
                        className="form-select"
                        style={{
                          backgroundColor: "var(--bg-main)",
                          color: "var(--text-primary)",
                          borderColor: "var(--border-color)",
                        }}
                        value={memberForm.designation}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            designation: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Designation</option>
                        <option value="member">Member</option>
                        <option value="senior">Senior</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="primary"
                onClick={handleSaveMember}
                className="w-100"
              >
                Save Member
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      </>
    );
  }

  // --- RENDER: TEAMS GRID VIEW ---
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
          <h3 className="fw-bold mb-0">Organizing Teams</h3>
          <p className="text-muted small mb-0">Manage committees and members</p>
        </div>
        <div className="ms-auto d-flex gap-2">
          <Button
            variant="outline-danger"
            onClick={generateAllTeamsPDF}
            size="sm"
            className="d-flex align-items-center"
          >
            <i className="bi bi-file-earmark-pdf me-2"></i>Export Report
          </Button>
        </div>
      </div>

      <Row className="g-4">
        {/* Create Team Card (render first) */}
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
              setNewTeamName("");
              setShowTeamModal(true);
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
            <h6 className="fw-bold mb-1">Create New Team</h6>
            <small>Add committee or group</small>
          </div>
        </Col>

        {teams.map((team) => (
          <Col md={6} lg={4} key={team.id}>
            {/* FIX: Moved onClick from button to the whole card */}
            <div
              className="soft-card h-100 d-flex flex-column position-relative"
              style={{ minHeight: "180px", cursor: "pointer" }}
              onClick={() => openTeamDetails(team)}
            >
              {/* Team Actions Dropdown */}
              <div className="position-absolute top-0 end-0 p-3">
                <Dropdown onClick={(e) => e.stopPropagation()}>
                  <Dropdown.Toggle
                    variant="link"
                    className="text-muted p-0 no-caret"
                  >
                    <i className="bi bi-three-dots"></i>
                  </Dropdown.Toggle>
                  <Dropdown.Menu align="end">
                    <Dropdown.Item
                      className="text-danger"
                      onClick={(e) => handleDeleteTeam(e, team.id)}
                    >
                      <i className="bi bi-trash me-2"></i>Delete Team
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>

              <div className="d-flex align-items-center mb-3 mt-2">
                <div
                  className="avatar-circle me-3 flex-shrink-0"
                  style={{
                    width: "50px",
                    height: "50px",
                    fontSize: "1.2rem",
                    backgroundColor: "var(--soft-hover)",
                    color: "var(--text-primary)",
                  }}
                >
                  {getInitials(team.name)}
                </div>
                <div className="text-start">
                  <h5
                    className="fw-bold mb-1 text-truncate"
                    style={{ maxWidth: "180px" }}
                  >
                    {team.name}
                  </h5>
                  <Badge
                    bg="primary"
                    className="bg-opacity-25 text-primary fw-normal border border-primary"
                  >
                    {team.members?.length || 0} Members
                  </Badge>
                </div>
              </div>

              <div
                className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="d-flex align-items-center">
                  {/* Tiny avatars for visual effect */}
                  <div className="d-flex ms-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-circle border border-white d-flex align-items-center justify-content-center text-white small"
                        style={{
                          width: "24px",
                          height: "24px",
                          marginLeft: "-8px",
                          backgroundColor: "#adb5bd",
                          fontSize: "0.6rem",
                        }}
                      >
                        <i className="bi bi-person-fill"></i>
                      </div>
                    ))}
                  </div>
                </div>
                {/* FIX: Button is now just visual, action is on the card */}
                <Button size="sm" className="soft-open-btn rounded-pill px-3">
                  Manage <i className="bi bi-arrow-right ms-1"></i>
                </Button>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* --- MODALS --- */}

      {/* 1. CREATE TEAM MODAL */}
      <Modal
        show={showTeamModal}
        onHide={() => setShowTeamModal(false)}
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
            <Modal.Title className="fw-bold h5 text-start">
              Create New Team
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 text-start">
            <Form.Group>
              <Form.Label className="small fw-bold text-muted">
                TEAM NAME
              </Form.Label>
              <Form.Control
                placeholder="e.g. Discipline Committee"
                className="form-control"
                style={{
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border-color)",
                }}
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0">
            <Button
              variant="primary"
              onClick={handleCreateTeam}
              className="w-100"
            >
              Create Team
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}
