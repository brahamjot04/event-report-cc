import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Card, Badge, Spinner, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        setEvents(
          querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const groupEventsByMonth = () => {
    const groups = {};
    events.forEach((event) => {
      const monthYear = new Date(event.date).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(event);
    });
    return groups;
  };

  const eventGroups = groupEventsByMonth();

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">Event Calendar</h3>
          <p className="text-muted small">
            Timeline of all scheduled activities
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : (
        <>
          {Object.keys(eventGroups).length === 0 ? (
            <div className="text-center p-5 text-muted">
              <i className="bi bi-calendar-x display-1 text-secondary opacity-25"></i>
              <p className="mt-3">No upcoming events found.</p>
            </div>
          ) : (
            Object.keys(eventGroups).map((month, index) => (
              <div key={index} className="mb-5">
                <h5 className="fw-bold text-primary mb-3 border-bottom pb-2 border-primary border-opacity-25 text-uppercase small letter-spacing-2">
                  {month}
                </h5>
                <Row className="g-3">
                  {eventGroups[month].map((event) => (
                    <Col md={12} key={event.id}>
                      <Card
                        className="border-0 shadow-sm hover-shadow transition-all soft-card"
                        style={{ transition: "0.2s" }}
                      >
                        <Card.Body className="d-flex align-items-center p-3">
                          {/* DATE BOX - FIXED COLORS */}
                          <div
                            className="rounded text-center p-2 me-3 d-flex flex-column justify-content-center border"
                            style={{
                              minWidth: "70px",
                              height: "70px",
                              backgroundColor: "var(--soft-hover)", // Adapts to dark/light
                              borderColor: "var(--border-color)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <span className="h4 fw-bold mb-0">
                              {new Date(event.date).getDate()}
                            </span>
                            <span
                              className="small text-uppercase"
                              style={{
                                fontSize: "10px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {new Date(event.date).toLocaleString("default", {
                                weekday: "short",
                              })}
                            </span>
                          </div>

                          {/* EVENT DETAILS - FIXED COLORS */}
                          <div className="flex-grow-1">
                            <h5 className="fw-bold mb-1">
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/event/${event.id}`);
                                }}
                                className="text-decoration-none stretched-link"
                                style={{ color: "var(--text-primary)" }} // Forces correct text color
                              >
                                {event.title}
                              </a>
                            </h5>
                            <div
                              className="small"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <i className="bi bi-geo-alt me-2 text-danger"></i>
                              {event.venue}
                            </div>
                          </div>

                          {/* ACTION BADGE */}
                          <div className="d-none d-md-block text-end">
                            <Badge
                              bg="primary"
                              className="fw-normal px-3 py-2 rounded-pill bg-opacity-10 text-primary"
                            >
                              View Details{" "}
                              <i className="bi bi-arrow-right ms-1"></i>
                            </Badge>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ))
          )}
        </>
      )}
    </Layout>
  );
}
