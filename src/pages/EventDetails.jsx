import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { Spinner } from "react-bootstrap";
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
          />
        );
    }
  };

  // Wrap everything in Layout so Sidebar persists even during loading
  return <Layout>{renderView()}</Layout>;
}
