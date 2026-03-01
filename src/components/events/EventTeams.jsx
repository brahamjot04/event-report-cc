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
  const [coreTeamMembers, setCoreTeamMembers] = useState([]);

  // Modal States
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showExportPDFModal, setShowExportPDFModal] = useState(false);
  const [includePhoneInPDF, setIncludePhoneInPDF] = useState(false);

  // Form States
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeamHead, setSelectedTeamHead] = useState(null);
  const [manualTeamHead, setManualTeamHead] = useState("");
  const [pendingTeamHeads, setPendingTeamHeads] = useState([]);
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);

  const [activeTeam, setActiveTeam] = useState(null);
  const [editingMemberIndex, setEditingMemberIndex] = useState(null);
  const [editingHeadMemberIndex, setEditingHeadMemberIndex] = useState(null);

  // Filter State
  const [selectedTeamFilter, setSelectedTeamFilter] = useState(null);

  const [memberForm, setMemberForm] = useState({
    name: "",
    urn: "",
    phone: "",
    branch: "",
    designation: "",
  });

  const [headForm, setHeadForm] = useState({
    name: "",
    urn: "",
    phone: "",
    branch: "",
  });

  useEffect(() => {
    fetchTeams();
    fetchCoreTeam();
  }, [eventId]);

  const fetchCoreTeam = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "global_core_team"));
      const coreTeam = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCoreTeamMembers(coreTeam);
    } catch (error) {
      console.error("Error fetching core team:", error);
    }
  };

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
  const buildHeadFromInputs = () => {
    if (selectedTeamHead) {
      const headMember = coreTeamMembers.find((m) => m.id === selectedTeamHead);
      if (headMember) {
        return {
          id: headMember.id,
          name: headMember.name,
          urn: headMember.urn || "",
          phone: headMember.phone || "",
          branch: headMember.branch || "",
          designation: "Head",
        };
      }
    }

    if (manualTeamHead.trim()) {
      return {
        name: manualTeamHead.trim(),
        urn: "",
        phone: "",
        branch: "",
        designation: "Head",
        isEventWiseHead: true,
      };
    }

    return null;
  };

  const handleAddHeadToList = () => {
    const newHead = buildHeadFromInputs();
    if (!newHead?.name) return;

    setPendingTeamHeads((prev) => {
      const exists = prev.some(
        (h) =>
          h.name?.trim().toLowerCase() === newHead.name.trim().toLowerCase() &&
          (h.urn || "") === (newHead.urn || ""),
      );
      if (exists) return prev;
      return [...prev, newHead];
    });

    setSelectedTeamHead(null);
    setManualTeamHead("");
  };

  const removePendingHead = (indexToRemove) => {
    setPendingTeamHeads((prev) =>
      prev.filter((_, idx) => idx !== indexToRemove),
    );
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    const inputHead = buildHeadFromInputs();
    const headsToSave = [...pendingTeamHeads];
    if (inputHead?.name) {
      const exists = headsToSave.some(
        (h) =>
          h.name?.trim().toLowerCase() ===
            inputHead.name.trim().toLowerCase() &&
          (h.urn || "") === (inputHead.urn || ""),
      );
      if (!exists) headsToSave.push(inputHead);
    }

    const primaryHead = headsToSave[0] || null;
    const headMembers = headsToSave.map((head) => ({
      name: head.name,
      urn: head.urn || "",
      phone: head.phone || "",
      branch: head.branch || "",
      designation: "Head",
    }));

    if (isEditingTeam && editingTeamId) {
      const currentTeam =
        teams.find((t) => t.id === editingTeamId) || activeTeam;
      const currentMembers = currentTeam?.members || [];
      const nonHeadMembers = currentMembers.filter(
        (m) => (m.designation || "").toLowerCase() !== "head",
      );

      // Update existing team
      await updateDoc(doc(db, "events", eventId, "teams", editingTeamId), {
        name: newTeamName,
        teamHead: primaryHead,
        teamHeads: headsToSave,
        members: [...headMembers, ...nonHeadMembers],
      });
      setIsEditingTeam(false);
      setEditingTeamId(null);
    } else {
      // Create new team
      await addDoc(collection(db, "events", eventId, "teams"), {
        name: newTeamName,
        teamHead: primaryHead,
        teamHeads: headsToSave,
        members: headMembers,
      });
    }
    setNewTeamName("");
    setSelectedTeamHead(null);
    setManualTeamHead("");
    setPendingTeamHeads([]);
    setShowTeamModal(false);
    fetchTeams();
  };

  const openEditTeamModal = (team) => {
    setIsEditingTeam(true);
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    const headsFromMembers = (team.members || [])
      .filter((m) => (m.designation || "").toLowerCase() === "head")
      .map((m) => ({
        name: m.name,
        urn: m.urn || "",
        phone: m.phone || "",
        branch: m.branch || "",
        designation: "Head",
      }));

    if (headsFromMembers.length > 0) {
      setPendingTeamHeads(headsFromMembers);
    } else if (team.teamHead?.name) {
      setPendingTeamHeads([
        {
          name: team.teamHead.name,
          urn: team.teamHead.urn || "",
          phone: team.teamHead.phone || "",
          branch: team.teamHead.branch || "",
          designation: "Head",
          id: team.teamHead.id,
          isEventWiseHead: team.teamHead.isEventWiseHead,
        },
      ]);
    } else {
      setPendingTeamHeads([]);
    }

    setSelectedTeamHead(null);
    setManualTeamHead("");
    setShowTeamModal(true);
  };

  const resetTeamForm = () => {
    setIsEditingTeam(false);
    setEditingTeamId(null);
    setNewTeamName("");
    setSelectedTeamHead(null);
    setManualTeamHead("");
    setPendingTeamHeads([]);
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

  const openEditHeadModal = (headMember, memberIndex = null) => {
    setEditingHeadMemberIndex(memberIndex);
    setHeadForm({
      name: headMember?.name || "",
      urn: headMember?.urn || "",
      phone: headMember?.phone || "",
      branch: headMember?.branch || "",
    });
    setShowHeadModal(true);
  };

  const handleSaveHeadDetails = async () => {
    if (!activeTeam || !headForm.name.trim()) return;

    const updatedMembers = [...(activeTeam.members || [])];

    if (editingHeadMemberIndex !== null) {
      const existing = updatedMembers[editingHeadMemberIndex] || {};
      updatedMembers[editingHeadMemberIndex] = {
        ...existing,
        ...headForm,
        designation: "Head",
      };
    }

    const updatedTeamHead = {
      ...(activeTeam.teamHead || {}),
      name: headForm.name,
      urn: headForm.urn,
      phone: headForm.phone,
      branch: headForm.branch,
      designation: "Head",
    };

    await updateDoc(doc(db, "events", eventId, "teams", activeTeam.id), {
      teamHead: updatedTeamHead,
      members: updatedMembers,
    });

    setActiveTeam({
      ...activeTeam,
      teamHead: updatedTeamHead,
      members: updatedMembers,
    });
    setShowHeadModal(false);
    setEditingHeadMemberIndex(null);
    fetchTeams();
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
  const generateAllTeamsPDF = async (includePhone = false) => {
    try {
      // Fetch global_core_team data for Student Coordinators only
      const coreTeamSnapshot = await getDocs(
        collection(db, "global_core_team"),
      );
      const coreTeamData = coreTeamSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Extract Student Coordinators
      const studentCoordinators = coreTeamData.filter(
        (m) =>
          m.designation?.toLowerCase().includes("coordinator") ||
          (m.designation?.toLowerCase().includes("student") &&
            m.designation?.toLowerCase().includes("co")),
      );

      const { totalCoreMembers, totalTeamMembers, totalMembers } =
        getOverallMemberStats(teams);

      const pdfDoc = new jsPDF();
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(18);
      pdfDoc.text(`Team Details Report`, 14, 15);

      pdfDoc.setFontSize(12);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`Event: ${eventTitle || "Event Details"}`, 14, 22);

      let finalY = 30;

      // Helper function to add section to PDF
      const addSection = (title, members) => {
        if (finalY > 250) {
          pdfDoc.addPage();
          finalY = 20;
        }

        // Section Title
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(12);
        pdfDoc.setTextColor(41, 128, 185);
        pdfDoc.text(title, 14, finalY);
        finalY += 6;

        const rows = (members || []).map((m, i) => {
          const baseCells = [i + 1, m.name || "-", m.urn || "-"];
          if (includePhone) {
            baseCells.push(m.phone || "-");
          }
          baseCells.push(m.branch || "-", m.designation || "-");
          return baseCells;
        });

        if (rows.length > 0) {
          const tableHead = ["S.No", "Student Name", "URN"];
          if (includePhone) {
            tableHead.push("Phone");
          }
          tableHead.push("Branch", "Designation");

          autoTable(pdfDoc, {
            startY: finalY,
            head: [tableHead],
            body: rows,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14, right: 14 },
          });
          finalY = pdfDoc.lastAutoTable.finalY + 5;
        } else {
          pdfDoc.setFont("helvetica", "italic");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(0);
          pdfDoc.text("(No members)", 14, finalY + 3);
          finalY += 10;
        }
      };

      // Add Student Coordinators Section
      addSection("Student Coordinators", studentCoordinators);
      finalY += 5; // Extra space before teams

      // Add each event team
      teams.forEach((team) => {
        if (finalY > 240) {
          pdfDoc.addPage();
          finalY = 20;
        }

        // Team Title
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(13);
        pdfDoc.setTextColor(0, 51, 102);
        pdfDoc.text(team.name, 14, finalY);
        finalY += 6;

        const normalizedMembers = team.members || [];
        const headMembers = normalizedMembers.filter(
          (m) => (m.designation || "").toLowerCase() === "head",
        );
        const executiveMembers = normalizedMembers.filter(
          (m) => (m.designation || "").toLowerCase() === "executive",
        );
        const regularMembers = normalizedMembers.filter(
          (m) =>
            !["head", "executive"].includes(
              (m.designation || "").toLowerCase(),
            ),
        );
        const teamTotalMembersCount = normalizedMembers.length;

        const rows = [];

        const getSectionCells = (label) => {
          const cells = [label, "", ""];
          if (includePhone) cells.push("");
          cells.push("", "");
          return cells;
        };

        const getMemberCells = (serial, member, defaultDesignation) => {
          const cells = [serial, member.name || "-", member.urn || "-"];
          if (includePhone) {
            cells.push(member.phone || "-");
          }
          cells.push(
            member.branch || "-",
            member.designation || defaultDesignation,
          );
          return cells;
        };

        if (headMembers.length > 0 || team.teamHead?.name) {
          rows.push({
            isSection: true,
            cells: getSectionCells("Team Head Details"),
          });

          if (headMembers.length > 0) {
            headMembers.forEach((m, i) => {
              rows.push({
                isSection: false,
                cells: getMemberCells(i + 1, m, "Head"),
              });
            });
          } else {
            rows.push({
              isSection: false,
              cells: getMemberCells(
                1,
                {
                  name: team.teamHead.name,
                  urn: team.teamHead.urn,
                  phone: team.teamHead.phone,
                  branch: team.teamHead.branch,
                  designation: "Head",
                },
                "Head",
              ),
            });
          }
        }

        if (executiveMembers.length > 0) {
          rows.push({
            isSection: true,
            cells: getSectionCells("Team Executives"),
          });

          executiveMembers.forEach((m, i) => {
            rows.push({
              isSection: false,
              cells: getMemberCells(i + 1, m, "Executive"),
            });
          });
        }

        if (regularMembers.length > 0) {
          rows.push({
            isSection: true,
            cells: getSectionCells("Team Members"),
          });

          regularMembers.forEach((m, i) => {
            rows.push({
              isSection: false,
              cells: getMemberCells(i + 1, m, "Member"),
            });
          });
        }

        if (rows.length > 0) {
          const tableHead = ["S.No", "Student Name", "URN"];
          if (includePhone) {
            tableHead.push("Phone");
          }
          tableHead.push("Branch", "Designation");

          autoTable(pdfDoc, {
            startY: finalY,
            head: [tableHead],
            body: rows.map((row) => row.cells),
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185] },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
              if (data.section === "body") {
                const row = rows[data.row.index];
                if (row?.isSection) {
                  data.cell.styles.fillColor = [236, 240, 241];
                  data.cell.styles.fontStyle = "bold";
                  if (data.column.index > 0) {
                    data.cell.text = [""];
                  }
                }
              }
            },
          });
          finalY = pdfDoc.lastAutoTable.finalY + 4;
          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(33, 37, 41);
          pdfDoc.text(
            `Members in ${team.name}: ${teamTotalMembersCount}`,
            14,
            finalY,
          );
          finalY += 8;
        } else {
          pdfDoc.setFont("helvetica", "italic");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(0);
          pdfDoc.text("No team data available.", 14, finalY + 3);
          finalY += 8;
          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(10);
          pdfDoc.setTextColor(33, 37, 41);
          pdfDoc.text(`Members in ${team.name}: 0`, 14, finalY);
          finalY += 8;
        }
      });

      if (finalY > 250) {
        pdfDoc.addPage();
        finalY = 20;
      }

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(41, 128, 185);
      pdfDoc.text("Team Data Summary", 14, finalY);
      finalY += 7;

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(0);
      pdfDoc.text(`Core Members: ${totalCoreMembers}`, 14, finalY);
      finalY += 6;
      pdfDoc.text(`Team Members (Unique): ${totalTeamMembers}`, 14, finalY);
      finalY += 6;
      pdfDoc.text(`Total Members: ${totalMembers}`, 14, finalY);

      pdfDoc.save(`Teams_Report.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  const getInitials = (name) =>
    name ? name.substring(0, 2).toUpperCase() : "TM";

  const getTeamHeadsCount = (team) => {
    const headMembersCount = (team?.members || []).filter(
      (member) => (member.designation || "").toLowerCase() === "head",
    ).length;

    if (headMembersCount > 0) return headMembersCount;
    if (Array.isArray(team?.teamHeads) && team.teamHeads.length > 0) {
      return team.teamHeads.length;
    }
    return team?.teamHead?.name ? 1 : 0;
  };

  const getTeamExecutivesCount = (team) =>
    (team?.members || []).filter(
      (member) => (member.designation || "").toLowerCase() === "executive",
    ).length;

  const getTeamMembersCount = (team) =>
    (team?.members || []).filter((member) => {
      const designation = (member.designation || "").toLowerCase();
      return !["head", "executive"].includes(designation);
    }).length;

  const getMemberUniqueKey = (member) => {
    const name = String(member?.name || "")
      .trim()
      .toLowerCase();
    const urn = String(member?.urn || "")
      .trim()
      .toLowerCase();
    const phone = String(member?.phone || "")
      .trim()
      .toLowerCase();
    const branch = String(member?.branch || "")
      .trim()
      .toLowerCase();

    return `identity:${name}|${urn}|${phone}|${branch}`;
  };

  const getOverallMemberStats = (teamList = []) => {
    const uniqueMembers = new Map();
    const uniqueCoreMembers = new Map();
    const uniqueTeamMembers = new Map();

    teamList.forEach((team) => {
      const normalizedMembers = Array.isArray(team?.members)
        ? team.members
        : [];

      normalizedMembers.forEach((member) => {
        if (!member?.name) return;

        const key = getMemberUniqueKey(member);
        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, member);
        }

        const designation = (member.designation || "").toLowerCase();
        if (["head", "executive"].includes(designation)) {
          if (!uniqueCoreMembers.has(key)) {
            uniqueCoreMembers.set(key, member);
          }
        } else {
          if (!uniqueTeamMembers.has(key)) {
            uniqueTeamMembers.set(key, member);
          }
        }
      });

      if (team?.teamHead?.name) {
        const fallbackHead = {
          name: team.teamHead.name,
          urn: team.teamHead.urn || "",
          phone: team.teamHead.phone || "",
          branch: team.teamHead.branch || "",
          designation: "Head",
        };
        const key = getMemberUniqueKey(fallbackHead);

        if (!uniqueMembers.has(key)) {
          uniqueMembers.set(key, fallbackHead);
        }
        if (!uniqueCoreMembers.has(key)) {
          uniqueCoreMembers.set(key, fallbackHead);
        }
      }
    });

    return {
      totalCoreMembers: uniqueCoreMembers.size,
      totalTeamMembers: uniqueTeamMembers.size,
      totalMembers: uniqueMembers.size,
    };
  };

  const overallStats = getOverallMemberStats(teams);

  const handleExportPDFClick = () => {
    setShowExportPDFModal(true);
  };

  const handleConfirmExportPDF = () => {
    generateAllTeamsPDF(includePhoneInPDF);
    setShowExportPDFModal(false);
  };

  const getHierarchicalRows = (team) => {
    const membersWithIndex = (team?.members || []).map((member, index) => ({
      ...member,
      originalIndex: index,
    }));

    const heads = membersWithIndex.filter(
      (m) => (m.designation || "").toLowerCase() === "head",
    );
    const executives = membersWithIndex.filter(
      (m) => (m.designation || "").toLowerCase() === "executive",
    );
    const teamMembers = membersWithIndex.filter(
      (m) =>
        !["head", "executive"].includes((m.designation || "").toLowerCase()),
    );

    const rows = [];

    rows.push({ type: "section", label: "Team Head Details" });
    if (heads.length > 0) {
      heads.forEach((member, index) =>
        rows.push({
          type: "member",
          group: "head",
          member: { ...member, serial: index + 1 },
        }),
      );
    } else if (team?.teamHead?.name) {
      rows.push({
        type: "head-only",
        group: "head",
        member: {
          name: team.teamHead.name,
          urn: team.teamHead.urn || "-",
          phone: team.teamHead.phone || "-",
          branch: team.teamHead.branch || "-",
          designation: "Head",
          originalIndex: null,
          serial: 1,
        },
      });
    } else {
      rows.push({ type: "empty", message: "Not Assigned" });
    }

    rows.push({ type: "section", label: "Team Executives" });
    if (executives.length > 0) {
      executives.forEach((member, index) =>
        rows.push({
          type: "member",
          group: "executive",
          member: { ...member, serial: index + 1 },
        }),
      );
    } else {
      rows.push({ type: "empty", message: "No Executives" });
    }

    rows.push({ type: "section", label: "Team Members" });
    if (teamMembers.length > 0) {
      teamMembers.forEach((member, index) =>
        rows.push({
          type: "member",
          group: "member",
          member: { ...member, serial: index + 1 },
        }),
      );
    } else {
      rows.push({ type: "empty", message: "No Members" });
    }

    return rows;
  };

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
              {getTeamMembersCount(activeTeam)} Members •{" "}
              {getTeamExecutivesCount(activeTeam)} Executives •{" "}
              {getTeamHeadsCount(activeTeam)} Heads
            </p>
            {activeTeam.teamHead?.name && (
              <p className="text-muted small mb-0">
                Head: {activeTeam.teamHead.name}
              </p>
            )}
          </div>
          <div className="ms-auto d-flex gap-2">
            <Button
              variant="outline-primary"
              onClick={() => openEditTeamModal(activeTeam)}
              className="d-flex align-items-center gap-2"
            >
              <i className="bi bi-pencil"></i>
              <span className="d-none d-md-inline">Edit Team</span>
            </Button>
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
                  Phone
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
                    colSpan="7"
                    className="text-center py-4 text-muted border-0"
                  >
                    <i className="bi bi-people display-4 opacity-25 d-block mb-3 mt-2"></i>
                    No members in this team yet.
                  </td>
                </tr>
              ) : (
                getHierarchicalRows(activeTeam).map((row, idx) => {
                  if (row.type === "section") {
                    return (
                      <tr key={`section-${idx}`}>
                        <td
                          colSpan="7"
                          className="fw-bold text-primary text-start"
                          style={{
                            backgroundColor: "var(--soft-hover)",
                            borderBottom: "1px solid var(--border-color)",
                          }}
                        >
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  if (row.type === "empty") {
                    return (
                      <tr key={`empty-${idx}`}>
                        <td className="ps-4 text-muted text-start">-</td>
                        <td className="text-muted text-start">{row.message}</td>
                        <td className="text-muted text-start">-</td>
                        <td className="text-muted text-start">-</td>
                        <td className="text-muted text-start">-</td>
                        <td className="text-muted text-start">-</td>
                        <td className="text-end pe-4">-</td>
                      </tr>
                    );
                  }

                  const member = row.member;
                  return (
                    <tr
                      key={`member-${member.originalIndex ?? idx}`}
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <td className="ps-4 text-muted text-start">
                        {member.serial}
                      </td>
                      <td className="fw-bold text-body text-start">
                        {member.name}
                      </td>
                      <td className="text-muted text-start">
                        <code className="text-primary">
                          {member.urn || "-"}
                        </code>
                      </td>
                      <td className="text-muted small text-start">
                        {member.phone || "-"}
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
                        {row.group === "head" ? (
                          <div className="d-flex justify-content-end gap-2">
                            <Button
                              size="sm"
                              variant="light"
                              className="border-0 bg-transparent text-primary p-1"
                              onClick={() =>
                                openEditHeadModal(member, member.originalIndex)
                              }
                              title="Edit Team Head"
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </Button>
                          </div>
                        ) : member.originalIndex !== null ? (
                          <div className="d-flex justify-content-end gap-2">
                            <Button
                              size="sm"
                              variant="light"
                              className="border-0 bg-transparent text-primary p-1"
                              onClick={() =>
                                openEditMemberModal(
                                  member,
                                  member.originalIndex,
                                )
                              }
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              className="border-0 bg-transparent text-danger p-1"
                              onClick={() =>
                                handleDeleteMember(member.originalIndex)
                              }
                            >
                              <i className="bi bi-trash-fill"></i>
                            </Button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {/* Team Head Modal */}
        <Modal
          show={showHeadModal}
          onHide={() => {
            setShowHeadModal(false);
            setEditingHeadMemberIndex(null);
          }}
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
              <Modal.Title className="fw-bold h5">Edit Team Head</Modal.Title>
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
                    value={headForm.name}
                    onChange={(e) =>
                      setHeadForm({ ...headForm, name: e.target.value })
                    }
                  />
                </Form.Group>

                <Row>
                  <Col>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted">
                        CRN / URN
                      </Form.Label>
                      <Form.Control
                        placeholder="CRN / URN"
                        className="form-control"
                        style={{
                          backgroundColor: "var(--bg-main)",
                          color: "var(--text-primary)",
                          borderColor: "var(--border-color)",
                        }}
                        value={headForm.urn}
                        onChange={(e) =>
                          setHeadForm({ ...headForm, urn: e.target.value })
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
                        value={headForm.phone}
                        onChange={(e) =>
                          setHeadForm({ ...headForm, phone: e.target.value })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>

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
                    value={headForm.branch}
                    onChange={(e) =>
                      setHeadForm({ ...headForm, branch: e.target.value })
                    }
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="primary"
                onClick={handleSaveHeadDetails}
                className="w-100"
              >
                Save Team Head
              </Button>
            </Modal.Footer>
          </div>
        </Modal>

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
                        <option value="Executive">Executive</option>
                        <option value="Member">Member</option>
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

        {/* Create/Edit Team Modal (available in team details view) */}
        <Modal
          show={showTeamModal}
          onHide={() => {
            setShowTeamModal(false);
            resetTeamForm();
          }}
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
                {isEditingTeam ? "Edit Team" : "Create New Team"}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-4 text-start d-grid gap-3">
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

              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  TEAM HEAD (FROM CORE TEAM) - Optional
                </Form.Label>
                <div className="d-flex gap-2 align-items-center">
                  <Form.Select
                    style={{
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                    value={selectedTeamHead || ""}
                    onChange={(e) => {
                      setSelectedTeamHead(e.target.value || null);
                      if (e.target.value) {
                        setManualTeamHead("");
                      }
                    }}
                  >
                    <option value="">-- Select from Core Team --</option>
                    {coreTeamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.designation || "Member"})
                      </option>
                    ))}
                  </Form.Select>
                  <Button
                    type="button"
                    variant="outline-primary"
                    onClick={handleAddHeadToList}
                    title="Add Team Head"
                    className="d-flex align-items-center justify-content-center"
                    style={{ width: "38px", height: "38px", padding: 0 }}
                  >
                    <i className="bi bi-plus-lg"></i>
                  </Button>
                </div>
              </Form.Group>

              {!selectedTeamHead && (
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted">
                    ADD EVENT-WISE TEAM HEAD - Optional
                  </Form.Label>
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Control
                      placeholder="e.g. Student Name"
                      className="form-control"
                      style={{
                        backgroundColor: "var(--bg-main)",
                        color: "var(--text-primary)",
                        borderColor: "var(--border-color)",
                      }}
                      value={manualTeamHead}
                      onChange={(e) => setManualTeamHead(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline-primary"
                      onClick={handleAddHeadToList}
                      title="Add Team Head"
                      className="d-flex align-items-center justify-content-center"
                      style={{ width: "38px", height: "38px", padding: 0 }}
                    >
                      <i className="bi bi-plus-lg"></i>
                    </Button>
                  </div>
                  <small className="text-muted d-block mt-1">
                    Use this if Team Head is not in Core Team
                  </small>
                </Form.Group>
              )}

              {pendingTeamHeads.length > 0 && (
                <div>
                  <Form.Label className="small fw-bold text-muted mb-2 d-block">
                    SELECTED TEAM HEADS
                  </Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {pendingTeamHeads.map((head, idx) => (
                      <Badge
                        key={`${head.name}-${idx}`}
                        bg="primary"
                        className="d-flex align-items-center gap-2"
                      >
                        <span>{head.name}</span>
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 text-white text-decoration-none"
                          onClick={() => removePendingHead(idx)}
                          style={{ lineHeight: 1 }}
                        >
                          <i className="bi bi-x-lg"></i>
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="border-0 p-3 pt-0">
              <Button
                variant="primary"
                onClick={handleCreateTeam}
                className="w-100"
              >
                {isEditingTeam ? "Update Team" : "Create Team"}
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
          <p className="text-muted small mb-0">
            Manage committees and members • {overallStats.totalCoreMembers} Core
            Members • {overallStats.totalMembers} Total Members
          </p>
        </div>
        <div className="ms-auto d-flex gap-2">
          <Button
            variant="outline-danger"
            onClick={handleExportPDFClick}
            size="sm"
            className="d-flex align-items-center"
          >
            <i className="bi bi-file-earmark-pdf me-2"></i>Export Report
          </Button>
        </div>
      </div>

      {/* Team Filter Chips */}
      <div className="mb-4 d-flex flex-wrap gap-2 align-items-center">
        <span className="text-muted small fw-bold me-2">Filter by:</span>
        <Button
          size="sm"
          variant={
            selectedTeamFilter === null ? "primary" : "outline-secondary"
          }
          className="rounded-pill"
          onClick={() => setSelectedTeamFilter(null)}
        >
          All Teams
        </Button>
        {teams.map((team) => (
          <Button
            key={team.id}
            size="sm"
            variant={
              selectedTeamFilter === team.id ? "primary" : "outline-secondary"
            }
            className="rounded-pill"
            onClick={() => setSelectedTeamFilter(team.id)}
          >
            {team.name}
          </Button>
        ))}
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
              resetTeamForm();
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

        {teams
          .filter(
            (team) =>
              selectedTeamFilter === null || team.id === selectedTeamFilter,
          )
          .map((team) => (
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
                        className="text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditTeamModal(team);
                        }}
                      >
                        <i className="bi bi-pencil me-2"></i>Edit Team
                      </Dropdown.Item>
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
                      {getTeamMembersCount(team)} Members
                    </Badge>
                    <Badge
                      bg="info"
                      className="ms-2 bg-opacity-25 text-info fw-normal border border-info"
                    >
                      {getTeamExecutivesCount(team)} Executives
                    </Badge>
                    <Badge
                      bg="secondary"
                      className="ms-2 bg-opacity-25 text-secondary fw-normal border border-secondary"
                    >
                      {getTeamHeadsCount(team)} Heads
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

        {teams.filter(
          (team) =>
            selectedTeamFilter === null || team.id === selectedTeamFilter,
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
              <i className="bi bi-people display-4 opacity-25 d-block mb-3"></i>
              <p className="text-muted mb-0">
                {selectedTeamFilter
                  ? "No team selected or team not found"
                  : "No teams created yet"}
              </p>
            </div>
          </Col>
        )}
      </Row>

      {/* --- MODALS --- */}

      {/* 1. CREATE/EDIT TEAM MODAL */}
      <Modal
        show={showTeamModal}
        onHide={() => {
          setShowTeamModal(false);
          resetTeamForm();
        }}
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
              {isEditingTeam ? "Edit Team" : "Create New Team"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 text-start d-grid gap-3">
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

            <Form.Group>
              <Form.Label className="small fw-bold text-muted">
                TEAM HEAD (FROM CORE TEAM) - Optional
              </Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <Form.Select
                  style={{
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-primary)",
                    borderColor: "var(--border-color)",
                  }}
                  value={selectedTeamHead || ""}
                  onChange={(e) => {
                    setSelectedTeamHead(e.target.value || null);
                    if (e.target.value) {
                      setManualTeamHead("");
                    }
                  }}
                >
                  <option value="">-- Select from Core Team --</option>
                  {coreTeamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.designation || "Member"})
                    </option>
                  ))}
                </Form.Select>
                <Button
                  type="button"
                  variant="outline-primary"
                  onClick={handleAddHeadToList}
                  title="Add Team Head"
                  className="d-flex align-items-center justify-content-center"
                  style={{ width: "38px", height: "38px", padding: 0 }}
                >
                  <i className="bi bi-plus-lg"></i>
                </Button>
              </div>
            </Form.Group>

            {!selectedTeamHead && (
              <Form.Group>
                <Form.Label className="small fw-bold text-muted">
                  ADD EVENT-WISE TEAM HEAD - Optional
                </Form.Label>
                <div className="d-flex gap-2 align-items-center">
                  <Form.Control
                    placeholder="e.g. Student Name"
                    className="form-control"
                    style={{
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                    value={manualTeamHead}
                    onChange={(e) => setManualTeamHead(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline-primary"
                    onClick={handleAddHeadToList}
                    title="Add Team Head"
                    className="d-flex align-items-center justify-content-center"
                    style={{ width: "38px", height: "38px", padding: 0 }}
                  >
                    <i className="bi bi-plus-lg"></i>
                  </Button>
                </div>
                <small className="text-muted d-block mt-1">
                  Use this if Team Head is not in Core Team
                </small>
              </Form.Group>
            )}

            {pendingTeamHeads.length > 0 && (
              <div>
                <Form.Label className="small fw-bold text-muted mb-2 d-block">
                  SELECTED TEAM HEADS
                </Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {pendingTeamHeads.map((head, idx) => (
                    <Badge
                      key={`${head.name}-${idx}`}
                      bg="primary"
                      className="d-flex align-items-center gap-2"
                    >
                      <span>{head.name}</span>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 text-white text-decoration-none"
                        onClick={() => removePendingHead(idx)}
                        style={{ lineHeight: 1 }}
                      >
                        <i className="bi bi-x-lg"></i>
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0">
            <Button
              variant="primary"
              onClick={handleCreateTeam}
              className="w-100"
            >
              {isEditingTeam ? "Update Team" : "Create Team"}
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      <Modal
        show={showExportPDFModal}
        onHide={() => setShowExportPDFModal(false)}
        centered
      >
        <div className="soft-card border-0 p-0 overflow-hidden">
          <Modal.Header
            closeButton
            className="border-bottom"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Modal.Title className="fw-bold h5">Export PDF</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 text-start">
            <Form.Check
              type="switch"
              id="include-phone-export-switch"
              label="Include phone numbers in the export"
              checked={includePhoneInPDF}
              onChange={(e) => setIncludePhoneInPDF(e.target.checked)}
            />
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0 d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowExportPDFModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmExportPDF}>
              Export
            </Button>
          </Modal.Footer>
        </div>
      </Modal>

      <Modal
        show={showExportPDFModal}
        onHide={() => setShowExportPDFModal(false)}
        centered
      >
        <div className="soft-card border-0 p-0 overflow-hidden">
          <Modal.Header
            closeButton
            className="border-bottom"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Modal.Title className="fw-bold h5">Export PDF</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4 text-start">
            <Form.Check
              type="switch"
              id="include-phone-export-switch-main"
              label="Include phone numbers in the export"
              checked={includePhoneInPDF}
              onChange={(e) => setIncludePhoneInPDF(e.target.checked)}
            />
          </Modal.Body>
          <Modal.Footer className="border-0 p-3 pt-0 d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={() => setShowExportPDFModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmExportPDF}>
              Export
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
}
