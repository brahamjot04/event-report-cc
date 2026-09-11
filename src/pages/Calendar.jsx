import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { loadWithCache } from "../utils/dataCache";
import { Card, Badge, Spinner, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadWithCache(
      "all_events_list",
      async () => {
        const q = query(collection(db, "events"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      },
      (data, isCached) => {
        setEvents(data);
        if (isCached) setLoading(false);
      },
      () => setLoading(false)
    );
    setLoading(false);
  }, []);

  const getEventDateObj = (event) => {
    const dateStr = event.startDate || event.date;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const groupEventsByMonth = () => {
    const sorted = [...events].sort((a, b) => {
      const timeA = getEventDateObj(a).getTime();
      const timeB = getEventDateObj(b).getTime();
      return timeB - timeA; // Most recent first (at top)
    });

    const groups = {};
    sorted.forEach((event) => {
      const d = getEventDateObj(event);
      const monthYear = d.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(event);
    });
    return groups;
  };

  const eventGroups = groupEventsByMonth();

  const renderDateBox = (event) => {
    if (event.isYouthFestival && event.startDate && event.endDate) {
      const startD = new Date(event.startDate);
      const endD = new Date(event.endDate);
      const startDay = !isNaN(startD.getTime()) ? startD.getDate() : "?";
      const endDay = !isNaN(endD.getTime()) ? endD.getDate() : "?";

      return (
        <div
          className="rounded text-center p-2 me-3 d-flex flex-column justify-content-center border"
          style={{
            minWidth: "85px",
            height: "75px",
            backgroundColor: "var(--soft-hover)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <span className="h5 fw-bold mb-0 text-warning">
            {startDay}–{endDay}
          </span>
          <span
            className="small text-uppercase fw-bold"
            style={{
              fontSize: "10px",
              color: "var(--text-secondary)",
            }}
          >
            {startD.toLocaleString("default", { month: "short" })}
          </span>
        </div>
      );
    }

    const d = getEventDateObj(event);
    return (
      <div
        className="rounded text-center p-2 me-3 d-flex flex-column justify-content-center border"
        style={{
          minWidth: "70px",
          height: "70px",
          backgroundColor: "var(--soft-hover)",
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        <span className="h4 fw-bold mb-0">{d.getDate()}</span>
        <span
          className="small text-uppercase"
          style={{
            fontSize: "10px",
            color: "var(--text-secondary)",
          }}
        >
          {d.toLocaleString("default", { weekday: "short" })}
        </span>
      </div>
    );
  };

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-0">Event Calendar</h3>
          <p className="text-muted small mb-0">
            Timeline of all scheduled activities and multi-day festivals
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
              <i className="bi bi-calendar-x display-1 text-secondary opacity-25" />
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
                          {/* DATE BOX */}
                          {renderDateBox(event)}

                          {/* EVENT DETAILS */}
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              <h5 className="fw-bold mb-0">
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate(`/event/${event.id}`);
                                  }}
                                  className="text-decoration-none stretched-link"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {event.title}
                                </a>
                              </h5>
                              {event.isYouthFestival && (
                                <Badge bg="warning" text="dark" className="rounded-pill">
                                  <i className="bi bi-trophy-fill me-1" />
                                  Youth Festival
                                </Badge>
                              )}
                              {event.isYouthFestival && event.isHostCollege && (
                                <Badge bg="success" className="rounded-pill">
                                  Host
                                </Badge>
                              )}
                            </div>
                            <div
                              className="small"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <i className="bi bi-geo-alt me-2 text-danger" />
                              {event.venue}
                              {event.isYouthFestival && event.startDate && (
                                <span className="ms-3">
                                  <i className="bi bi-calendar-range me-1 text-primary" />
                                  {event.startDate} – {event.endDate || "?"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ACTION BADGE */}
                          <div className="d-none d-md-block text-end">
                            <Badge
                              bg="primary"
                              className="fw-normal px-3 py-2 rounded-pill bg-opacity-10 text-primary"
                            >
                              View Details{" "}
                              <i className="bi bi-arrow-right ms-1" />
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
