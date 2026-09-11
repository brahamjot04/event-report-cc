import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button } from "react-bootstrap";
import { useNotifications, formatRelativeTime } from "../context/NotificationContext";

export default function NotificationDropdown({ isOpen, onClose }) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    readIds,
    markAllAsRead,
    markAsRead,
    toggleRead,
    quickApproveUser,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'unread' | 'approvals'
  const [approvingId, setApprovingId] = useState(null);

  // Close on click outside (ignore click if clicked on the bell toggle button)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (e.target.closest && e.target.closest(".notification-bell-btn")) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const approvalCount = useMemo(
    () => notifications.filter((n) => n.type === "approval").length,
    [notifications]
  );

  // Filtered notifications preview (top 15)
  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (activeFilter === "unread") {
      list = list.filter((n) => !readIds.has(n.id));
    } else if (activeFilter === "approvals") {
      list = list.filter((n) => n.type === "approval");
    }
    return list.slice(0, 15);
  }, [notifications, activeFilter, readIds]);

  if (!isOpen) return null;

  const handleItemClick = (item) => {
    markAsRead(item.id);
    if (item.type === "approval") {
      navigate("/users");
    } else if (item.type === "broadcast") {
      navigate("/email");
    } else if (item.type === "activity") {
      navigate("/activity-logs");
    }
    onClose();
  };

  const handleQuickApprove = async (e, item) => {
    e.stopPropagation();
    setApprovingId(item.sourceId);
    await quickApproveUser(item.sourceId, item.data);
    setApprovingId(null);
  };

  return (
    <div
      ref={dropdownRef}
      className="position-absolute end-0 mt-2 shadow-lg rounded-3 border overflow-hidden d-flex flex-column"
      style={{
        top: "100%",
        width: "380px",
        minWidth: "340px",
        maxWidth: "calc(100vw - 2rem)",
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-color)",
        color: "var(--text-primary)",
        zIndex: 1050,
      }}
    >
      {/* HEADER */}
      <div
        className="d-flex align-items-center justify-content-between p-3 border-bottom gap-2"
        style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="d-flex align-items-center gap-2 flex-shrink-0 text-nowrap">
          <span className="fw-bold fs-6 text-nowrap">Notifications</span>
          {unreadCount > 0 ? (
            <Badge bg="danger" pill style={{ fontSize: "11px" }}>
              {unreadCount} new
            </Badge>
          ) : (
            <Badge bg="secondary" pill style={{ fontSize: "11px" }}>
              0 new
            </Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="notification-text-btn text-primary text-decoration-none small fw-semibold d-flex align-items-center gap-1 border-0 bg-transparent p-0 flex-shrink-0 text-nowrap"
            style={{
              fontSize: "12px",
              whiteSpace: "nowrap",
              width: "auto",
              height: "auto",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              markAllAsRead();
            }}
            title="Mark all notifications as read"
          >
            <i className="bi bi-check2-all fs-6 me-1"></i>
            <span style={{ whiteSpace: "nowrap" }}>Mark all read</span>
          </button>
        )}
      </div>

      {/* FILTER TABS */}
      <div
        className="d-flex gap-2 p-2 border-bottom small overflow-x-auto text-nowrap"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--soft-hover)",
        }}
      >
        <button
          type="button"
          className={`btn btn-sm py-1 px-2.5 rounded-pill border-0 flex-shrink-0 text-nowrap ${activeFilter === "all" ? "btn-primary text-white" : "btn-link text-muted text-decoration-none"}`}
          style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}
          onClick={() => setActiveFilter("all")}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm py-1 px-2.5 rounded-pill border-0 flex-shrink-0 text-nowrap ${activeFilter === "unread" ? "btn-primary text-white" : "btn-link text-muted text-decoration-none"}`}
          style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}
          onClick={() => setActiveFilter("unread")}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          className={`btn btn-sm py-1 px-2.5 rounded-pill border-0 flex-shrink-0 text-nowrap ${activeFilter === "approvals" ? "btn-primary text-white" : "btn-link text-muted text-decoration-none"}`}
          style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}
          onClick={() => setActiveFilter("approvals")}
        >
          Approvals ({approvalCount})
        </button>
      </div>

      {/* NOTIFICATIONS LIST */}
      <div
        className="notification-scrollbar flex-grow-1"
        style={{
          maxHeight: "340px",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-5 text-muted px-3">
            <i className="bi bi-bell-slash fs-2 opacity-25 d-block mb-2"></i>
            <div className="fw-semibold small">You&apos;re all caught up!</div>
            <div className="small opacity-75" style={{ fontSize: "11px" }}>
              No notifications in this filter view
            </div>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !readIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="p-3 border-bottom notification-item-hover d-flex align-items-start gap-3 position-relative"
                style={{
                  cursor: "pointer",
                  borderColor: "var(--border-color)",
                  backgroundColor: isUnread
                    ? "rgba(13, 110, 253, 0.05)"
                    : "transparent",
                  borderLeft: isUnread
                    ? "3px solid var(--bs-primary)"
                    : "3px solid transparent",
                  transition: "background-color 0.15s ease",
                }}
              >
                {/* Category Icon */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                  style={{
                    width: "36px",
                    height: "36px",
                    backgroundColor: "var(--bg-main)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <i className={`bi ${item.icon} ${item.iconColor} fs-6`}></i>
                </div>

                {/* Content */}
                <div className="flex-grow-1 overflow-hidden">
                  <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                    <span
                      className="fw-bold small text-truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </span>
                    <span
                      className="text-muted flex-shrink-0"
                      style={{ fontSize: "11px" }}
                    >
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  <div
                    className="text-muted mb-2"
                    style={{
                      fontSize: "12px",
                      lineHeight: "1.4",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}
                  >
                    {item.description}
                  </div>

                  {/* Action row */}
                  <div className="d-flex align-items-center justify-content-between gap-2 pt-1">
                    {item.type === "approval" ? (
                      <div className="d-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="success"
                          className="py-0.5 px-2 rounded-pill fw-bold d-flex align-items-center gap-1"
                          style={{ fontSize: "11px" }}
                          disabled={approvingId === item.sourceId}
                          onClick={(e) => handleQuickApprove(e, item)}
                        >
                          {approvingId === item.sourceId ? (
                            "Approving..."
                          ) : (
                            <>
                              <i className="bi bi-check-lg"></i>
                              <span>Approve</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          className="py-0.5 px-2 rounded-pill"
                          style={{ fontSize: "11px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                            navigate("/users");
                            onClose();
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="badge rounded-pill"
                        style={{
                          fontSize: "10px",
                          backgroundColor: "var(--soft-hover)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-color)",
                          fontWeight: 500,
                        }}
                      >
                        {item.category}
                      </span>
                    )}

                    {/* Dedicated Mark Read / Unread Button */}
                    <button
                      type="button"
                      className="btn btn-link p-1 text-decoration-none ms-auto border-0"
                      title={isUnread ? "Mark as read" : "Mark as unread"}
                      style={{ fontSize: "13px", lineHeight: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRead(item.id);
                      }}
                    >
                      <i
                        className={`bi ${
                          isUnread
                            ? "bi-check2-circle text-primary"
                            : "bi-check2-all text-muted"
                        }`}
                        style={{ fontSize: "14px" }}
                      ></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER */}
      <div
        className="p-2 border-top text-center"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--bg-card)",
        }}
      >
        <button
          type="button"
          className="btn btn-outline-primary btn-sm w-100 rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2"
          style={{ fontSize: "12px", padding: "6px 12px", whiteSpace: "nowrap" }}
          onClick={() => {
            navigate("/notifications");
            onClose();
          }}
        >
          <span>View All in Notification Center</span>
          <i className="bi bi-arrow-right"></i>
        </button>
      </div>
    </div>
  );
}
