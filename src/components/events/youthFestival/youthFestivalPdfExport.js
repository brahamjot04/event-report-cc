import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { YF_EVENTS_BY_ID, YF_EVENTS, YF_CATEGORIES } from "../../../constants/youthFestivalEvents";

const HEADER_COLOR = [0, 84, 166]; // PTU blue-ish
const ALT_ROW = [240, 248, 255];

const currentYear = new Date().getFullYear();
const MAIN_TITLE = `I. K. Gujral Punjab Technical University Central Zone Youth Festival ${currentYear}`;

function addHeader(pdf, title, subtitle) {
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...HEADER_COLOR);
  pdf.text(MAIN_TITLE, pdf.internal.pageSize.getWidth() / 2, 14, { align: "center" });
  
  if (title) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(40, 40, 40);
    pdf.text(title, pdf.internal.pageSize.getWidth() / 2, 21, { align: "center" });
  }

  if (subtitle) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    pdf.text(subtitle, pdf.internal.pageSize.getWidth() / 2, 27, { align: "center" });
  }
  pdf.setTextColor(0, 0, 0);
}

// Helper to get participant event names
function getParticipantEventNames(p) {
  const ids = p.eventId ? [p.eventId] : p.eventIds || [];
  return ids.map((id) => YF_EVENTS_BY_ID[id]?.name || id).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Boarding & Lodging Performa (single college or array of colleges)
// ─────────────────────────────────────────────────────────────────────────────
export function exportBoardingPerforma(collegeOrColleges, eventTitle) {
  const collegesList = Array.isArray(collegeOrColleges)
    ? collegeOrColleges
    : [collegeOrColleges];

  if (!collegesList.length) return;

  const pdf = new jsPDF();

  collegesList.forEach((college, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    addHeader(
      pdf,
      "Boarding & Lodging Performa",
      eventTitle || ""
    );

    // College info block
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(`College: ${college.name}`, 14, 34);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const acc = college.accommodation || {};
    const boys = acc.boysCount || 0;
    const girls = acc.girlsCount || 0;
    const total = acc.contingentSize || boys + girls;

    const infoLines = [
      `Arrival Date: ${acc.arrivalDate || "—"}   Time: ${acc.arrivalTime || "—"}`,
      `Departure Date: ${acc.departureDate || "—"}`,
      `Boys: ${boys}   Girls: ${girls}   Total Contingent Size: ${total}`,
    ];
    infoLines.forEach((line, i) => pdf.text(line, 14, 41 + i * 6));

    // Incharges
    if (college.incharges?.length) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Incharges:", 14, 62);
      pdf.setFont("helvetica", "normal");
      college.incharges
        .filter((ic) => ic.name)
        .forEach((ic, i) => {
          pdf.text(
            `${i + 1}. ${ic.name}   Contact: ${ic.contact || "—"}`,
            20,
            68 + i * 6
          );
        });
    }

    // Events table
    const evRows = (college.selectedEvents || []).map((id) => [
      YF_EVENTS_BY_ID[id]?.category || "—",
      YF_EVENTS_BY_ID[id]?.name || id,
    ]);

    autoTable(pdf, {
      startY: 88,
      head: [["Category", "Event"]],
      body: evRows.length ? evRows : [["—", "None selected"]],
      headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
      alternateRowStyles: { fillColor: ALT_ROW },
      styles: { fontSize: 9 },
    });

    // Participants table
    const pRows = (college.participants || []).map((p, i) => [
      i + 1,
      p.name,
      p.role === "P" ? "Participant" : "Alternate",
      getParticipantEventNames(p).join(", ") || "—",
      p.contact || "—",
    ]);

    if (pRows.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 8,
        head: [["#", "Name", "Role", "Event(s)", "Contact"]],
        body: pRows,
        headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
        alternateRowStyles: { fillColor: ALT_ROW },
        styles: { fontSize: 8 },
        columnStyles: { 3: { cellWidth: 60 } },
      });
    }
  });

  const fileName =
    collegesList.length === 1
      ? `Boarding_Performa_${collegesList[0].name.replace(/[^a-z0-9_\-.\s]/gi, "").replace(/\s+/g, "_")}.pdf`
      : `Boarding_Performa_Selected_Colleges.pdf`;

  pdf.save(fileName);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Room Allotment Sheet
