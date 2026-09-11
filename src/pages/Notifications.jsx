import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Badge, Button, Form, InputGroup } from "react-bootstrap";
import Layout from "../components/Layout";
import { useNotifications, formatRelativeTime } from "../context/NotificationContext";

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    readIds,
    markAllAsRead,
    toggleRead,
    quickApproveUser,
  } = useNotifications();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'approval' | 'activity' | 'broadcast'
  const [approvingId, setApprovingId] = useState(null);

  // Tab count metrics
  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: unreadCount,
      approval: notifications.filter((n) => n.type === "approval").length,
      activity: notifications.filter((n) => n.type === "activity").length,
      broadcast: notifications.filter((n) => n.type === "broadcast").length,
    };
  }, [notifications, unreadCount]);

  // Filtered and searched list
  const filteredList = useMemo(() => {
    let list = notifications;

    if (activeTab === "unread") {
      list = list.filter((n) => !readIds.has(n.id));
    } else if (activeTab !== "all") {
      list = list.filter((n) => n.type === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          n.category?.toLowerCase().includes(q) ||
          n.badge?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifications, activeTab, searchQuery, readIds]);

  const handleQuickApprove = async (item) => {
    setApprovingId(item.sourceId);
    await quickApproveUser(item.sourceId, item.data);
    setApprovingId(null);
  };

  return (
    <Layout>
      <Container fluid className="px-0 py-2">
        {/* PAGE HEADER */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
          <div>
            <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
              <span>Notification Center</span>
              {unreadCount > 0 && (
                <Badge bg="danger" pill style={{ fontSize: "13px" }}>
                  {unreadCount} Unread
                </Badge>
              )}
            </h3>
            <p className="text-muted small mb-0">
              Audit trails, member registrations, and broadcast communications.
            </p>
          </div>

          <div className="d-flex gap-2">
            <Button
              variant={unreadCount > 0 ? "outline-primary" : "outline-secondary"}
              size="sm"
              className="rounded-pill px-3 fw-semibold d-flex align-items-center gap-2"
              disabled={unreadCount === 0}
              onClick={markAllAsRead}
            >
              <i className="bi bi-check2-all me-1"></i>
              <span>{unreadCount > 0 ? "Mark all as read" : "All caught up"}</span>
            </Button>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <Card
          className="border-0 shadow-sm mb-4"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
            borderColor: "var(--border-color)",
          }}
        >
          <Card.Body className="p-3">
            <Row className="g-3 align-items-center">
              <Col xs={12} md={5}>
                <InputGroup size="sm">
                  <InputGroup.Text
                    style={{
                      backgroundColor: "var(--bg-main)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search notifications by title, details, action..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                  {searchQuery && (
                    <Button
                      variant="outline-secondary"
                      onClick={() => setSearchQuery("")}
                    >
                      <i className="bi bi-x-lg"></i>
                    </Button>
                  )}
                </InputGroup>
              </Col>

              {/* FILTER BUTTONS */}
              <Col xs={12} md={7}>
                <div className="d-flex flex-wrap gap-2 justify-content-md-end">
                  <Button
                    size="sm"
                    variant={activeTab === "all" ? "primary" : "outline-secondary"}
                    className="rounded-pill px-2.5 py-1"
                    style={{ fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setActiveTab("all")}
                  >
                    All ({counts.all})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "unread" ? "danger" : "outline-secondary"}
                    className="rounded-pill px-2.5 py-1"
                    style={{ fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setActiveTab("unread")}
                  >
                    Unread ({counts.unread})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "approval" ? "warning" : "outline-secondary"}
                    className="rounded-pill px-2.5 py-1"
                    style={{ fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setActiveTab("approval")}
                  >
                    Approvals ({counts.approval})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "activity" ? "info" : "outline-secondary"}
                    className="rounded-pill px-2.5 py-1"
                    style={{ fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setActiveTab("activity")}
                  >
                    Logs ({counts.activity})
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === "broadcast" ? "secondary" : "outline-secondary"}
                    className="rounded-pill px-2.5 py-1"
                    style={{ fontSize: "12px", fontWeight: 600 }}
                    onClick={() => setActiveTab("broadcast")}
                  >
                    Broadcasts ({counts.broadcast})
                  </Button>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* NOTIFICATIONS FEED */}
        <div className="d-flex flex-column gap-3">
          {filteredList.length === 0 ? (
            <Card
              className="text-center py-5 border-0 shadow-sm"
              style={{
                backgroundColor: "var(--bg-card)",
                color: "var(--text-muted)",
              }}
            >
              <Card.Body>
                <i className="bi bi-bell-slash display-4 opacity-25 d-block mb-3"></i>
                <h5 className="fw-bold text-body">No notifications found</h5>
                <p className="small text-muted mb-0">
                  {searchQuery
                    ? "Try adjusting your search keywords or filter tab."
                    : "You are all caught up! No notifications in this view."}
                </p>
              </Card.Body>
            </Card>
          ) : (
            filteredList.map((item) => {
              const isUnread = !readIds.has(item.id);
              const formattedDate = item.timestamp?.toDate
                ? item.timestamp.toDate().toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : new Date(item.timestamp).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

              return (
                <Card
                  key={item.id}
                  className="border-0 shadow-sm transition-all"
                  style={{
                    backgroundColor: isUnread
                      ? "rgba(13, 110, 253, 0.04)"
                      : "var(--bg-card)",
                    color: "var(--text-primary)",
                    borderLeft: isUnread
                      ? "4px solid var(--bs-primary)"
                      : "4px solid transparent",
                  }}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex flex-column flex-sm-row align-items-start justify-content-between gap-3">
                      {/* Left icon & content */}
                      <div className="d-flex align-items-start gap-3 flex-grow-1">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                          style={{
                            width: "44px",
                            height: "44px",
                            backgroundColor: "var(--soft-hover)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <i className={`bi ${item.icon} ${item.iconColor} fs-5`}></i>
                        </div>

                        <div className="flex-grow-1">
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <span className="fw-bold">{item.title}</span>
                            <Badge
                              bg={item.badgeVariant || "secondary"}
                              style={{ fontSize: "11px" }}
                            >
                              {item.badge}
                            </Badge>
                            {isUnread && (
                              <Badge bg="primary" pill style={{ fontSize: "10px" }}>
                                New
                              </Badge>
                            )}
                          </div>

                          <p
                            className="text-body mb-2 small"
                            style={{ lineHeight: 1.4 }}
                          >
                            {item.description}
                          </p>

                          <div
                            className="text-muted d-flex flex-wrap align-items-center gap-3"
                            style={{ fontSize: "12px" }}
                          >
                            <span>
                              <i className="bi bi-clock me-1"></i>
                              {formatRelativeTime(item.timestamp)} ({formattedDate})
                            </span>
                            {item.data?.performedBy && (
                              <span>
                                <i className="bi bi-person me-1"></i>
                                By {item.data.performedBy}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="d-flex align-items-center gap-2 flex-shrink-0 align-self-sm-center ms-auto">
                        {/* Approval Quick Action */}
                        {item.type === "approval" && (
                          <Button
                            variant="success"
                            size="sm"
                            className="rounded-pill px-3 fw-semibold"
                            disabled={approvingId === item.sourceId}
                            onClick={() => handleQuickApprove(item)}
                          >
                            {approvingId === item.sourceId ? (
                              "Approving..."
                            ) : (
                              <>
                                <i className="bi bi-check-lg me-1"></i>
                                Approve
                              </>
                            )}
                          </Button>
                        )}

                        {/* Navigation link */}
                        {item.type === "approval" && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="rounded-pill px-3"
                            onClick={() => navigate("/users")}
                          >
                            Review
                          </Button>
                        )}
                        {item.type === "broadcast" && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="rounded-pill px-3"
                            onClick={() => navigate("/email")}
                          >
                            View
                          </Button>
                        )}
                        {item.type === "activity" && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="rounded-pill px-3"
                            onClick={() => navigate("/activity-logs")}
                          >
                            Logs
                          </Button>
                        )}

                        {/* Toggle Read */}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-1 text-muted text-decoration-none"
                          title={isUnread ? "Mark as read" : "Mark as unread"}
                          onClick={() => toggleRead(item.id)}
                        >
                          <i
                            className={`bi ${isUnread ? "bi-envelope" : "bi-envelope-open"} fs-5`}
                          ></i>
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              );
            })
          )}
        </div>
      </Container>
    </Layout>
  );
}
