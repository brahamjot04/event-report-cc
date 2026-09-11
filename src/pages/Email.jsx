import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Form,
  Button,
  Spinner,
  Container,
  Card,
  Badge,
  Row,
  Col,
  Tabs,
  Tab,
  Table,
  Modal,
  InputGroup,
} from "react-bootstrap";
import Layout from "../components/Layout";
import emailjs from "@emailjs/browser";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { db } from "../firebase";
import { loadWithCache, invalidateCache } from "../utils/dataCache";
import { logAction } from "../utils/logger";
import { logSentEmail } from "../utils/emailLogger";

const EMAIL_TEMPLATES = [
  {
    id: "meeting",
    title: "Urgent Core Team Meeting Notice",
    subject: "Urgent: Core Team Meeting Notice - Cultural Committee GNDEC",
    message: `Dear Core Team Members,\n\nA mandatory meeting has been scheduled as per details below:\n\n📅 Date: [Insert Date]\n⏰ Time: [Insert Time]\n📍 Venue: Cultural Committee Room / Auditorium\n\nAgenda:\n1. Event Planning & Logistics Review\n2. Duties & Stage Responsibilities Allocation\n3. Progress Updates & Q&A\n\nAttendance is compulsory for all members. Please report 10 minutes prior.\n\nWarm regards,\nCultural Committee\nGuru Nanak Dev Engineering College, Ludhiana`,
  },
  {
    id: "yf_guidelines",
    title: "Youth Festival Contingent Guidelines & Reporting",
    subject: "PTU Inter-College Youth Festival - Contingent Guidelines & Reporting Schedule",
    message: `Dear College Contingent In-charge & Participants,\n\nGreetings from Guru Nanak Dev Engineering College, Ludhiana!\n\nWe warmly welcome your institution to the upcoming PTU Inter-College Youth Festival. Please review the following crucial instructions:\n\n1. Desk Registration: All contingents must report at the Central Registration Desk upon arrival to submit authorized dossiers.\n2. Verification: Participant ID cards and principal-attested authorization letters must be produced during registration.\n3. Accommodation: Hostel rooms have been allocated. Please contact the Accommodation Helpdesk upon check-in.\n4. Event Schedule: Stage timing and venue allocations are posted on the notice board and portal.\n\nFor any immediate assistance on festival days, please contact the Cultural Committee Control Desk.\n\nWarm regards,\nHost Cultural Committee\nGNDEC Ludhiana`,
  },
  {
    id: "results",
    title: "Official Results Declaration",
    subject: "Official Results Declaration - Cultural Committee GNDEC",
    message: `Dear Participants and Faculty Coordinators,\n\nThe jury has finalized and verified the official results for the recent events:\n\n🏆 Event: [Insert Event Name]\n🥇 1st Position: [College/Participant Name]\n🥈 2nd Position: [College/Participant Name]\n🥉 3rd Position: [College/Participant Name]\n\nHeartiest congratulations to all the winners! Merit certificates and trophies will be presented during the valedictory ceremony.\n\nWarm regards,\nCultural Committee\nGNDEC Ludhiana`,
  },
  {
    id: "auditions",
    title: "Auditions & Practice Schedule Call",
    subject: "Call for Auditions & Practice Sessions - Cultural Committee",
    message: `Dear Students,\n\nThe Cultural Committee invites enthusiastic participants for the upcoming cultural events:\n\n🎭 Category / Items: Music, Dance, Literary, Theatre, Fine Arts\n📅 Audition Date: [Insert Date]\n⏰ Time: [Insert Time]\n📍 Venue: [Auditorium / Open Air Theatre]\n\nAll interested students are requested to report with your necessary instruments or props.\n\nBest of luck!\nCultural Committee, GNDEC`,
  },
];

