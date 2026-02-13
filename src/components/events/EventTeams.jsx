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
  Accordion,
  Table,
  Button,
  Modal,
  Form,
  FloatingLabel,
  Badge,
  Row,
  Col,
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

  // UPDATED: Added urn and phone back to state
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
    setTeams(teamList);
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
    }
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

    setShowMemberModal(false);
    fetchTeams();
  };

  const handleDeleteMember = async (team, memberIndex) => {
    if (window.confirm("Remove this member?")) {
      const updatedMembers = team.members.filter(
        (_, idx) => idx !== memberIndex,
      );
      await updateDoc(doc(db, "events", eventId, "teams", team.id), {
        members: updatedMembers,
      });
      fetchTeams();
    }
  };

  const openAddMemberModal = (team) => {
    setActiveTeam(team);
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

  const openEditMemberModal = (team, member, index) => {
    setActiveTeam(team);
    setEditingMemberIndex(index);
    setMemberForm(member);
    setShowMemberModal(true);
  };

  // --- FILE HANDLING ---
  const handleFileUpload = (e, team) => {
    const file = e.target.files[0];
    if (!file) return;

    readXlsxFile(file).then(async (rows) => {
      const headers = rows[0].map((h) => String(h).toLowerCase());
      const getIdx = (k) =>
        headers.findIndex((h) => k.some((x) => h.includes(x)));

      // UPDATED: Look for all fields
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

      const updatedMembers = [...(team.members || []), ...newMembers];

      await updateDoc(doc(db, "events", eventId, "teams", team.id), {
        members: updatedMembers,
      });

      alert(`Imported ${newMembers.length} members to ${team.name}!`);
      fetchTeams();
      e.target.value = "";
    });
  };

  const generateTeamPDF = (team) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Team List: ${team.name}`, 14, 15);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Event: ${eventTitle || "Event Details"}`, 14, 22);

    // UPDATED: EXCLUDED Phone, Included URN
    const rows = (team.members || []).map((m, i) => [
      i + 1,
      m.name,
      m.urn || "-",
      m.branch || "-",
      m.designation || "-",
    ]);

    autoTable(doc, {
      head: [["S.No", "Student Name", "URN", "Branch", "Designation"]],
      body: rows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`${team.name}_Members.pdf`);
  };

  return (
    <>
      {/* HEADER */}
      <div className="d-flex align-items-center mb-4 justify-content-between">
        <div className="d-flex align-items-center">
          <Button
            variant="outline-secondary"
            className="me-3 rounded-circle"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
          <h3 className="fw-bold mb-0">Team Details</h3>
        </div>
        <Button onClick={() => setShowTeamModal(true)}>
          <i className="bi bi-plus-lg me-2"></i>Create Team
        </Button>
      </div>

      {/* TEAMS LIST (Accordion) */}
      <Accordion defaultActiveKey="0">
        {teams.map((team, idx) => (
          <Accordion.Item
            eventKey={idx.toString()}
            key={team.id}
            className="mb-3 border-0 shadow-sm"
          >
            <Accordion.Header>
              <div className="d-flex justify-content-between align-items-center w-100 me-3">
                <span className="fw-bold">{team.name}</span>
                <div className="d-flex align-items-center gap-2">
                  <Badge bg="primary" pill>
                    {team.members?.length || 0}
                  </Badge>
                  <Button
                    size="sm"
                    variant="link"
                    className="text-danger p-0 ms-2"
                    onClick={(e) => handleDeleteTeam(e, team.id)}
                  >
                    <i className="bi bi-trash-fill"></i>
                  </Button>
                </div>
              </div>
            </Accordion.Header>
            <Accordion.Body className="p-0">
              {/* TOOLBAR */}
              <div className="p-3 d-flex gap-2 align-items-center bg-light border-bottom">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openAddMemberModal(team)}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>Add Member
                </Button>

                <div className="d-inline-block">
                  <input
                    type="file"
                    id={`file-${team.id}`}
                    hidden
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileUpload(e, team)}
                  />
                  <label
                    htmlFor={`file-${team.id}`}
                    className="btn btn-sm btn-success text-white mb-0"
                  >
                    <i className="bi bi-file-earmark-spreadsheet-fill me-2"></i>
                    Upload Excel
                  </label>
                </div>

                <Button
                  size="sm"
                  variant="outline-danger"
                  className="ms-auto"
                  onClick={() => generateTeamPDF(team)}
                >
                  <i className="bi bi-file-earmark-pdf me-2"></i>PDF
                </Button>
              </div>

              {/* MEMBERS TABLE - Show ALL fields here */}
              <Table hover responsive className="mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>URN</th>
                    <th>Phone</th>
                    <th>Branch</th>
                    <th>Designation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(team.members || []).map((member, mIdx) => (
                    <tr key={mIdx}>
                      <td>{mIdx + 1}</td>
                      <td className="fw-bold">{member.name}</td>
                      <td>{member.urn}</td>
                      <td>{member.phone}</td>
                      <td>{member.branch}</td>
                      <td>{member.designation}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="border-0"
                            onClick={() =>
                              openEditMemberModal(team, member, mIdx)
                            }
                          >
                            <i className="bi bi-pencil-fill text-primary"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="border-0"
                            onClick={() => handleDeleteMember(team, mIdx)}
                          >
                            <i className="bi bi-trash-fill text-danger"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!team.members || team.members.length === 0) && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-3">
                        No members added to this team yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* CREATE TEAM MODAL */}
      <Modal
        show={showTeamModal}
        onHide={() => setShowTeamModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Create New Team</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FloatingLabel controlId="teamName" label="Team Name">
            <Form.Control
              placeholder="Team Name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          </FloatingLabel>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleCreateTeam}>Create</Button>
        </Modal.Footer>
      </Modal>

      {/* ADD/EDIT MEMBER MODAL - UPDATED FIELDS */}
      <Modal
        show={showMemberModal}
        onHide={() => setShowMemberModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingMemberIndex !== null ? "Edit" : "Add"} Team Member
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-3">
            <FloatingLabel controlId="memName" label="Student Name">
              <Form.Control
                placeholder="Name"
                value={memberForm.name}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, name: e.target.value })
                }
              />
            </FloatingLabel>

            <Row>
              <Col>
                <FloatingLabel controlId="memUrn" label="URN">
                  <Form.Control
                    placeholder="URN"
                    value={memberForm.urn}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, urn: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
              <Col>
                <FloatingLabel controlId="memPhone" label="Phone">
                  <Form.Control
                    placeholder="Phone"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, phone: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
            </Row>

            <Row>
              <Col>
                <FloatingLabel controlId="memBranch" label="Branch">
                  <Form.Control
                    placeholder="Branch"
                    value={memberForm.branch}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, branch: e.target.value })
                    }
                  />
                </FloatingLabel>
              </Col>
              <Col>
                <FloatingLabel controlId="memDesig" label="Designation">
                  <Form.Control
                    placeholder="Designation"
                    value={memberForm.designation}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        designation: e.target.value,
                      })
                    }
                  />
                </FloatingLabel>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleSaveMember}>Save Member</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
