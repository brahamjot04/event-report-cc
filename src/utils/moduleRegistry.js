/**
 * Central registry of event modules and utility functions for
 * dynamic module enable/disable management.
 */

export const ALL_EVENT_MODULES = [
  // --- YOUTH FESTIVAL HOST MODULES ---
  {
    id: "yf_host",
    title: "Colleges & Participants",
    subtitle: "Manage colleges, participants & search",
    icon: "bi-building",
    colorClass: "warning",
    category: "Youth Festival",
    isYouthFestivalHost: true,
  },
  {
    id: "yf_checkin",
    title: "Desk Check-in & Arrivals",
    subtitle: "Gate reception, arrival status & CSV rosters",
    icon: "bi-person-check-fill",
    colorClass: "info",
    category: "Youth Festival",
    isYouthFestivalHost: true,
  },
  {
    id: "yf_venues",
    title: "Venue Mapping",
    subtitle: "Assign venues, days & times to events",
    icon: "bi-geo-alt-fill",
    colorClass: "success",
    category: "Youth Festival",
    isYouthFestivalHost: true,
  },
  {
    id: "yf_accommodation",
    title: "Accommodation",
    subtitle: "Room allotment & check-in tracking",
    icon: "bi-house-fill",
    colorClass: "primary",
    category: "Youth Festival",
    isYouthFestivalHost: true,
  },
  {
    id: "yf_results",
    title: "Results & Trophies",
    subtitle: "Positions, point scoring & overall trophies",
    icon: "bi-trophy-fill",
    colorClass: "danger",
    category: "Youth Festival",
    isYouthFestivalHost: true,
  },

  // --- YOUTH FESTIVAL CONTINGENT (NON-HOST) MODULES ---
  {
    id: "yf_contingent",
    title: "GNDEC Contingent",
    subtitle: "Manage our participation roster",
    icon: "bi-people-fill",
    colorClass: "warning",
    category: "Youth Festival",
    isYouthFestivalContingent: true,
  },

  // --- GENERAL EVENT MODULES ---
  {
    id: "attendance_sessions",
    title: "Meetings",
    subtitle: "Track committee attendance",
    icon: "bi-calendar-check-fill",
    colorClass: "success",
    category: "General",
    isGeneral: true,
  },
  {
    id: "teams",
    title: "Teams",
    subtitle: "Manage committees & members",
    icon: "bi-diagram-3-fill",
    colorClass: "info",
    category: "General",
    isGeneral: true,
  },
  {
    id: "teachers",
    title: "Teachers",
    subtitle: "Manage teacher entries",
    icon: "bi-person-vcard-fill",
    colorClass: "secondary",
    category: "General",
    isGeneral: true,
  },
  {
    id: "sponsorship",
    title: "Sponsorship",
    subtitle: "Manage sponsors & funds",
    icon: "bi-briefcase-fill",
    colorClass: "warning",
    category: "General",
    isGeneral: true,
  },
  {
    id: "participants",
    title: "Participants",
    subtitle: "Manage items, students & categories",
    icon: "bi-people-fill",
    colorClass: "primary",
    category: "General",
    isRegularOnly: true,
  },
];

/**
 * Returns the list of modules that apply to a given event based on its type.
 * @param {Object} eventData - The event document data
 * @returns {Array} Applicable module definitions
 */
export function getApplicableModules(eventData) {
  if (!eventData) return [];

  const isYF = !!eventData.isYouthFestival;
  const isHost = isYF && !!eventData.isHostCollege;

  return ALL_EVENT_MODULES.filter((mod) => {
    if (mod.isYouthFestivalHost) {
      return isHost;
    }
    if (mod.isYouthFestivalContingent) {
      return isYF && !isHost;
    }
    if (mod.isRegularOnly) {
      return !isYF;
    }
    if (mod.isGeneral) {
      return true;
    }
    return false;
  });
}

/**
 * Checks if a specific module is enabled for an event.
 * @param {Object} eventData - The event document data
 * @param {string} moduleId - The ID of the module
 * @returns {boolean} True if the module is enabled
 */
export function isModuleEnabled(eventData, moduleId) {
  if (!eventData) return false;
  const disabledList = eventData.disabledModules || [];
  return !disabledList.includes(moduleId);
}