// ─────────────────────────────────────────────────────────────────────────────
export function exportRoomAllotmentSheet(allotments, colleges, eventTitle) {
  const pdf = new jsPDF();
  addHeader(
    pdf,
    "Room Allotment Sheet",
    eventTitle || ""
  );

  const collegeMap = Object.fromEntries(
    (colleges || []).map((c) => [c.id, c.name])
  );

  // Group by facility
  const byFacility = {};
  (allotments || []).forEach((a) => {
    if (!byFacility[a.facility]) byFacility[a.facility] = [];
    byFacility[a.facility].push(a);
  });

  let startY = 34;
  Object.entries(byFacility).forEach(([facility, records]) => {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(facility, 14, startY);
    pdf.setFont("helvetica", "normal");

    const rows = records.map((r, i) => [
      i + 1,
      r.room,
      r.personName,
      r.personType === "incharge" ? "Incharge" : "Participant",
      collegeMap[r.collegeId] || r.collegeName || "—",
      r.checkInStatus || "Expected",
      r.checkInTime || "—",
    ]);

    autoTable(pdf, {
      startY: startY + 4,
      head: [["#", "Room", "Name", "Type", "College", "Status", "Check-in Time"]],
      body: rows,
      headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
      alternateRowStyles: { fillColor: ALT_ROW },
      styles: { fontSize: 8 },
      margin: { left: 14 },
    });
    startY = pdf.lastAutoTable.finalY + 10;
  });

  pdf.save(`Room_Allotment_${(eventTitle || "YF").replace(/\s+/g, "_")}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Participation Performa (selected colleges or all colleges)
// ─────────────────────────────────────────────────────────────────────────────
export function exportParticipationPerforma(colleges, eventTitle) {
  const pdf = new jsPDF("landscape");
  addHeader(
    pdf,
    "Participation Performa",
    eventTitle || ""
  );

  const collegesList = Array.isArray(colleges) ? colleges : [colleges];

  // Build rows: one row per event per college
  const rows = [];
  YF_EVENTS.forEach((ev) => {
    collegesList.forEach((c) => {
      if ((c.selectedEvents || []).includes(ev.id)) {
        const pList = (c.participants || []).filter(
          (p) => p.eventId === ev.id || (p.eventIds || []).includes(ev.id)
        );
        const pNames = pList.filter((p) => p.role === "P").map((p) => p.name).join(", ") || "—";
        const aNames = pList.filter((p) => p.role === "A").map((p) => p.name).join(", ") || "—";
        rows.push([
          ev.category,
          ev.name,
          c.name,
          pNames,
          aNames,
        ]);
      }
    });
  });

  autoTable(pdf, {
    startY: 32,
    head: [["Category", "Event", "College", "Participants (P)", "Alternates (A)"]],
    body: rows.length ? rows : [["—", "No entries", "—", "—", "—"]],
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 60 },
      2: { cellWidth: 55 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
    },
    margin: { left: 10 },
  });

  pdf.save(`Participation_Performa_${(eventTitle || "YF").replace(/\s+/g, "_")}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GNDEC Contingent Performa (non-host)
// ─────────────────────────────────────────────────────────────────────────────
export function exportContingentPerforma(roster, eventTitle) {
  const pdf = new jsPDF();
  addHeader(
    pdf,
    "GNDEC — Participation Performa",
    eventTitle || ""
  );

  const rows = [];
  YF_EVENTS.forEach((ev) => {
    const evRoster = roster[ev.id]?.participants || [];
    if (evRoster.length) {
      evRoster.forEach((r) => {
        rows.push([ev.category, ev.name, r.role, r.name, r.contact || "—"]);
      });
    }
  });

  autoTable(pdf, {
    startY: 30,
    head: [["Category", "Event", "Role", "Name", "Contact"]],
    body: rows.length ? rows : [["—", "No entries", "—", "—", "—"]],
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 9 },
  });

  pdf.save(`GNDEC_Contingent_Performa_${(eventTitle || "YF").replace(/\s+/g, "_")}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Official Festival Results & Trophies PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportResultsPdf(results, colleges, eventTitle) {
  const pdf = new jsPDF();
  addHeader(
    pdf,
    "Official Festival Results & Trophies Sheet",
    eventTitle || ""
  );

  const collegeMap = Object.fromEntries(
    (colleges || []).map((c) => [c.id, c.name])
  );

  // 1. Calculate points for colleges
  const collegePoints = (colleges || []).map((col) => {
    let totalPoints = 0;
    const catPoints = {};
    (YF_CATEGORIES || []).forEach((cat) => (catPoints[cat] = 0));

    YF_EVENTS.forEach((ev) => {
      const w = results.winners?.[ev.id];
      if (!w) return;

      let firstPts = 10, secondPts = 6, thirdPts = 2;
      if (
        ev.name.includes("(Exhibition)") ||
        ev.id === "dance_classical" ||
        ev.id === "dance_folk" ||
        ev.id === "dance_international"
      ) {
        firstPts = 0; secondPts = 0; thirdPts = 0;
      } else if (
        ev.id === "dance_bhangra" ||
        ev.id === "dance_giddha" ||
        ev.id === "theatre_one_act"
      ) {
        firstPts = 15; secondPts = 10; thirdPts = 5;
      } else if (ev.maxP === 1) {
        firstPts = 5; secondPts = 3; thirdPts = 1;
      }

      if (w.first === col.id) {
        totalPoints += firstPts;
        catPoints[ev.category] += firstPts;
      }
      if (w.second === col.id) {
        totalPoints += secondPts;
        catPoints[ev.category] += secondPts;
      }
      if (w.third === col.id) {
        totalPoints += thirdPts;
        catPoints[ev.category] += thirdPts;
      }
    });

    const specialAwardsList = [
      "best_dancer_bhangra",
      "best_dancer_giddha",
      "best_actor",
      "best_speaker",
    ];
    specialAwardsList.forEach((awardId) => {
      if (results.specialAwards?.[awardId]?.collegeId === col.id) {
        totalPoints += 5;
      }
    });

    return {
      ...col,
      totalPoints,
      catPoints,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  // 2. Category Champions
  const categoryChampionsRows = (YF_CATEGORIES || []).map((cat) => {
    let maxPoints = 0;
    collegePoints.forEach((col) => {
      const pts = col.catPoints[cat] || 0;
      if (pts > maxPoints) maxPoints = pts;
    });

    if (maxPoints > 0) {
      const topColleges = collegePoints.filter(
        (col) => (col.catPoints[cat] || 0) === maxPoints
      );
      const names = topColleges.map((c) => c.name).join(" / ");
      return [cat, names, `${maxPoints} pts`];
    }
    return [cat, "—", "0 pts"];
  });

  // 3. Overall Standings Rows (only colleges with points > 0)
  const overallRows = collegePoints
    .filter((c) => c.totalPoints > 0)
    .map((col, idx) => [idx + 1, col.name, `${col.totalPoints} pts`]);

  let currentY = 34;

  // Render Overall Championship Standings Table (if points > 0)
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Overall Championship Standings", 14, currentY);

  autoTable(pdf, {
    startY: currentY + 4,
    head: [["Rank", "College Team", "Total Points"]],
    body: overallRows.length
      ? overallRows
      : [["—", "No points recorded yet — Winners not declared", "0 pts"]],
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8.5 },
  });

  currentY = pdf.lastAutoTable.finalY + 10;

  // Render Category Champions Summary Table
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Category Champions Summary", 14, currentY);

  autoTable(pdf, {
    startY: currentY + 4,
    head: [["Category", "Champion College(s)", "Category Points"]],
    body: categoryChampionsRows,
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8.5 },
  });

  currentY = pdf.lastAutoTable.finalY + 10;

  // Event positions table
  const rows = [];
  YF_EVENTS.forEach((ev) => {
    const w = results.winners?.[ev.id] || {};
    if (w.first || w.second || w.third) {
      rows.push([
        ev.category,
        ev.name,
        collegeMap[w.first] || "—",
        collegeMap[w.second] || "—",
        collegeMap[w.third] || "—",
      ]);
    }
  });

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Event-Wise Results (1st, 2nd, 3rd)", 14, currentY);

  autoTable(pdf, {
    startY: currentY + 4,
    head: [["Category", "Event", "1st Place", "2nd Place", "3rd Place"]],
    body: rows.length ? rows : [["—", "No results declared yet", "—", "—", "—"]],
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8 },
  });

  currentY = pdf.lastAutoTable.finalY + 10;

  // Special Awards table
  const specialAwardsList = [
    { id: "best_dancer_bhangra", title: "Best Dancer (Bhangra)" },
    { id: "best_dancer_giddha", title: "Best Dancer (Giddha)" },
    { id: "best_actor", title: "Best Actor (One Act Play)" },
    { id: "best_speaker", title: "Best Speaker (Literary)" },
  ];

  const specialRows = specialAwardsList.map((award) => {
    const entry = results.specialAwards?.[award.id] || {};
    return [
      award.title,
      entry.personName || "—",
      collegeMap[entry.collegeId] || "—",
      "+5 Points",
    ];
  });

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Individual Special Awards", 14, currentY);

  autoTable(pdf, {
    startY: currentY + 4,
    head: [["Award Title", "Student Name", "College Team", "Bonus Points"]],
    body: specialRows,
    headStyles: { fillColor: HEADER_COLOR, fontSize: 9 },
    alternateRowStyles: { fillColor: ALT_ROW },
    styles: { fontSize: 8.5 },
  });

  pdf.save(`Official_Results_${(eventTitle || "YF").replace(/\s+/g, "_")}.pdf`);
}

