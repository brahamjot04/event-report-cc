import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { YF_EVENTS_BY_ID, YF_EVENTS } from "../../../constants/youthFestivalEvents";

const HEADER_COLOR = [0, 84, 166]; // PTU blue-ish
const ALT_ROW = [240, 248, 255];

function addHeader(pdf, title, subtitle) {
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...HEADER_COLOR);
  pdf.text(title, 105, 18, { align: "center" });
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  if (subtitle) pdf.text(subtitle, 105, 25, { align: "center" });
  pdf.setTextColor(0, 0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Boarding & Lodging Performa (per college)
// ─────────────────────────────────────────────────────────────────────────────
export function exportBoardingPerforma(college, eventTitle) {
  const pdf = new jsPDF();
  addHeader(
    pdf,
    "PTU Youth Festival — Boarding & Lodging Performa",
    eventTitle || ""
  );

  // College info block
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(`College: ${college.name}`, 14, 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);

  const acc = college.accommodation || {};
  const infoLines = [
    `Arrival Date: ${acc.arrivalDate || "—"}   Time: ${acc.arrivalTime || "—"}`,
    `Departure Date: ${acc.departureDate || "—"}`,
    `Contingent Size: ${acc.contingentSize || "—"}`,
  ];
  infoLines.forEach((line, i) =>
    pdf.text(line, 14, 41 + i * 6)
  );

  // Incharges
  if (college.incharges?.length) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Incharges:", 14, 62);
    pdf.setFont("helvetica", "normal");
    college.incharges
      .filter((ic) => ic.name)
      .forEach((ic, i) => {
        pdf.text(`${i + 1}. ${ic.name}   Contact: ${ic.contact || "—"}`, 20, 68 + i * 6);
      });
  }

  // Events table
  const evRows = (college.selectedEvents || []).map((id) => [
    YF_EVENTS_BY_ID[id]?.category || "",
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
    (p.eventIds || [])
      .map((id) => YF_EVENTS_BY_ID[id]?.name || id)
      .join(", ") || "—",
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

  const safeName = college.name.replace(/[^a-z0-9_\-.\s]/gi, "").replace(/\s+/g, "_");
  pdf.save(`Boarding_Performa_${safeName}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Room Allotment Sheet
// ─────────────────────────────────────────────────────────────────────────────
export function exportRoomAllotmentSheet(allotments, colleges, eventTitle) {
  const pdf = new jsPDF();
  addHeader(
    pdf,
    "PTU Youth Festival — Room Allotment Sheet",
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
    ]);

    autoTable(pdf, {
      startY: startY + 4,
      head: [["#", "Room", "Name", "Type", "College", "Status"]],
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
// 3. Participation Performa (all colleges combined or per college)
// ─────────────────────────────────────────────────────────────────────────────
export function exportParticipationPerforma(colleges, eventTitle) {
  const pdf = new jsPDF("landscape");
  addHeader(
    pdf,
    "PTU Youth Festival — Participation Performa",
    eventTitle || ""
  );

  // Build rows: one row per event per college
  const rows = [];
  YF_EVENTS.forEach((ev) => {
    colleges.forEach((c) => {
      if ((c.selectedEvents || []).includes(ev.id)) {
        const pList = (c.participants || []).filter((p) =>
          (p.eventIds || []).includes(ev.id)
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
    "GNDEC — Youth Festival Participation Performa",
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
