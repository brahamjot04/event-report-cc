/**
 * Calculate smart countdown and status metadata for events.
 */
export function getEventStatusInfo(ev) {
  if (!ev) return { label: "Upcoming", variant: "primary", icon: null, isPast: false };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startStr = ev.startDate || ev.date;
  const endStr = ev.endDate || startStr;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  if (isNaN(startDate.getTime())) {
    return { label: "Upcoming", variant: "primary", icon: null, isPast: false };
  }

  const startMid = new Date(startDate);
  startMid.setHours(0, 0, 0, 0);

  const endMid = new Date(isNaN(endDate.getTime()) ? startDate : endDate);
  endMid.setHours(23, 59, 59, 999);

  // Ongoing / Happening Today
  if (now >= startMid && now <= endMid) {
    const isMultiDay = !!ev.isYouthFestival || (ev.startDate && ev.endDate && ev.startDate !== ev.endDate);
    return {
      label: isMultiDay ? "Ongoing" : "Happening Today",
      variant: "success",
      icon: "bi-fire",
      isCurrent: true,
      isPast: false,
    };
  }

  // Completed
  if (now > endMid) {
    return {
      label: "Completed",
      variant: "secondary",
      icon: null,
      isPast: true,
      isCurrent: false,
    };
  }

  // Future: countdown in days or weeks
  const diffTime = startMid.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return {
      label: "Tomorrow",
      variant: "primary",
      icon: "bi-hourglass-split",
      isPast: false,
      isCurrent: false,
    };
  }
  if (diffDays <= 7) {
    return {
      label: `In ${diffDays} days`,
      variant: "primary",
      icon: "bi-hourglass-split",
      isPast: false,
      isCurrent: false,
    };
  }
  if (diffDays <= 30) {
    const weeks = Math.ceil(diffDays / 7);
    return {
      label: `In ${weeks} week${weeks > 1 ? "s" : ""}`,
      variant: "info",
      icon: "bi-calendar-event",
      isPast: false,
      isCurrent: false,
    };
  }
  const months = Math.round(diffDays / 30);
  return {
    label: `In ${months} month${months > 1 ? "s" : ""}`,
    variant: "info",
    icon: "bi-calendar-event",
    isPast: false,
    isCurrent: false,
  };
}

/**
 * Record an event into recently viewed history in localStorage.
 */
export function recordRecentEvent(ev) {
  if (!ev || !ev.id) return;
  try {
    const raw = localStorage.getItem("cc_recent_events");
    let recents = raw ? JSON.parse(raw) : [];
    recents = recents.filter((r) => r.id !== ev.id);
    recents.unshift({
      id: ev.id,
      title: ev.title || "Untitled Event",
      venue: ev.venue || "",
      date: ev.startDate || ev.date || "",
      isYouthFestival: !!ev.isYouthFestival,
      timestamp: Date.now(),
    });
    localStorage.setItem("cc_recent_events", JSON.stringify(recents.slice(0, 8)));
  } catch {
    // non-fatal
  }
}

/**
 * Retrieve top recent events from localStorage.
 */
export function getRecentEvents(limit = 5) {
  try {
    const raw = localStorage.getItem("cc_recent_events");
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch {
    return [];
  }
}