export default function Email() {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [activeTab, setActiveTab] = useState("compose"); // 'compose' | 'history'

  // Compose State
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetGroup, setTargetGroup] = useState("self"); // 'self' | 'core_team' | 'approved_users' | 'custom'
  const [customEmailsInput, setCustomEmailsInput] = useState("");
  const [customEmailsValidation, setCustomEmailsValidation] = useState({
    valid: [],
    invalid: [],
  });
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  // History State
  const [sentEmails, setSentEmails] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");

  // EmailJS Config from environment variables
  const SERVICE_ID =
    import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_og3ze6m";
  const TEMPLATE_ID =
    import.meta.env.VITE_EMAILJS_TEMPLATE_BROADCAST || "template_mr9nv9c";
  const PUBLIC_KEY =
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "PzNJuoItwBZtKTwOG";

  const parseCustomEmails = (input) => {
    if (!input || !input.trim()) return { valid: [], invalid: [] };
    const tokens = input
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = [];
    const invalid = [];
    tokens.forEach((t) => {
      if (emailRegex.test(t)) {
        if (!valid.includes(t)) valid.push(t);
      } else {
        if (!invalid.includes(t)) invalid.push(t);
      }
    });
    return { valid, invalid };
  };

  // Synchronize custom emails whenever input changes
  useEffect(() => {
    if (targetGroup === "custom") {
      const { valid, invalid } = parseCustomEmails(customEmailsInput);
      setCustomEmailsValidation({ valid, invalid });
      setRecipients(valid.map((em) => ({ name: em.split("@")[0], email: em })));
    }
  }, [targetGroup, customEmailsInput]);

  // Fetch recipients whenever targetGroup changes
  const loadRecipients = useCallback(async () => {
    if (targetGroup === "custom") {
      const { valid, invalid } = parseCustomEmails(customEmailsInput);
      setCustomEmailsValidation({ valid, invalid });
      setRecipients(valid.map((em) => ({ name: em.split("@")[0], email: em })));
      return;
    }

    if (targetGroup === "self") {
      setRecipients([
        {
          name: user?.displayName || "Admin",
          email: user?.email || "",
        },
      ]);
      return;
    }

    setLoadingRecipients(true);
    try {
      if (targetGroup === "core_team") {
        await loadWithCache(
          "email_recipients_core_team",
          async () => {
            const snap = await getDocs(collection(db, "global_core_team"));
            return snap.docs
              .map((d) => ({
                name: d.data().name || "Core Team Member",
                email: d.data().email || d.data().phone || "",
              }))
              .filter((m) => m.email && m.email.includes("@"));
          },
          (list, isCached) => {
            setRecipients(list);
            if (isCached) setLoadingRecipients(false);
          },
          (error) => {
            console.error("Error loading recipients:", error);
            showError("Could not load recipients: " + error.message);
          }
        );
      } else if (targetGroup === "approved_users") {
        await loadWithCache(
          "email_recipients_approved_users",
          async () => {
            const q = query(
              collection(db, "users"),
              where("status", "==", "approved"),
            );
            const snap = await getDocs(q);
            return snap.docs
              .map((d) => ({
                name: d.data().name || "Member",
                email: d.data().email || "",
              }))
              .filter((u) => u.email && u.email.includes("@"));
          },
          (list, isCached) => {
            setRecipients(list);
            if (isCached) setLoadingRecipients(false);
          },
          (error) => {
            console.error("Error loading recipients:", error);
            showError("Could not load recipients: " + error.message);
          }
        );
      }
    } catch (error) {
      console.error("Error loading recipients:", error);
      showError("Could not load recipients: " + error.message);
    } finally {
      setLoadingRecipients(false);
    }
  }, [targetGroup, user, customEmailsInput, showError]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  // Fetch Sent Emails History
  const fetchSentEmails = useCallback(async (forceFresh = false) => {
    if (forceFresh) {
      invalidateCache("sent_emails_list");
    }
    setLoadingHistory(true);
    try {
      await loadWithCache(
        "sent_emails_list",
        async () => {
          const snap = await getDocs(collection(db, "sent_emails"));
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          list.sort((a, b) => {
            const dateA = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : new Date(a.sentDate || 0).getTime();
            const dateB = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : new Date(b.sentDate || 0).getTime();
            return dateB - dateA;
          });
          return list;
        },
        (list, isCached) => {
          setSentEmails(list);
          if (isCached) setLoadingHistory(false);
        },
        (error) => {
          console.error("Error loading sent emails:", error);
        }
      );
    } catch (err) {
      console.error("Failed to load sent emails:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchSentEmails();
    }
  }, [activeTab, fetchSentEmails]);

  const handleApplyTemplate = (templateId) => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setSubject(tpl.subject);
      setMessage(tpl.message);
      showSuccess(`Loaded template: "${tpl.title}"`);
    }
  };

  const handleCopyWhatsApp = () => {
    if (!subject.trim() && !message.trim()) {
      showError("Please enter a subject or message to copy.");
      return;
    }

    const waText = [
      `📢 *${subject.trim() || "ANNOUNCEMENT"}*`,
      ``,
      message.trim(),
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Cultural Committee_`,
      `*Guru Nanak Dev Engineering College, Ludhiana*`,
      `🔗 ${window.location.origin}`,
    ].join("\n");

    navigator.clipboard.writeText(waText).then(
      () => {
        showSuccess("✓ Formatted announcement copied for WhatsApp!");
      },
      () => {
        showError("Could not copy to clipboard.");
      }
    );
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!user || !user.email) {
      showError("You must be logged in to send emails.");
      return;
    }

    if (targetGroup === "custom" && customEmailsValidation.invalid.length > 0) {
      showError(
        `Please fix or remove invalid email addresses: ${customEmailsValidation.invalid.join(", ")}`
      );
      return;
    }

    if (recipients.length === 0) {
      showError("No valid recipients found for the selected audience.");
      return;
    }

    // Confirmation if sending to multiple recipients
    if (recipients.length > 1) {
      const ok = await confirm({
        title: "Confirm Email Broadcast",
        message: `You are about to send this announcement to ${recipients.length} recipients. Do you wish to proceed?`,
        confirmText: `Send to ${recipients.length} Recipients`,
        variant: "primary",
      });
      if (!ok) return;
    }

    setSending(true);

    try {
      let sentCount = 0;
      let failedCount = 0;
      const recipientResults = [];

      for (const recipient of recipients) {
        const templateParams = {
          name: recipient.name || "Member",
          email: recipient.email,
          title: subject,
          message: message,
          url: window.location.origin,
        };

        try {
          await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
          sentCount += 1;
          recipientResults.push({
            name: recipient.name || "Member",
            email: recipient.email,
            status: "sent",
            sentAt: new Date().toISOString(),
          });
        } catch (itemError) {
          failedCount += 1;
          recipientResults.push({
            name: recipient.name || "Member",
            email: recipient.email,
            status: "failed",
            error: itemError?.text || itemError?.message || "Delivery failed",
            sentAt: new Date().toISOString(),
          });
        }
      }

      const overallStatus =
        failedCount === 0
          ? "sent"
          : sentCount > 0
          ? "partially_failed"
          : "failed";

      // Log sent email to dedicated sent_emails collection
      await logSentEmail({
        type: "broadcast",
        subject,
        message,
        audience: targetGroup,
        recipients: recipientResults,
        successfulCount: sentCount,
        failedCount: failedCount,
        status: overallStatus,
        sender: user,
      });

      // Also log general activity
      await logAction(
        "SEND_EMAIL",
        `Sent broadcast announcement "${subject}" to ${sentCount}/${recipients.length} recipient(s) [Audience: ${targetGroup}, Status: ${overallStatus}]`,
        user
      );

      if (sentCount > 0) {
        showSuccess(
          `Announcement successfully sent to ${sentCount} recipient${sentCount > 1 ? "s" : ""}${failedCount > 0 ? ` (${failedCount} failed)` : ""}!`,
        );
        setSubject("");
        setMessage("");
        if (targetGroup === "custom") {
          setCustomEmailsInput("");
        }
      } else {
        showError("Failed to deliver broadcast to any recipients.");
      }

      // Refresh sent history
      fetchSentEmails(true);
    } catch (error) {
      console.error(error);
      showError("Failed to send: " + (error.text || error.message));
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    backgroundColor: "var(--bg-main)",
    color: "var(--text-primary)",
    borderColor: "var(--border-color)",
  };

  const formatEmailDate = (record) => {
    if (record.createdAt?.toDate) {
      return record.createdAt.toDate().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
    if (record.sentDate) {
      const d = new Date(record.sentDate);
      return !isNaN(d.getTime())
        ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : record.sentDate;
    }
    return "Recent";
  };

  const renderAudienceBadge = (audience) => {
    switch (audience) {
      case "self":
        return <Badge bg="secondary">Test (Self)</Badge>;
      case "core_team":
        return <Badge bg="primary">Core Team</Badge>;
      case "approved_users":
        return (
          <Badge bg="info" className="text-dark">
            Approved Users
          </Badge>
        );
      case "custom":
        return <Badge bg="dark">Custom Email</Badge>;
      case "new_user":
        return <Badge bg="success">New User</Badge>;
      default:
        return <Badge bg="secondary">{audience || "Audience"}</Badge>;
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "sent":
        return (
          <Badge
            bg="success"
            className="bg-opacity-10 text-success rounded-pill px-3"
          >
            Delivered
          </Badge>
        );
      case "partially_failed":
        return (
          <Badge
            bg="warning"
            className="bg-opacity-10 text-warning rounded-pill px-3"
          >
            Partial
          </Badge>
        );
      case "failed":
        return (
          <Badge
            bg="danger"
            className="bg-opacity-10 text-danger rounded-pill px-3"
          >
            Failed
          </Badge>
        );
      default:
        return (
          <Badge bg="secondary" className="rounded-pill px-3">
            {status || "Unknown"}
          </Badge>
        );
    }
  };

  // Filter sent emails
  const filteredHistory = sentEmails.filter((record) => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return true;
    const matchSubject = (record.subject || "").toLowerCase().includes(q);
    const matchMessage = (record.message || "").toLowerCase().includes(q);
    const matchSender =
      (record.sender?.name || "").toLowerCase().includes(q) ||
      (record.sender?.email || "").toLowerCase().includes(q);
    const matchAudience = (record.audience || "").toLowerCase().includes(q);
    const matchRecipient = (record.recipients || []).some((r) =>
      (r.email || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q)
    );
    return matchSubject || matchMessage || matchSender || matchAudience || matchRecipient;
  });

  return (
    <Layout>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-0">Broadcast Email</h2>
          <p className="text-muted small">
            Send announcements and track delivery history to committee members
          </p>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4 custom-tabs border-0"
      >
        {/* TAB 1: COMPOSE */}
        <Tab eventKey="compose" title="Compose Announcement">
          <Container style={{ maxWidth: "800px" }} className="px-0">
            <Row className="g-4">
              <Col md={12}>
                <div className="soft-card text-start p-4">
                  <Form onSubmit={handleSendBroadcast}>
                    {/* Target Audience Selector */}
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Recipient Audience</Form.Label>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <Button
                          size="sm"
                          variant={
                            targetGroup === "self" ? "primary" : "outline-secondary"
                          }
                          className="rounded-pill"
                          onClick={() => setTargetGroup("self")}
                        >
                          <i className="bi bi-person me-1"></i> Send Test to Myself
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            targetGroup === "core_team"
                              ? "primary"
                              : "outline-secondary"
                          }
                          className="rounded-pill"
                          onClick={() => setTargetGroup("core_team")}
                        >
                          <i className="bi bi-people me-1"></i> Core Team
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            targetGroup === "approved_users"
                              ? "primary"
                              : "outline-secondary"
                          }
                          className="rounded-pill"
                          onClick={() => setTargetGroup("approved_users")}
                        >
                          <i className="bi bi-shield-check me-1"></i> All Approved Users
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            targetGroup === "custom"
                              ? "primary"
                              : "outline-secondary"
                          }
                          className="rounded-pill"
                          onClick={() => setTargetGroup("custom")}
                        >
                          <i className="bi bi-envelope-at me-1"></i> Custom Email(s)
                        </Button>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <small className="text-muted">
                          Target count:{" "}
                          {loadingRecipients ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <Badge bg="info" className="text-dark">
                              {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </small>
                        {targetGroup === "self" && (
                          <small className="text-muted">({user?.email})</small>
                        )}
                      </div>
                    </Form.Group>

                    {/* Custom Email Address Input */}
                    {targetGroup === "custom" && (
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">
                          Recipient Email Address(es)
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder="e.g. principal@college.edu, faculty@gndec.ac.in"
                          value={customEmailsInput}
                          onChange={(e) => setCustomEmailsInput(e.target.value)}
                          style={inputStyle}
                          required
                        />
                        <Form.Text className="text-muted d-block mt-1">
                          Enter single or multiple email addresses separated by commas, semicolons, or newlines.
                        </Form.Text>
                        {customEmailsValidation.invalid.length > 0 && (
                          <div className="mt-2 text-danger small">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            Invalid email format:{" "}
                            <strong>{customEmailsValidation.invalid.join(", ")}</strong>
                          </div>
                        )}
                        {customEmailsValidation.valid.length > 0 && (
                          <div className="mt-2 text-success small">
                            <i className="bi bi-check-circle-fill me-1"></i>
                            {customEmailsValidation.valid.length} valid recipient(s) ready.
                          </div>
                        )}
                      </Form.Group>
                    )}

                    {/* Announcement Template Presets */}
                    <Form.Group className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <Form.Label className="fw-bold mb-0">
                          <i className="bi bi-file-earmark-text text-primary me-1"></i>
                          Template Presets
                        </Form.Label>
                        {(subject || message) && (
                          <Button
                            type="button"
                            variant="outline-success"
                            size="sm"
                            className="rounded-pill py-0 px-2 small"
                            style={{ fontSize: "12px" }}
                            onClick={handleCopyWhatsApp}
                          >
                            <i className="bi bi-whatsapp me-1"></i> Copy for WhatsApp
                          </Button>
                        )}
                      </div>
                      <Form.Select
                        size="sm"
                        style={inputStyle}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleApplyTemplate(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">Load a pre-written template...</option>
                        {EMAIL_TEMPLATES.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.title}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted small">
                        Choose a pre-formatted template to automatically populate the announcement fields.
                      </Form.Text>
                    </Form.Group>

                    {/* Subject Field */}
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold">Subject</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g. Cultural Fest 2026 - Meeting Schedule"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        style={inputStyle}
                      />
                    </Form.Group>

                    {/* Message Field */}
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Message Content</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={6}
                        placeholder="Type your announcement here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        style={inputStyle}
                      />
                    </Form.Group>

                    {/* Live Preview Box */}
                    {(subject || message) && (
                      <Card
                        className="mb-4 shadow-sm"
                        style={{
                          backgroundColor: "var(--soft-hover)",
                          borderColor: "var(--border-color)",
                        }}
                      >
                        <Card.Header className="bg-transparent border-0 pb-0 small text-muted text-uppercase fw-bold">
                          <i className="bi bi-eye me-1"></i> Live Email Preview
                        </Card.Header>
                        <Card.Body>
                          <h6 className="fw-bold text-primary mb-2">
                            {subject || "(No Subject)"}
                          </h6>
                          <p
                            className="mb-0 text-body small"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {message || "(No message body)"}
                          </p>
                        </Card.Body>
                      </Card>
                    )}

                    <div className="d-grid">
                      <Button
                        variant="primary"
                        size="lg"
                        type="submit"
                        disabled={
                          sending ||
                          loadingRecipients ||
                          recipients.length === 0 ||
                          (targetGroup === "custom" &&
                            customEmailsValidation.invalid.length > 0)
                        }
                      >
                        {sending ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Sending Announcement...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill me-2"></i>
                            {targetGroup === "self"
                              ? "Send Test Announcement"
                              : `Broadcast to ${recipients.length} Recipient${recipients.length !== 1 ? "s" : ""}`}
                          </>
                        )}
                      </Button>
                    </div>
                  </Form>
                </div>
              </Col>
            </Row>
          </Container>
        </Tab>

        {/* TAB 2: SENT HISTORY */}
        <Tab
          eventKey="history"
          title={`Sent History (${sentEmails.length})`}
        >
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <InputGroup style={{ maxWidth: "360px" }}>
              <InputGroup.Text style={inputStyle}>
                <i className="bi bi-search text-muted"></i>
              </InputGroup.Text>
              <Form.Control
                placeholder="Search subject, sender, or email..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={inputStyle}
              />
            </InputGroup>

            <Button
              variant="outline-secondary"
              size="sm"
              className="rounded-pill px-3"
              onClick={() => fetchSentEmails(true)}
              disabled={loadingHistory}
            >
              <i
                className={`bi bi-arrow-clockwise me-1 ${loadingHistory ? "spinner-border spinner-border-sm" : ""}`}
              ></i>
              Refresh History
            </Button>
          </div>

          <div
            className="soft-card p-0 overflow-hidden"
            style={{ height: "fit-content" }}
          >
            <Table hover responsive className="mb-0 align-middle">
              <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                <tr className="small text-uppercase text-muted">
                  <th className="ps-4 py-3 text-start">Date & Time</th>
                  <th className="text-start">Subject</th>
                  <th className="text-start">Audience</th>
                  <th className="text-center">Recipients</th>
                  <th className="text-center">Status</th>
                  <th className="text-start">Sent By</th>
                  <th className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted border-0">
                      {loadingHistory ? (
                        <Spinner animation="border" size="sm" variant="primary" />
                      ) : (
                        <>
                          <i className="bi bi-inbox display-4 opacity-25 d-block mb-3"></i>
                          {historySearch
                            ? "No sent emails match your search."
                            : "No broadcast emails sent yet."}
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td className="ps-4 py-3 text-start small text-muted">
                        {formatEmailDate(item)}
                      </td>
                      <td className="text-start">
                        <div className="fw-bold text-body">{item.subject}</div>
                        {item.type === "user_credentials" && (
                          <Badge bg="secondary" className="small me-1">
                            Credentials
                          </Badge>
                        )}
                      </td>
                      <td className="text-start">
                        {renderAudienceBadge(item.audience)}
                      </td>
                      <td className="text-center">
                        <Badge bg="info" className="text-dark">
                          {item.recipientCount || (item.recipients || []).length} Recipient
                          {(item.recipientCount || (item.recipients || []).length) !== 1
                            ? "s"
                            : ""}
                        </Badge>
                        {item.status === "partially_failed" && (
                          <div className="small text-warning mt-1">
                            {item.successfulCount || 0} sent, {item.failedCount || 0} failed
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        {renderStatusBadge(item.status)}
                      </td>
                      <td className="text-start small text-muted">
                        <div className="text-body fw-semibold">
                          {item.sender?.name || "System"}
                        </div>
                        <div className="text-muted small">{item.sender?.email}</div>
                      </td>
                      <td className="text-end pe-4">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="rounded-pill px-3"
                          onClick={() => {
                            setSelectedEmail(item);
                            setRecipientSearch("");
                            setShowDetailsModal(true);
                          }}
                        >
                          <i className="bi bi-eye me-1"></i> Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Tab>
      </Tabs>

      {/* DETAILS MODAL */}
      <Modal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        size="lg"
        centered
      >
        <div
          className="soft-card border-0"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold">
              <i className="bi bi-envelope-paper me-2 text-primary"></i>
              Email Dispatch Details
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-start pt-3">
            {selectedEmail && (
              <div>
                {/* Header Information Strip */}
                <div
                  className="p-3 rounded mb-3"
                  style={{
                    backgroundColor: "var(--soft-hover)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-muted">Subject:</span>{" "}
                      <strong className="text-body">{selectedEmail.subject}</strong>
                    </Col>
                    <Col sm={6} className="text-sm-end">
                      <span className="text-muted">Date:</span>{" "}
                      <strong>{formatEmailDate(selectedEmail)}</strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Audience:</span>{" "}
                      {renderAudienceBadge(selectedEmail.audience)}
                    </Col>
                    <Col sm={6} className="text-sm-end">
                      <span className="text-muted">Overall Status:</span>{" "}
                      {renderStatusBadge(selectedEmail.status)}
                    </Col>
                    <Col sm={12}>
                      <span className="text-muted">Dispatched By:</span>{" "}
                      <strong>{selectedEmail.sender?.name}</strong> (
                      {selectedEmail.sender?.email})
                    </Col>
                  </Row>
                </div>

                {/* Email Body */}
                <div className="mb-4">
                  <div className="small fw-bold text-muted text-uppercase mb-2">
                    Message Content
                  </div>
                  <div
                    className="p-3 rounded small"
                    style={{
                      backgroundColor: "var(--bg-main)",
                      border: "1px solid var(--border-color)",
                      whiteSpace: "pre-wrap",
                      maxHeight: "180px",
                      overflowY: "auto",
                    }}
                  >
                    {selectedEmail.message || "(No message body)"}
                  </div>
                </div>

                {/* Recipients List Breakdown */}
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="small fw-bold text-muted text-uppercase">
                      Recipients ({selectedEmail.recipients?.length || 0})
                    </div>
                    {(selectedEmail.recipients?.length || 0) > 5 && (
                      <Form.Control
                        size="sm"
                        placeholder="Filter recipients..."
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        style={{ ...inputStyle, width: "220px" }}
                      />
                    )}
                  </div>

                  <div
                    className="rounded overflow-hidden border"
                    style={{
                      borderColor: "var(--border-color)",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    <Table hover size="sm" className="mb-0 align-middle">
                      <thead style={{ backgroundColor: "var(--soft-hover)" }}>
                        <tr className="small text-muted">
                          <th className="ps-3 py-2">Name</th>
                          <th>Email Address</th>
                          <th className="text-center">Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEmail.recipients || [])
                          .filter((r) => {
                            const q = recipientSearch.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              (r.name || "").toLowerCase().includes(q) ||
                              (r.email || "").toLowerCase().includes(q)
                            );
                          })
                          .map((rec, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 py-2 text-body fw-semibold small">
                                {rec.name || "Recipient"}
                              </td>
                              <td className="small text-muted">{rec.email}</td>
                              <td className="text-center">
                                {rec.status === "sent" ? (
                                  <Badge
                                    bg="success"
                                    className="bg-opacity-10 text-success rounded-pill px-2"
                                  >
                                    <i className="bi bi-check-circle me-1"></i> Sent
                                  </Badge>
                                ) : (
                                  <Badge
                                    bg="danger"
                                    className="bg-opacity-10 text-danger rounded-pill px-2"
                                    title={rec.error || "Failed to deliver"}
                                  >
                                    <i className="bi bi-x-circle me-1"></i> Failed
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <Button
              variant="secondary"
              className="rounded-pill px-4"
              onClick={() => setShowDetailsModal(false)}
            >
              Close
            </Button>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
