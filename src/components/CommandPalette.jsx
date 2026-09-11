import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { loadWithCache } from "../utils/dataCache";
import { useAuth } from "../context/AuthContext";
import { usePwa } from "../context/PwaContext";
import { Modal, Form, Badge } from "react-bootstrap";

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { isInstallable, isInstalled, promptInstall } = usePwa();
  const [queryText, setQueryText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [events, setEvents] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load events for search
  const fetchEvents = useCallback(() => {
    loadWithCache(
      "all_events_list",
      async () => {
        const snap = await getDocs(collection(db, "events"));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      (data) => setEvents(data),
      () => {}
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
      setQueryText("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, fetchEvents]);

  // Auto-scroll results container to keep selectedIndex visible
  useEffect(() => {
    if (!listRef.current) return;
    if (selectedIndex === 0) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const selectedEl = listRef.current.querySelector(
      `[data-flat-idx="${selectedIndex}"]`
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Navigation Items
  const navItems = useMemo(() => {
    const items = [
      {
        id: "nav-dash",
        category: "Navigation",
        title: "Dashboard & Events",
        subtitle: "View all college activities and youth festivals",
        icon: "bi-grid-fill text-primary",
        action: () => navigate("/"),
      },
      {
        id: "nav-cal",
        category: "Navigation",
        title: "Event Calendar",
        subtitle: "Timeline of scheduled events & multi-day festivals",
        icon: "bi-calendar3 text-warning",
        action: () => navigate("/calendar"),
      },
      {
        id: "nav-core",
        category: "Navigation",
        title: "Core Team",
        subtitle: "Cultural Committee members and designations",
        icon: "bi-people-fill text-info",
        action: () => navigate("/core-team"),
      },
      {
        id: "nav-prof",
        category: "Navigation",
        title: "My Profile",
        subtitle: "Account settings, name and password",
        icon: "bi-person-circle text-secondary",
        action: () => navigate("/profile"),
      },
    ];

    if (isAdmin) {
      items.push(
        {
          id: "nav-email",
          category: "Navigation",
          title: "Broadcast Email",
          subtitle: "Send announcements & inspect sent history",
          icon: "bi-envelope-fill text-danger",
          action: () => navigate("/email"),
        },
        {
          id: "nav-users",
          category: "Navigation",
          title: "User Management",
          subtitle: "Manage committee member access & approvals",
          icon: "bi-shield-lock-fill text-success",
          action: () => navigate("/users"),
        },
        {
          id: "nav-logs",
          category: "Navigation",
          title: "System Activity Logs",
          subtitle: "Audit trails of system updates and mutations",
          icon: "bi-journal-text text-dark",
          action: () => navigate("/activity-logs"),
        },
        {
          id: "nav-notifs",
          category: "Navigation",
          title: "Notification Center",
          subtitle: "Review pending approvals, system updates, and alerts",
          icon: "bi-bell-fill text-danger",
          action: () => navigate("/notifications"),
        }
      );
    } else {
      items.push({
        id: "nav-notifs",
        category: "Navigation",
        title: "Notification Center",
        subtitle: "Review notifications, announcements, and alerts",
        icon: "bi-bell-fill text-danger",
        action: () => navigate("/notifications"),
      });
    }

    return items;
  }, [isAdmin, navigate]);

  // Quick Actions
  const actionItems = useMemo(() => {
    const items = [
      {
        id: "act-theme",
        category: "Quick Actions",
        title: "Toggle Dark / Light Theme",
        subtitle: "Switch between dark and light appearance",
        icon: "bi-moon-stars-fill text-warning",
        action: () => {
          const btn = document.querySelector(".theme-toggle-btn");
          if (btn) btn.click();
        },
      },
      {
        id: "act-cal",
        category: "Quick Actions",
        title: "Go to Calendar",
        subtitle: "Jump to chronological event view",
        icon: "bi-calendar-event text-primary",
        action: () => navigate("/calendar"),
      },
    ];

    if (isAdmin) {
      items.unshift({
        id: "act-email",
        category: "Quick Actions",
        title: "Compose Broadcast Email",
        subtitle: "Jump to announcement compose form",
        icon: "bi-send-fill text-danger",
        action: () => navigate("/email"),
      });
    }

    if (!isInstalled && isInstallable) {
      items.push({
        id: "act-install",
        category: "Quick Actions",
        title: "Install Event Management Portal",
        subtitle: "Install CCGNDEC app on your device for offline & native app experience",
        icon: "bi-download text-success",
        action: () => promptInstall(),
      });
    }

    return items;
  }, [isAdmin, navigate, isInstalled, isInstallable, promptInstall]);

  // Filtered Event Items
  const eventItems = useMemo(() => {
    return events.map((ev) => ({
      id: `ev-${ev.id}`,
      category: "Events",
      title: ev.title || "Untitled Event",
      subtitle: `${ev.isYouthFestival ? "Youth Festival · " : ""}${ev.venue || "Venue TBD"}${ev.date ? ` · ${ev.date}` : ""}`,
      icon: ev.isYouthFestival ? "bi-trophy-fill text-warning" : "bi-calendar-check text-success",
      badge: ev.isYouthFestival ? "Youth Festival" : null,
      action: () => navigate(`/event/${ev.id}`),
    }));
  }, [events, navigate]);

  // Filter and group
  const filteredFlatList = useMemo(() => {
    const q = queryText.toLowerCase().trim();
    const all = [...navItems, ...eventItems, ...actionItems];
    if (!q) return all;
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [queryText, navItems, eventItems, actionItems]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredFlatList.length > 0 ? (prev + 1) % filteredFlatList.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredFlatList.length > 0
          ? (prev - 1 + filteredFlatList.length) % filteredFlatList.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFlatList[selectedIndex]) {
        filteredFlatList[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Group by category for visual rendering
  const groupedResults = useMemo(() => {
    const map = {};
    filteredFlatList.forEach((item, flatIdx) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push({ ...item, flatIdx });
    });
    return map;
  }, [filteredFlatList]);

  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      centered
      backdropClassName="command-palette-backdrop"
      dialogClassName="modal-dialog-centered"
      contentClassName="border-0 shadow-lg overflow-hidden"
      style={{ zIndex: 1060 }}
    >
      <div
        className="soft-card p-0 border-0"
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-primary)",
        }}
      >
        {/* Search Header */}
        <div
          className="d-flex align-items-center p-3 border-bottom"
          style={{ borderColor: "var(--border-color)" }}
        >
          <i className="bi bi-search text-muted fs-5 me-3"></i>
          <Form.Control
            ref={inputRef}
            type="text"
            placeholder="Type a command, page name, or event..."
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="border-0 p-0 shadow-none fs-6"
            style={{
              backgroundColor: "transparent",
              color: "var(--text-primary)",
            }}
          />
          <Badge
            bg="secondary"
            className="ms-2 px-2 py-1 small fw-normal opacity-75"
            style={{ fontSize: "11px" }}
          >
            ESC
          </Badge>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="p-2"
          style={{
            maxHeight: "380px",
            overflowY: "auto",
            scrollBehavior: "smooth",
          }}
        >
          {filteredFlatList.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-search display-6 opacity-25 d-block mb-2"></i>
              <small>No commands or events found matching &ldquo;{queryText}&rdquo;</small>
            </div>
          ) : (
            Object.keys(groupedResults).map((category) => (
              <div key={category} className="mb-2">
                <div
                  className="px-3 py-1 small text-uppercase fw-bold text-muted"
                  style={{ fontSize: "11px", letterSpacing: "0.5px" }}
                >
                  {category}
                </div>
                {groupedResults[category].map((item) => {
                  const isSelected = item.flatIdx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      data-flat-idx={item.flatIdx}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(item.flatIdx)}
                      className="d-flex align-items-center justify-content-between px-3 py-2 rounded mb-1 transition-all"
                      style={{
                        cursor: "pointer",
                        backgroundColor: isSelected
                          ? "var(--soft-hover)"
                          : "transparent",
                        borderLeft: isSelected
                          ? "3px solid var(--bs-primary)"
                          : "3px solid transparent",
                      }}
                    >
                      <div className="d-flex align-items-center text-truncate">
                        <i className={`bi ${item.icon} fs-5 me-3 flex-shrink-0`}></i>
                        <div className="text-truncate">
                          <div className="fw-semibold text-body small">
                            {item.title}
                          </div>
                          <div
                            className="text-muted text-truncate"
                            style={{ fontSize: "12px" }}
                          >
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                        {item.badge && (
                          <Badge bg="warning" text="dark" style={{ fontSize: "10px" }}>
                            {item.badge}
                          </Badge>
                        )}
                        {isSelected && (
                          <span className="small text-muted" style={{ fontSize: "11px" }}>
                            ↵
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer Hint Bar */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2 border-top small text-muted"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--soft-hover)",
            fontSize: "11px",
          }}
        >
          <div className="d-flex gap-3">
            <span>
              <strong className="text-body">↑ ↓</strong> Navigate
            </span>
            <span>
              <strong className="text-body">↵</strong> Select
            </span>
            <span>
              <strong className="text-body">ESC</strong> Close
            </span>
          </div>
          <div>
            <span>Quick Jump</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
