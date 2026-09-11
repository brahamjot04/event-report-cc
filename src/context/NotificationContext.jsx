/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { logAction } from "../utils/logger";
import { invalidateCache } from "../utils/dataCache";

export function formatRelativeTime(date) {
  if (!date) return "";
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [broadcastEmails, setBroadcastEmails] = useState([]);

  // Read notification IDs stored in localStorage per user
  const currentUid = user?.uid || null;
  const storageKey = currentUid ? `cc_read_notifs_${currentUid}` : "cc_read_notifs_guest";

  const [readIds, setReadIds] = useState(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount and whenever user account changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setReadIds(new Set(parsed));
        } else {
          setReadIds(new Set());
        }
      } else {
        setReadIds(new Set());
      }
    } catch (e) {
      console.error("Failed to load read notifications:", e);
      setReadIds(new Set());
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Persist read IDs to localStorage only after load
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...readIds]));
    } catch (e) {
      console.error("Failed to save read notifications:", e);
    }
  }, [readIds, storageKey, isLoaded]);

  // 1. Listen for Pending User Signups (Admins)
  useEffect(() => {
    if (!isAdmin) {
      setPendingUsers([]);
      return;
    }
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingUsers(list);
      },
      (err) => console.error("Pending users listener error:", err)
    );
    return () => unsub();
  }, [isAdmin]);

  // 2. Listen for Recent Activity Logs (Admins)
  useEffect(() => {
    if (!isAdmin) {
      setActivityLogs([]);
      return;
    }
    const q = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setActivityLogs(list);
      },
      (err) => console.error("Logs listener error:", err)
    );
    return () => unsub();
  }, [isAdmin]);

  // 3. Listen for Recent Sent Broadcast Emails
  useEffect(() => {
    if (!user) {
      setBroadcastEmails([]);
      return;
    }
    const q = query(
      collection(db, "sent_emails"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBroadcastEmails(list);
      },
      (err) => console.error("Broadcasts listener error:", err)
    );
    return () => unsub();
  }, [user]);

  // Aggregate normalized notifications
  const notifications = useMemo(() => {
    const items = [];

    // Pending User Approvals
    pendingUsers.forEach((u) => {
      items.push({
        id: `user-${u.id}`,
        sourceId: u.id,
        type: "approval",
        category: "Approvals",
        title: "New Member Signup",
        description: `${u.name || u.email} requested committee portal access.`,
        timestamp: u.createdAt || new Date(),
        badge: "Pending Approval",
        badgeVariant: "danger",
        icon: "bi-person-plus-fill",
        iconColor: "text-danger",
        data: u,
      });
    });

    // Recent Activity Logs
    activityLogs.forEach((l) => {
      items.push({
        id: `log-${l.id}`,
        sourceId: l.id,
        type: "activity",
        category: "System Logs",
        title: l.action || "System Action",
        description: l.description || "Activity recorded in portal.",
        timestamp: l.timestamp || new Date(),
        badge: l.action,
        badgeVariant: "info",
        icon: "bi-clock-history",
        iconColor: "text-info",
        data: l,
      });
    });

    // Recent Broadcasts
    broadcastEmails.forEach((b) => {
      items.push({
        id: `email-${b.id}`,
        sourceId: b.id,
        type: "broadcast",
        category: "Broadcasts",
        title: `Announcement: ${b.subject || "Broadcast Email"}`,
        description: `Sent to ${b.recipientCount || 0} recipients by ${b.sender?.name || "Admin"}.`,
        timestamp: b.createdAt || b.sentDate || new Date(),
        badge: "Broadcast",
        badgeVariant: "primary",
        icon: "bi-envelope-fill",
        iconColor: "text-primary",
        data: b,
      });
    });

    // Sort newest first
    items.sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
      return (timeB || 0) - (timeA || 0);
    });

    return items;
  }, [pendingUsers, activityLogs, broadcastEmails]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      return next;
    });
    showSuccess("All notifications marked as read.");
  }, [notifications, showSuccess]);

  // Mark single item as read
  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Toggle single item read status
  const toggleRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Quick 1-click Approve User
  const quickApproveUser = useCallback(
    async (userId, userData) => {
      try {
        await updateDoc(doc(db, "users", userId), {
          status: "approved",
          role: userData?.role || "user",
        });
        invalidateCache("all_users_list");
        invalidateCache("email_recipients_approved_users");
        await logAction(
          "APPROVE",
          `Quick Approved user: ${userData?.name || userData?.email} from Notification Center`
        );
        markAsRead(`user-${userId}`);
        showSuccess(`Approved access for ${userData?.name || userData?.email}.`);
      } catch (err) {
        console.error("Quick approve failed:", err);
        showError("Failed to approve user: " + err.message);
      }
    },
    [markAsRead, showSuccess, showError]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      pendingCount: pendingUsers.length,
      readIds,
      markAllAsRead,
      markAsRead,
      toggleRead,
      quickApproveUser,
    }),
    [
      notifications,
      unreadCount,
      pendingUsers.length,
      readIds,
      markAllAsRead,
      markAsRead,
      toggleRead,
      quickApproveUser,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
