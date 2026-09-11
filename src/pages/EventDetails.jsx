import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { loadWithCache, invalidateCache } from "../utils/dataCache";
import { logAction } from "../utils/logger";
import { Spinner, Modal, Form, Button } from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Import Sub-Components
import EventDashboard from "../components/events/EventDashboard";
import EventParticipants from "../components/events/EventParticipants";
import EventSponsorship from "../components/events/EventSponsorship";
import EventMeetings from "../components/events/EventMeetings";
import EventTeams from "../components/events/EventTeams";
import EventTeachers from "../components/events/EventTeachers";

// Youth Festival Sub-Components
import YouthFestivalHost from "../components/events/youthFestival/YouthFestivalHost";
import YouthFestivalAccommodation from "../components/events/youthFestival/YouthFestivalAccommodation";
import YouthFestivalContingent from "../components/events/youthFestival/YouthFestivalContingent";
import EventYouthFestivalVenues from "../components/events/youthFestival/EventYouthFestivalVenues";
import YouthFestivalResults from "../components/events/youthFestival/YouthFestivalResults";
import YouthFestivalCheckIn from "../components/events/youthFestival/YouthFestivalCheckIn";

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role: userRole, user } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [currentView, setCurrentView] = useState("dashboard");
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingReport, setExportingReport] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofLinkDraft, setProofLinkDraft] = useState("");
  const [savingProofLink, setSavingProofLink] = useState(false);

  const normalizeProofUrl = (value = "") => {
    const trimmed = String(value).trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const isValidHttpUrl = (value = "") => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  // --- INITIAL DATA FETCHING (INSTANT CACHE - NO LOADING SCREEN) ---
  useEffect(() => {
    loadWithCache(
      `event_details_${id}`,
      async () => {
        const eventSnap = await getDoc(doc(db, "events", id));
        if (eventSnap.exists()) {
          return { id: eventSnap.id, ...eventSnap.data() };
        }
        return null;
      },
      (data, isCached) => {
        if (data) {
          setEventData(data);
          if (isCached) setLoading(false);
        } else if (!isCached) {
          navigate("/");
        }
      },
      () => setLoading(false)
    );
    setLoading(false);
  }, [id, navigate]);

  const handleDeleteEvent = async () => {
    const confirmed = await confirm({
      title: "Delete Event",
      message: "Are you sure you want to delete this event? This cannot be undone.",
      variant: "danger",
      confirmText: "Delete Event",
    });
    if (confirmed) {
      try {
        await deleteDoc(doc(db, "events", id));
        invalidateCache("all_events_list");
        invalidateCache(`event_details_${id}`);
        await logAction(
          "DELETE_EVENT",
          `Deleted event "${eventData?.title || id}"`,
          user,
        );
        showSuccess("Event deleted successfully.");
        navigate("/");
      } catch (err) {
        console.error(err);
        showError("Failed to delete event.");
      }
    }
  };

  const handleOpenProofModal = () => {
    setProofLinkDraft(eventData?.proofUrl || "");
    setShowProofModal(true);
  };

  const handleSaveProofLink = async () => {
    if (savingProofLink) return;

    const normalizedProofUrl = normalizeProofUrl(proofLinkDraft);
    if (normalizedProofUrl && !isValidHttpUrl(normalizedProofUrl)) {
      showError("Please enter a valid proof URL.");
      return;
    }

    setSavingProofLink(true);
    try {
      await updateDoc(doc(db, "events", id), { proofUrl: normalizedProofUrl });
      invalidateCache(`event_details_${id}`);
      await logAction(
        "UPDATE_PROOF",
        `Updated proof link for event "${eventData?.title || id}"`,
        user,
      );
      setEventData((prev) =>
        prev ? { ...prev, proofUrl: normalizedProofUrl } : prev,
      );
      showSuccess("Proof link saved.");
      setShowProofModal(false);
    } catch (error) {
      console.error("Error saving proof link:", error);
      showError("Could not save proof link. Please try again.");
    } finally {
      setSavingProofLink(false);
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

      const proofUrl = normalizeProofUrl(eventData?.proofUrl || "");
      if (proofUrl) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("Upload Proof:", 14, 36);
        pdf.setTextColor(0, 0, 255);
        pdf.textWithLink(proofUrl, 36, 36, { url: proofUrl });
        pdf.setTextColor(0, 0, 0);
      }

      let currentY = proofUrl ? 46 : 40;
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

      // Youth Festival Additional Sections
      if (eventData.isYouthFestival) {
        // Fetch YF Colleges
        const colSnap = await getDocs(collection(db, "events", id, "yf_colleges"));
        const yfColleges = colSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        renderSectionTitle("Youth Festival — Participating Colleges");
        const colRows = yfColleges.map((c, i) => [
          i + 1,
          c.name || "-",
          (c.incharges || []).filter((ic) => ic.name).map((ic) => ic.name).join(", ") || "-",
          c.selectedEvents?.length || 0,
          c.needsAccommodation ? "Yes" : "No",
        ]);
        renderGridTable(
          ["S.No", "College Name", "Incharges", "Events Selected", "Accommodation"],
          colRows.length > 0 ? colRows : [["-", "No colleges registered", "-", "-", "-"]]
        );

        // Fetch Venue Mapping
        const vmSnap = await getDoc(doc(db, "events", id, "meta", "yf_venue_mapping"));
        if (vmSnap.exists()) {
          const mapping = vmSnap.data().mapping || {};
          renderSectionTitle("Youth Festival — Venue Mapping");
          const vmRows = Object.entries(mapping)
            .filter(([, m]) => m.venueName)
            .map(([evId, m], i) => [
              i + 1,
              evId,
              m.venueName || "-",
              m.day || "-",
              m.time || "-",
              m.notes || "-",
            ]);
          renderGridTable(
            ["S.No", "Event ID", "Venue", "Day", "Time", "Notes"],
            vmRows.length > 0 ? vmRows : [["-", "No venue mapping", "-", "-", "-", "-"]]
          );
        }

        // Fetch Accommodation Allotments
        const accSnap = await getDocs(collection(db, "events", id, "yf_accommodation_allotments"));
        const yfAllotments = accSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (yfAllotments.length > 0) {
          renderSectionTitle("Youth Festival — Accommodation Allotments");
          const accRows = yfAllotments.map((a, i) => [
            i + 1,
            a.personName || "-",
            a.collegeName || "-",
            a.facility || "-",
            a.room || "-",
            a.checkInStatus || "Expected",
            a.checkInTime || "-",
          ]);
          renderGridTable(
            ["S.No", "Person", "College", "Facility", "Room", "Status", "Check-in Time"],
            accRows
          );
        }
      }

      const safeName = (eventData.title || "Event")
        .replace(/[^a-z0-9\-_.\s]/gi, "")
        .trim()
        .replace(/\s+/g, "_");

      pdf.save(`${safeName || "Event"}_Report.pdf`);
    } catch (error) {
      console.error("Error exporting event report:", error);
      showError("Could not export event report. Please try again.");
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
      case "yf_host":
        return (
          <YouthFestivalHost
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "yf_checkin":
        return (
          <YouthFestivalCheckIn
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "yf_venues":
        return (
          <EventYouthFestivalVenues
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "yf_accommodation":
        return (
          <YouthFestivalAccommodation
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "yf_contingent":
        return (
          <YouthFestivalContingent
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

      case "yf_results":
        return (
          <YouthFestivalResults
            eventId={id}
            goBack={() => setCurrentView("dashboard")}
          />
        );

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
            onManageProofLink={handleOpenProofModal}
            hasProofLink={!!String(eventData?.proofUrl || "").trim()}
            onExportReport={handleExportEventReport}
            exportingReport={exportingReport}
          />
        );
    }
  };

  // Wrap everything in Layout so Sidebar persists even during loading
  return (
    <Layout>
      {renderView()}

      <Modal show={showProofModal} onHide={() => setShowProofModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Proof Link</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Proof URL (link only)</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://drive.google.com/..."
              value={proofLinkDraft}
              onChange={(e) => setProofLinkDraft(e.target.value)}
            />
            <Form.Text className="text-muted">
              This link will appear at the top of the exported Event Report PDF.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowProofModal(false)}
            disabled={savingProofLink}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveProofLink}
            disabled={savingProofLink}
          >
            {savingProofLink ? "Saving..." : "Save Link"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}
