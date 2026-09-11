import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { loadCollegesWithCache } from "../../../utils/yfDataCache";
import {
  Button,
  Form,
  Badge,
  Spinner,
  Row,
  Col,
  Table,
  Accordion,
} from "react-bootstrap";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { logAction } from "../../../utils/logger";
import {
  YF_EVENTS,
  YF_CATEGORIES,
  YF_EVENTS_BY_ID,
} from "../../../constants/youthFestivalEvents";
import { exportResultsPdf } from "./youthFestivalPdfExport";

const inputStyle = {
  backgroundColor: "var(--bg-card)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};

/**
 * PTU Points Rule Evaluator:
 * - Punjabi Folk Dance (Bhangra / Giddha) & One Act Play: 1st = 15, 2nd = 10, 3rd = 5
 * - Standard Group Events (maxP > 1): 1st = 10, 2nd = 6, 3rd = 2
 * - Solo Events (maxP === 1): 1st = 5, 2nd = 3, 3rd = 1
 */
function getEventPointsRules(ev) {
  if (
    ev.name.includes("(Exhibition)") ||
    ev.id === "dance_classical" ||
    ev.id === "dance_folk" ||
    ev.id === "dance_international"
  ) {
    return {
      first: 0,
      second: 0,
      third: 0,
      type: "Exhibition (Performance Only — No Points)",
      isExhibition: true,
    };
  }
  if (
    ev.id === "dance_bhangra" ||
    ev.id === "dance_giddha" ||
    ev.id === "theatre_one_act"
  ) {
    return { first: 15, second: 10, third: 5, type: "Major Group (Folk/Play)" };
  }
  if (ev.maxP > 1) {
    return { first: 10, second: 6, third: 2, type: "Group Event" };
  }
  return { first: 5, second: 3, third: 1, type: "Solo Event" };
}

const SPECIAL_AWARDS = [
  { id: "best_dancer_bhangra", title: "Best Dancer (Bhangra)", eventId: "dance_bhangra" },
  { id: "best_dancer_giddha", title: "Best Dancer (Giddha)", eventId: "dance_giddha" },
  { id: "best_actor", title: "Best Actor (One Act Play)", eventId: "theatre_one_act" },
  { id: "best_speaker", title: "Best Speaker (Literary)", eventId: "lit_elocution" },
];

export default function YouthFestivalResults({ eventId, goBack }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [colleges, setColleges] = useState([]);
  // results: { winners: { [yfEventId]: { first: collegeId, second: collegeId, third: collegeId } }, specialAwards: { [awardId]: { collegeId, personName } } }
  const [results, setResults] = useState({ winners: {}, specialAwards: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch Colleges & Existing Results ─────────────────────
  const fetchData = useCallback(async () => {
    // 1. Fetch colleges with instant cache support
    loadCollegesWithCache(
      eventId,
      db,
      (colList, isCached) => {
        setColleges(colList);
        if (isCached) setLoading(false);
      },
      () => showError("Failed to load festival results.")
    );

    // 2. Fetch saved results
    try {
      const resDoc = await getDoc(
        doc(db, "events", eventId, "meta", "yf_results")
      );
      if (resDoc.exists()) {
        setResults({
          winners: resDoc.data().winners || {},
          specialAwards: resDoc.data().specialAwards || {},
        });
      }
    } catch (e) {
      console.error(e);
      showError("Failed to load festival results.");
    } finally {
      setLoading(false);
    }
  }, [eventId, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Update Winners ────────────────────────────────────────
  const updateWinner = (yfEvId, position, collegeId) => {
    setResults((prev) => ({
      ...prev,
      winners: {
        ...prev.winners,
        [yfEvId]: {
          ...(prev.winners[yfEvId] || {}),
          [position]: collegeId,
        },
      },
    }));
  };

  // ── Update Special Award ──────────────────────────────────
  const updateSpecialAward = (awardId, field, value) => {
    setResults((prev) => ({
      ...prev,
      specialAwards: {
        ...prev.specialAwards,
        [awardId]: {
          ...(prev.specialAwards[awardId] || {}),
          [field]: value,
        },
      },
    }));
  };

  // ── Save Results to Firestore ─────────────────────────────
  const handleSaveResults = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "events", eventId, "meta", "yf_results"),
        results,
        { merge: true }
      );
      await logAction(
        "SAVE_YF_RESULTS",
        `Updated Youth Festival results & point standings`,
        user
      );
      showSuccess("Results & Points saved successfully!");
    } catch {
      showError("Failed to save results.");
    } finally {
      setSaving(false);
    }
  };

  // ── Calculate Points Leaderboard ──────────────────────────
  const collegePoints = colleges.map((col) => {
    let totalPoints = 0;
    const catPoints = {};
    YF_CATEGORIES.forEach((cat) => (catPoints[cat] = 0));

    // 1. Calculate points from event positions
    YF_EVENTS.forEach((ev) => {
      const w = results.winners[ev.id];
      if (!w) return;
      const rules = getEventPointsRules(ev);

      if (w.first === col.id) {
        totalPoints += rules.first;
        catPoints[ev.category] += rules.first;
      }
      if (w.second === col.id) {
        totalPoints += rules.second;
        catPoints[ev.category] += rules.second;
      }
      if (w.third === col.id) {
        totalPoints += rules.third;
        catPoints[ev.category] += rules.third;
      }
    });

    // 2. Add points from Individual Special Awards (5 points each)
    let specialAwardCount = 0;
    SPECIAL_AWARDS.forEach((award) => {
      const entry = results.specialAwards[award.id];
      if (entry?.collegeId === col.id) {
        totalPoints += 5;
        specialAwardCount += 1;
      }
    });

    return {
      ...col,
      totalPoints,
      catPoints,
      specialAwardCount,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  // Category Champions (handles ties and 0-points suppression)
  const categoryChampions = {};
  YF_CATEGORIES.forEach((cat) => {
    let maxPoints = 0;
    collegePoints.forEach((col) => {
      const pts = col.catPoints[cat] || 0;
      if (pts > maxPoints) maxPoints = pts;
    });

    if (maxPoints > 0) {
      const topColleges = collegePoints.filter(
        (col) => (col.catPoints[cat] || 0) === maxPoints
      );
      categoryChampions[cat] = {
        colleges: topColleges,
        points: maxPoints,
        names: topColleges.map((c) => c.name).join(" / "),
        isTie: topColleges.length > 1,
      };
    } else {
      categoryChampions[cat] = null;
    }
  });

  // Group colleges into point tiers for Overall Champions (suppress if 0 pts, handle ties)
  const distinctPositivePoints = Array.from(
    new Set(
      collegePoints
        .map((c) => c.totalPoints)
        .filter((pts) => pts > 0)
    )
  ).sort((a, b) => b - a);

  const podiumTiers = distinctPositivePoints.slice(0, 3).map((pts, idx) => {
    const tiedColleges = collegePoints.filter((c) => c.totalPoints === pts);
    const titles = ["OVERALL CHAMPION", "RUNNER-UP", "3RD PLACE"];
    const badgeVariants = ["warning", "secondary", "danger"];
    const icons = ["bi-trophy-fill", "bi-award-fill", "bi-medal-fill"];
    return {
      rankIndex: idx,
      title: titles[idx],
      variant: badgeVariants[idx],
      icon: icons[idx],
      points: pts,
      colleges: tiedColleges,
      names: tiedColleges.map((c) => c.name).join(" / "),
      isTie: tiedColleges.length > 1,
    };
  });

  return (
    <>
      {/* Page Header */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <Button
          variant="outline-secondary"
          className="rounded-circle shadow-sm flex-shrink-0"
          onClick={goBack}
          style={{ width: 45, height: 45 }}
        >
          <i className="bi bi-arrow-left" />
        </Button>
        <div className="flex-grow-1">
          <small className="text-muted text-uppercase fw-bold">
            Youth Festival — Prize Distribution
          </small>
          <h4 className="fw-bold mb-0">Results &amp; Overall Trophies</h4>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            className="px-3"
            onClick={() => exportResultsPdf(results, colleges, eventId)}
            disabled={colleges.length === 0}
          >
            <i className="bi bi-file-earmark-pdf me-2" />
            Export Results PDF
          </Button>
          <Button
            variant="primary"
            className="px-4"
            onClick={handleSaveResults}
            disabled={saving}
          >
            <i className="bi bi-save me-2" />
            {saving ? "Saving…" : "Save Results"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : colleges.length === 0 ? (
        <div
          className="text-center py-5 rounded"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <i className="bi bi-trophy fs-1 text-muted" />
          <p className="text-muted mt-2">
            No participating colleges registered yet. Register colleges in the Colleges module first.
          </p>
        </div>
      ) : (
        <>
          {/* ── OVERALL TROPHIES & LEADERBOARD ───────────────────── */}
          <div
            className="p-4 rounded mb-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-trophy-fill text-warning me-2" />
                OVERALL CHAMPIONSHIP LEADERBOARD
              </h5>
              <Badge bg="secondary">
                {colleges.length} College Teams
              </Badge>
            </div>

            {/* Top 3 Championship Cards (Suppressed if 0 pts) */}
            {podiumTiers.length === 0 ? (
              <div
                className="p-3 mb-4 rounded text-center text-muted"
                style={{
                  background: "var(--bg-main)",
                  border: "1px dashed var(--border-color)",
                }}
              >
                <i className="bi bi-trophy text-muted fs-3 d-block mb-1" />
                <span className="fw-bold">No points recorded yet</span>
                <div className="small text-muted mt-1">
                  Assign 1st, 2nd, and 3rd place winners to individual events below to determine the Overall Champion &amp; Category Winners.
                </div>
              </div>
            ) : (
              <Row className="g-3 mb-4">
                {podiumTiers.map((tier) => (
                  <Col key={tier.title} xs={12} md={4}>
                    <div
                      className="p-3 rounded text-center h-100"
                      style={{
                        background: "var(--bg-main)",
                        border: `2px solid var(--bs-${tier.variant})`,
                      }}
                    >
                      <i className={`bi ${tier.icon} text-${tier.variant} fs-1 d-block mb-1`} />
                      <small className={`fw-bold text-uppercase text-${tier.variant}`}>
                        {tier.title} {tier.isTie ? "(JOINT TIE)" : ""}
                      </small>
                      <h5 className="fw-bold mt-1 mb-1">{tier.names}</h5>
                      <span className="fs-4 fw-extrabold text-primary">
                        {tier.points} <small className="fs-6 text-muted">pts</small>
                      </span>
                    </div>
                  </Col>
                ))}
              </Row>
            )}

            {/* Category Champions */}
            <p className="text-muted small fw-bold mb-2">CATEGORY CHAMPION TROPHIES</p>
            <Row className="g-2 mb-4">
              {YF_CATEGORIES.map((cat) => {
                const champ = categoryChampions[cat];
                return (
                  <Col key={cat} xs={12} sm={6} md={2.4}>
                    <div
                      className="p-3 rounded text-center h-100 d-flex flex-column justify-content-between"
                      style={{
                        background: "var(--bg-main)",
                        border: champ ? "1px solid var(--border-color)" : "1px dashed var(--border-color)",
                      }}
                    >
                      <div>
                        <small className="text-muted d-block text-uppercase fw-bold">
                          {cat}
                        </small>
                        <span className="fw-bold small d-block mt-1">
                          {champ ? champ.names : "— No Winner Yet —"}
                        </span>
                      </div>
                      <div className="mt-2">
                        {champ ? (
                          <Badge bg="primary" className="fw-semibold">
                            {champ.points} pts {champ.isTie ? "(Joint)" : ""}
                          </Badge>
                        ) : (
                          <small className="text-muted">0 pts</small>
                        )}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>

            {/* Detailed Leaderboard Table */}
            <div className="table-responsive">
              <Table bordered hover size="sm" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                <thead>
                  <tr className="bg-body-tertiary">
                    <th style={{ width: 50 }}>Rank</th>
                    <th>College Name</th>
                    {YF_CATEGORIES.map((cat) => (
                      <th key={cat} className="text-center">{cat}</th>
                    ))}
                    <th className="text-center">Spl. Awards (+5)</th>
                    <th className="text-center text-primary">Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {collegePoints.map((col, rank) => (
                    <tr key={col.id}>
                      <td className="fw-bold text-center">{rank + 1}</td>
                      <td className="fw-medium">{col.name}</td>
                      {YF_CATEGORIES.map((cat) => (
                        <td key={cat} className="text-center">
                          {col.catPoints[cat] > 0 ? (
                            <span className="fw-bold">{col.catPoints[cat]}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center">
                        {col.specialAwardCount > 0 ? (
                          <Badge bg="success">+{col.specialAwardCount * 5} pts</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-center fw-extrabold text-primary fs-6">
                        {col.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>

          {/* ── INDIVIDUAL SPECIAL AWARDS (+5 PTS EACH) ────────── */}
          <div
            className="p-4 rounded mb-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h5 className="fw-bold mb-1">
              <i className="bi bi-star-fill text-warning me-2" />
              INDIVIDUAL SPECIAL AWARDS (+5 PTS EACH TO COLLEGE SCORE)
            </h5>
            <p className="text-muted small mb-3">
              Special individual awards can be declared for students from <strong>any participating team</strong>.
            </p>

            <Row className="g-3">
              {SPECIAL_AWARDS.map((award) => {
                const entry = results.specialAwards[award.id] || {};
                
                // Filter colleges registered for this award's event
                const registeredColleges = colleges.filter(
                  (c) => Array.isArray(c.selectedEvents) && c.selectedEvents.includes(award.eventId)
                );
                const eligibleColleges = registeredColleges.length > 0 ? registeredColleges : colleges;

                // Collect students from eligible colleges
                const registeredStudents = eligibleColleges.flatMap((c) =>
                  (c.participants || [])
                    .filter((p) => !p.eventId || p.eventId === award.eventId)
                    .map((p) => ({
                      id: p.id,
                      name: p.name,
                      collegeId: c.id,
                      collegeName: c.name,
                    }))
                );

                const currentCollegeParticipants = entry.collegeId
                  ? registeredStudents.filter((s) => s.collegeId === entry.collegeId)
                  : registeredStudents;

                return (
                  <Col key={award.id} xs={12} md={6}>
                    <div
                      className="p-3 rounded"
                      style={{
                        background: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-bold text-primary">{award.title}</span>
                        <Badge bg="warning" text="dark">+5 Points</Badge>
                      </div>

                      <Row className="g-2">
                        {/* College Select */}
                        <Col md={6}>
                          <Form.Label className="text-muted small fw-bold mb-1">
                            Winning College
                          </Form.Label>
                          <Form.Select
                            size="sm"
                            value={entry.collegeId || ""}
                            onChange={(e) => {
                              const newColId = e.target.value;
                              updateSpecialAward(award.id, "collegeId", newColId);
                            }}
                            style={inputStyle}
                          >
                            <option value="">— Select College —</option>
                            {eligibleColleges.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>

                        {/* Student Select & Custom Type Input */}
                        <Col md={6}>
                          <Form.Label className="text-muted small fw-bold mb-1">
                            Student Winner Name
                          </Form.Label>
                          <Form.Select
                            size="sm"
                            className="mb-1"
                            value={
                              currentCollegeParticipants.find(
                                (s) => s.name === entry.personName && s.collegeId === entry.collegeId
                              )?.name || ""
                            }
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              if (selectedName) {
                                const match = currentCollegeParticipants.find((s) => s.name === selectedName);
                                if (match) {
                                  setResults((prev) => ({
                                    ...prev,
                                    specialAwards: {
                                      ...prev.specialAwards,
                                      [award.id]: {
                                        collegeId: match.collegeId,
                                        personName: match.name,
                                      },
                                    },
                                  }));
                                }
                              }
                            }}
                            style={inputStyle}
                          >
                            <option value="">— Select from Participants —</option>
                            {currentCollegeParticipants.map((s) => (
                              <option key={s.id || s.name} value={s.name}>
                                {s.name} ({s.collegeName})
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Control
                            size="sm"
                            placeholder="Or type student name..."
                            value={entry.personName || ""}
                            onChange={(e) =>
                              updateSpecialAward(award.id, "personName", e.target.value)
                            }
                            style={inputStyle}
                          />
                        </Col>
                      </Row>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* ── EVENT POSITIONS DECLARATION (32 EVENTS) ──────── */}
          <div
            className="p-4 rounded mb-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h5 className="fw-bold mb-1">
              <i className="bi bi-award me-2 text-primary" />
              EVENT POSITIONS ENTRY (32 PTU EVENTS)
            </h5>
            <p className="text-muted small mb-3">
              Assign 1st, 2nd, and 3rd positions. Dropdowns automatically list only colleges registered for each event.
            </p>

            <Accordion flush>
              {YF_CATEGORIES.map((cat) => {
                const catEvents = YF_EVENTS.filter((e) => e.category === cat);
                return (
                  <Accordion.Item
                    key={cat}
                    eventKey={cat}
                    style={{
                      background: "var(--bg-card)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <Accordion.Header>
                      <span className="fw-bold">{cat}</span>
                      <Badge bg="secondary" className="ms-2">
                        {catEvents.filter((e) => results.winners[e.id]?.first).length} / {catEvents.length} decided
                      </Badge>
                    </Accordion.Header>
                    <Accordion.Body className="pt-2">
                      <div className="d-grid gap-3">
                        {catEvents.map((ev) => {
                          const w = results.winners[ev.id] || {};
                          const rules = getEventPointsRules(ev);

                          // Filter colleges registered for this event
                          const registeredColleges = colleges.filter(
                            (c) => Array.isArray(c.selectedEvents) && c.selectedEvents.includes(ev.id)
                          );
                          const displayColleges = registeredColleges.length > 0 ? registeredColleges : colleges;
                          const isFallback = registeredColleges.length === 0 && colleges.length > 0;

                          return (
                            <div
                              key={ev.id}
                              className="p-3 rounded"
                              style={{
                                background: "var(--bg-main)",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                                <div>
                                  <span className="fw-bold">{ev.name}</span>
                                  {isFallback && (
                                    <Badge bg="outline-warning" text="dark" className="ms-2 small" style={{ border: "1px solid var(--border-color)" }}>
                                      Showing all colleges (none registered specifically)
                                    </Badge>
                                  )}
                                </div>
                                <Badge bg="outline-secondary" text="dark" style={{ border: "1px solid var(--border-color)" }}>
                                  {rules.type} (1st: {rules.first}p • 2nd: {rules.second}p • 3rd: {rules.third}p)
                                </Badge>
                              </div>

                              <Row className="g-2">
                                {/* 1st Place */}
                                <Col md={4}>
                                  <Form.Label className="text-muted small fw-bold mb-1">
                                    🥇 1ST PLACE ({rules.first} PTS)
                                  </Form.Label>
                                  <Form.Select
                                    size="sm"
                                    value={w.first || ""}
                                    onChange={(e) => updateWinner(ev.id, "first", e.target.value)}
                                    style={inputStyle}
                                  >
                                    <option value="">— Select 1st College —</option>
                                    {displayColleges.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Col>

                                {/* 2nd Place */}
                                <Col md={4}>
                                  <Form.Label className="text-muted small fw-bold mb-1">
                                    🥈 2ND PLACE ({rules.second} PTS)
                                  </Form.Label>
                                  <Form.Select
                                    size="sm"
                                    value={w.second || ""}
                                    onChange={(e) => updateWinner(ev.id, "second", e.target.value)}
                                    style={inputStyle}
                                  >
                                    <option value="">— Select 2nd College —</option>
                                    {displayColleges.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Col>

                                {/* 3rd Place */}
                                <Col md={4}>
                                  <Form.Label className="text-muted small fw-bold mb-1">
                                    🥉 3RD PLACE ({rules.third} PTS)
                                  </Form.Label>
                                  <Form.Select
                                    size="sm"
                                    value={w.third || ""}
                                    onChange={(e) => updateWinner(ev.id, "third", e.target.value)}
                                    style={inputStyle}
                                  >
                                    <option value="">— Select 3rd College —</option>
                                    {displayColleges.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Col>
                              </Row>
                            </div>
                          );
                        })}
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          </div>
        </>
      )}
    </>
  );
}
