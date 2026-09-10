// PTU Youth Festival — 32 Standardized Events with max Participant (P) and Alternate (A) quotas

export const YF_EVENTS = [
  // ─── Music (10) ───────────────────────────────────────────
  {
    id: "music_classical_perc",
    name: "Classical Instrumental (Percussion)",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_classical_non_perc",
    name: "Classical Instrumental (Non-Percussion)",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_classical_vocal",
    name: "Classical Vocal (Solo)",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_light_vocal",
    name: "Light Vocal Indian",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_folk_song",
    name: "Folk Song",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_group_song_indian",
    name: "Group Song Indian",
    category: "Music",
    maxP: 6,
    maxA: 3,
  },
  {
    id: "music_group_shabad",
    name: "Group Shabad/Bhajan",
    category: "Music",
    maxP: 6,
    maxA: 3,
  },
  {
    id: "music_western_vocal",
    name: "Western Vocal Solo",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },
  {
    id: "music_western_group",
    name: "Western Group Song",
    category: "Music",
    maxP: 6,
    maxA: 3,
  },
  {
    id: "music_vaar",
    name: "Vaar Singing",
    category: "Music",
    maxP: 1,
    maxA: 2,
  },

  // ─── Dance (5) ────────────────────────────────────────────
  {
    id: "dance_bhangra",
    name: "Bhangra",
    category: "Dance",
    maxP: 10,
    maxA: 5,
  },
  {
    id: "dance_giddha",
    name: "Giddha",
    category: "Dance",
    maxP: 10,
    maxA: 5,
  },
  {
    id: "dance_classical",
    name: "Classical Dance (Exhibition)",
    category: "Dance",
    maxP: 10,
    maxA: 5,
  },
  {
    id: "dance_folk",
    name: "Indian Folk Dance (Exhibition)",
    category: "Dance",
    maxP: 10,
    maxA: 5,
  },
  {
    id: "dance_international",
    name: "International Group Dance (Exhibition)",
    category: "Dance",
    maxP: 10,
    maxA: 5,
  },

  // ─── Literary (5) ─────────────────────────────────────────
  {
    id: "lit_elocution",
    name: "Elocution",
    category: "Literary",
    maxP: 1,
    maxA: 1,
  },
  {
    id: "lit_debate",
    name: "Debate",
    category: "Literary",
    maxP: 2,
    maxA: 1,
  },
  {
    id: "lit_quiz",
    name: "Quiz",
    category: "Literary",
    maxP: 3,
    maxA: 0,
  },
  {
    id: "lit_poem",
    name: "Poem Recitation",
    category: "Literary",
    maxP: 1,
    maxA: 1,
  },
  {
    id: "lit_creative_writing",
    name: "Creative Writing",
    category: "Literary",
    maxP: 3,
    maxA: 0,
  },

  // ─── Theatre (4) ──────────────────────────────────────────
  {
    id: "theatre_mimicry",
    name: "Mimicry",
    category: "Theatre",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "theatre_skit",
    name: "Skit",
    category: "Theatre",
    maxP: 6,
    maxA: 2,
  },
  {
    id: "theatre_mime",
    name: "Mime",
    category: "Theatre",
    maxP: 6,
    maxA: 2,
  },
  {
    id: "theatre_one_act",
    name: "One Act Play",
    category: "Theatre",
    maxP: 9,
    maxA: 3,
  },

  // ─── Fine Arts (8) ────────────────────────────────────────
  {
    id: "art_painting",
    name: "On the Spot Painting",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_poster",
    name: "Poster Making",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_collage",
    name: "Collage",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_cartoon",
    name: "Cartooning",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_clay",
    name: "Clay Modeling",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_rangoli",
    name: "Rangoli",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_photography",
    name: "On the Spot Photography",
    category: "Fine Arts",
    maxP: 1,
    maxA: 0,
  },
  {
    id: "art_mehndi",
    name: "Mehndi",
    category: "Fine Arts",
    maxP: 1,
    maxA: 1,
  },
];

/** All unique category names in display order */
export const YF_CATEGORIES = [
  ...new Set(YF_EVENTS.map((e) => e.category)),
];

/** Quick lookup: id → event object */
export const YF_EVENTS_BY_ID = Object.fromEntries(
  YF_EVENTS.map((e) => [e.id, e])
);

/** Default accommodation facilities */
export const YF_FACILITIES = [
  "Boys Hostel 1",
  "Boys Hostel 2",
  "Boys Hostel 3",
  "Girls Hostel",
  "Main Guest House",
  "Faculty Guest House",
];
