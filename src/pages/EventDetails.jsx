import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { Spinner } from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Layout from "../components/Layout";

// Import Sub-Components
import EventDashboard from "../components/events/EventDashboard";
import EventParticipants from "../components/events/EventParticipants";
import EventSponsorship from "../components/events/EventSponsorship";
import EventMeetings from "../components/events/EventMeetings";
import EventTeams from "../components/events/EventTeams";
import EventTeachers from "../components/events/EventTeachers";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();

  const [userRole, setUserRole] = useState("user");
  const [currentView, setCurrentView] = useState("dashboard");
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingReport, setExportingReport] = useState(false);

  // --- INITIAL DATA FETCHING ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);
      }
    });

    const fetchEvent = async () => {
      try {
        const eventSnap = await getDoc(doc(db, "events", id));
        if (eventSnap.exists()) {
          setEventData({ id: eventSnap.id, ...eventSnap.data() });
        } else {
          navigate("/");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
    return () => unsubscribe();
  }, [id, navigate, auth]);

  const handleDeleteEvent = async () => {
    if (window.confirm("Delete EVENT? This cannot be undone.")) {
      await deleteDoc(doc(db, "events", id));
      navigate("/");
    }
  };

  const handleExportEventReport = async () => {
    if (!eventData || exportingReport) return;

    setExportingReport(true);
    try {
      const [
        teachersSnap,
        teamsSnap,
        itemsSnap,
        sessionsSnap,
        coordinatorsSnap,
      ] = await Promise.all([
        getDocs(collection(db, "events", id, "teachers")),
        getDocs(collection(db, "events", id, "teams")),
        getDocs(collection(db, "events", id, "items")),
        getDocs(collection(db, "events", id, "attendance_sessions")),
        getDocs(collection(db, "global_core_team")),
      ]);

      const teachers = teachersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sessions = sessionsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const studentCoordinators = coordinatorsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const sessionsWithAttendance = await Promise.all(
        sessions.map(async (session) => {
          const studentsSnap = await getDocs(
            collection(
              db,
              "events",
              id,
              "attendance_sessions",
              session.id,
              "students",
            ),
          );

          const students = studentsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          return {
            ...session,
            students,
            attendanceCount: studentsSnap.size,
          };
        }),
      );

      const pdf = new jsPDF({ orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const centerX = pageWidth / 2;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Guru Nanak Dev Engineering College", centerX, 15, {
        align: "center",
      });
      pdf.setFontSize(12);
      pdf.text("Cultural Committee", centerX, 22, { align: "center" });
      pdf.text(`Event Report - ${eventData.title || "Event"}`, centerX, 29, {
        align: "center",
      });

      let currentY = 40;
      const ensureSpace = (spacing = 10) => {
        const lastTableY = pdf.lastAutoTable?.finalY || 0;
        const baselineY = Math.max(currentY, lastTableY);
        const nextY = baselineY + spacing;
        if (nextY > 185) {
          pdf.addPage();
          currentY = 20;
        } else {
          currentY = nextY;
        }
      };

      const renderSectionTitle = (title) => {
        ensureSpace(10);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, 14, currentY);
        currentY += 4;
      };

      const renderSubTitle = (title) => {
        ensureSpace(8);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(title, 14, currentY);
        currentY += 3;
      };

      const renderGridTable = (head, body, fontSize = 10) => {
        autoTable(pdf, {
          head: [head],
          body,
          startY: currentY,
          theme: "grid",
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: "bold",
          },
          styles: { fontSize, cellPadding: 2 },
        });
        currentY = (pdf.lastAutoTable?.finalY || currentY) + 2;
      };

      // Teachers
      renderSectionTitle("Teachers");
      const groupedTeachers = teachers.reduce((acc, teacher) => {
        const committee =
          (teacher.committee || "General").toString().trim() || "General";
        if (!acc[committee]) acc[committee] = [];
        acc[committee].push(teacher);
        return acc;
      }, {});

      const committeePriority = (name = "") => {
        const normalized = name.toLowerCase();
        if (normalized.includes("organizing")) return 0;
        if (normalized.includes("guest reception")) return 1;
        return 2;
      };

      const orderedCommittees = Object.keys(groupedTeachers).sort((a, b) => {
        const pDiff = committeePriority(a) - committeePriority(b);
        if (pDiff !== 0) return pDiff;
        return a.localeCompare(b);
      });

      if (orderedCommittees.length === 0) {
        renderGridTable(
          ["S.No", "Name", "Designation", "Department"],
          [["-", "No records found", "-", "-"]],
        );
      } else {
        orderedCommittees.forEach((committee) => {
          renderSubTitle(committee);
          const rows = groupedTeachers[committee]
            .slice()
            .sort((a, b) => {
              if (!!a.incharge !== !!b.incharge) return a.incharge ? -1 : 1;
              return (a.name || "").localeCompare(b.name || "");
            })
            .map((teacher, index) => [
              index + 1,
              `${teacher.name || "-"}${teacher.incharge ? " [Incharge]" : ""}`,
              teacher.designation || "-",
              teacher.department || "-",
            ]);

          renderGridTable(["S.No", "Name", "Designation", "Department"], rows);
        });
      }

      // Teams
      renderSectionTitle("Teams");
      const renderStudentCoordinators = () => {
        renderSubTitle("Student Coordinators");
        const coordinatorRows = studentCoordinators
          .slice()
          .filter((member) => {
            const designation = (member.designation || "")
              .toString()
              .trim()
              .toLowerCase();
            return (
              designation === "student coordinator" ||
              designation === "student coordinators"
            );
          })
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          .map((member, index) => [
            index + 1,
            member.name || "-",
            member.urn || "-",
            member.branch || "-",
            member.designation || "-",
          ]);

        renderGridTable(
          ["S.No", "Name", "URN", "Branch", "Designation"],
          coordinatorRows.length > 0
            ? coordinatorRows
            : [["-", "No records found", "-", "-", "-"]],
        );
      };

      if (teams.length === 0) {
        renderStudentCoordinators();
        renderGridTable(
          ["S.No", "Member", "Designation", "Branch"],
          [["-", "No records found", "-", "-"]],
        );
      } else {
        const sortedTeams = teams
          .slice()
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        let coordinatorsInserted = false;
        sortedTeams.forEach((team, idx) => {
          const teamNameLower = (team.name || "").toLowerCase();
          const isAnchoringTeam =
            teamNameLower === "anchoring team" ||
            teamNameLower.includes("anchoring team");

          if (isAnchoringTeam && !coordinatorsInserted) {
            renderStudentCoordinators();
            coordinatorsInserted = true;
          }

          if (idx === 0 && !coordinatorsInserted && sortedTeams.length > 0) {
            // Fallback: if Anchoring Team is not present, place coordinators before first team.
            renderStudentCoordinators();
            coordinatorsInserted = true;
          }

          renderSubTitle(team.name || "Unnamed Team");
          const members = Array.isArray(team.members) ? team.members : [];
          const rows =
            members.length > 0
              ? members.map((member, index) => [
                  index + 1,
                  member.name || "-",
                  member.designation || "-",
                  member.branch || "-",
                ])
              : [["-", "No members", "-", "-"]];

          renderGridTable(["S.No", "Member", "Designation", "Branch"], rows);
        });
      }

      // Participants
      renderSectionTitle("Participants");
      if (items.length === 0) {
        renderGridTable(
          ["S.No", "Name", "URN", "CRN", "Branch", "Position"],
          [["-", "No records found", "-", "-", "-", "-"]],
          9,
        );
      } else {
        items
          .slice()
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          .forEach((item) => {
            const participants = Array.isArray(item.participants)
              ? item.participants
              : [];

            renderSubTitle(
              `${item.name || "Unnamed Event"} (${item.category || "General"})`,
            );

            if (participants.length === 0) {
              renderGridTable(
                ["S.No", "Name", "URN", "CRN", "Branch", "Position"],
                [["-", "No participants", "-", "-", "-", "-"]],
                9,
              );
              return;
            }

            if (item.isGroupEvent) {
              const groupedByTeam = participants.reduce((acc, participant) => {
                const teamName =
                  (participant.teamName || "Unnamed Team").toString().trim() ||
                  "Unnamed Team";
                if (!acc[teamName]) acc[teamName] = [];
                acc[teamName].push(participant);
                return acc;
              }, {});

              Object.keys(groupedByTeam)
                .sort((a, b) => a.localeCompare(b))
                .forEach((teamName) => {
                  renderSubTitle(teamName);
                  const rows = groupedByTeam[teamName].map(
                    (participant, index) => [
                      index + 1,
                      participant.name || "-",
                      participant.urn || "-",
                      participant.crn || "-",
                      participant.branch || "-",
                      participant.position || "-",
                    ],
                  );

                  renderGridTable(
                    ["S.No", "Name", "URN", "CRN", "Branch", "Position"],
                    rows,
                    9,
                  );
                });
            } else {
              const rows = participants.map((participant, index) => [
                index + 1,
                participant.name || "-",
                participant.urn || "-",
                participant.crn || "-",
                participant.branch || "-",
                participant.position || "-",
              ]);

              renderGridTable(
                ["S.No", "Name", "URN", "CRN", "Branch", "Position"],
                rows,
                9,
              );
            }
          });
      }

      // Meetings
      renderSectionTitle("Meetings");
      const sortedMeetings = sessionsWithAttendance.slice().sort((a, b) => {
        const aDate = a.date || "";
        const bDate = b.date || "";
        return aDate.localeCompare(bDate);
      });

      if (sortedMeetings.length === 0) {
        renderGridTable(
          ["S.No", "Name", "URN", "Team"],
          [["-", "No meetings found", "-", "-"]],
        );
      } else {
        sortedMeetings.forEach((meeting, meetingIndex) => {
          const meetingTitle =
            `Meeting ${meetingIndex + 1} - ${meeting.date || "No Date"} ${meeting.time ? `(${meeting.time})` : ""}`.trim();
          renderSubTitle(meetingTitle);

          const detailsRows = [
            [
              meeting.venue || "-",
              meeting.agenda || "-",
              meeting.attendanceCount,
            ],
          ];

          renderGridTable(["Venue", "Agenda", "Attendance"], detailsRows, 9);

          const studentRows = (meeting.students || []).map((student, index) => [
            index + 1,
            student.name || "-",
            student.urn || "-",
            student.team || "-",
          ]);

          renderGridTable(
            ["S.No", "Name", "URN", "Team"],
            studentRows.length > 0
              ? studentRows
              : [["-", "No students", "-", "-"]],
          );
        });
      }

      const safeName = (eventData.title || "Event")
        .replace(/[^a-z0-9\-_.\s]/gi, "")
        .trim()
        .replace(/\s+/g, "_");

      pdf.save(`${safeName || "Event"}_Report.pdf`);
    } catch (error) {
      console.error("Error exporting event report:", error);
      window.alert("Could not export event report. Please try again.");
    } finally {
      setExportingReport(false);
    }
  };

  // --- VIEW ROUTER ---
  const renderView = () => {
    if (loading)
      return (
        <div className="vh-100 d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="primary" />
        </div>
      );

    switch (currentView) {
      case "participants":
        return (
          <EventParticipants
            eventId={id}
            initialEventData={eventData}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "sponsorship":
        return (
          <EventSponsorship
            eventId={id}
            eventTitle={eventData.title}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "attendance_sessions":
        return (
          <EventMeetings
            eventId={id}
            eventTitle={eventData.title}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "teams":
        return (
          <EventTeams
            eventId={id}
            eventTitle={eventData.title}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "teachers":
        return (
          <EventTeachers
            eventId={id}
            eventTitle={eventData.title}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      default:
        // This is the "Home" of the event details
        return (
          <EventDashboard
            eventData={eventData}
            setView={setCurrentView}
            userRole={userRole}
            onDelete={handleDeleteEvent}
            onExportReport={handleExportEventReport}
            exportingReport={exportingReport}
          />
        );
    }
  };

  // Wrap everything in Layout so Sidebar persists even during loading
  return <Layout>{renderView()}</Layout>;
}
