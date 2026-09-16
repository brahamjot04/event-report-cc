import { useState, useEffect, useCallback, useMemo } from "react";
import { Navigate } from "react-router-dom";
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
  const { user, isAdmin, loading } = useAuth();
  const { showSuccess, showError, confirm } = useToast();

  const [activeTab, setActiveTab] = useState("compose"); // 'compose' | 'history'

  // Compose State
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetGroup, setTargetGroup] = useState("self"); // 'self' | 'core_team' | 'approved_users' | 'custom'
  const [customReplyTo, setCustomReplyTo] = useState("");
  const [customEmailsInput, setCustomEmailsInput] = useState("");
  const [customEmailsValidation, setCustomEmailsValidation] = useState({
    valid: [],
    invalid: [],
  });

  // Automatically initialize customReplyTo with current user's email
  useEffect(() => {
    if (user?.email && !customReplyTo) {
      setCustomReplyTo(user.email);
    }
  }, [user, customReplyTo]);

  // Database Recipient Selection States
  const [availableRecipients, setAvailableRecipients] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [missingEmailCount, setMissingEmailCount] = useState(0);
  const [recipientFilterText, setRecipientFilterText] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  // DB Contact Picker Modal (for selecting contacts from DB into custom emails)
  const [showDbPickerModal, setShowDbPickerModal] = useState(false);
  const [dbContacts, setDbContacts] = useState([]);
  const [loadingDbContacts, setLoadingDbContacts] = useState(false);
  const [dbPickerTab, setDbPickerTab] = useState("all"); // 'all' | 'core_team' | 'users'
  const [dbPickerSearch, setDbPickerSearch] = useState("");
  const [dbPickerSelectedEmails, setDbPickerSelectedEmails] = useState(new Set());

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
    }
  }, [targetGroup, customEmailsInput]);

  // Derived list of recipients to actually dispatch emails to
  const activeRecipients = useMemo(() => {
    if (targetGroup === "self") {
      return user?.email
        ? [
            {
              id: "self",
              name: user?.displayName || "Admin",
              email: user.email,
            },
          ]
        : [];
    }
    if (targetGroup === "custom") {
      return customEmailsValidation.valid.map((em) => ({
        id: em,
        name: em.split("@")[0],
        email: em,
      }));
    }
    return availableRecipients.filter((r) => selectedEmails.has(r.email));
  }, [
    targetGroup,
    user,
    customEmailsValidation.valid,
    availableRecipients,
    selectedEmails,
  ]);

  // Filtered available recipients for the in-compose checklist
  const filteredAvailableRecipients = useMemo(() => {
    const q = recipientFilterText.toLowerCase().trim();
    if (!q) return availableRecipients;
    return availableRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.designation && r.designation.toLowerCase().includes(q))
    );
  }, [availableRecipients, recipientFilterText]);

  const handleToggleRecipient = (email) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const handleSelectAllRecipients = () => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      filteredAvailableRecipients.forEach((r) => next.add(r.email));
      return next;
    });
  };

  const handleDeselectAllRecipients = () => {
    if (recipientFilterText.trim()) {
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        filteredAvailableRecipients.forEach((r) => next.delete(r.email));
        return next;
      });
    } else {
      setSelectedEmails(new Set());
    }
  };

  // Open Database Contact Picker Modal
  const openDbPickerModal = async () => {
    setShowDbPickerModal(true);
    setLoadingDbContacts(true);
    setDbPickerSearch("");
    setDbPickerSelectedEmails(new Set());
    try {
      const [coreSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "global_core_team")),
        getDocs(query(collection(db, "users"), where("status", "==", "approved"))),
      ]);

      const contacts = [];
      coreSnap.docs.forEach((d) => {
        const data = d.data();
        const em = (data.email || "").trim().toLowerCase();
        if (em && em.includes("@")) {
          contacts.push({
            id: `core-${d.id}`,
            name: data.name || "Core Team Member",
            email: em,
            designation: data.designation || "Core Team",
            group: "core_team",
            groupLabel: "Core Team",
          });
        }
      });

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const em = (data.email || "").trim().toLowerCase();
        if (em && em.includes("@")) {
          contacts.push({
            id: `user-${d.id}`,
            name: data.name || "User",
            email: em,
            designation: data.role
              ? `${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`
              : "User",
            group: "users",
            groupLabel: "Approved User",
          });
        }
      });

      contacts.sort((a, b) => a.name.localeCompare(b.name));
      setDbContacts(contacts);
    } catch (err) {
      console.error("Failed to load contacts from DB:", err);
      showError("Failed to load contacts from DB: " + err.message);
    } finally {
      setLoadingDbContacts(false);
    }
  };

  const filteredDbContacts = useMemo(() => {
    return dbContacts.filter((c) => {
      if (dbPickerTab !== "all" && c.group !== dbPickerTab) return false;
      const q = dbPickerSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.designation && c.designation.toLowerCase().includes(q))
      );
    });
  }, [dbContacts, dbPickerTab, dbPickerSearch]);

  const handleToggleDbContact = (email) => {
    setDbPickerSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const handleSelectAllDbContacts = () => {
    setDbPickerSelectedEmails((prev) => {
      const next = new Set(prev);
      filteredDbContacts.forEach((c) => next.add(c.email));
      return next;
    });
  };

  const handleDeselectAllDbContacts = () => {
    if (dbPickerSearch.trim() || dbPickerTab !== "all") {
      setDbPickerSelectedEmails((prev) => {
        const next = new Set(prev);
        filteredDbContacts.forEach((c) => next.delete(c.email));
        return next;
      });
    } else {
      setDbPickerSelectedEmails(new Set());
    }
  };

  const handleInsertSelectedDbEmails = () => {
    if (dbPickerSelectedEmails.size === 0) return;
    const currentList = customEmailsInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const set = new Set(currentList);
    let addedCount = 0;
    dbPickerSelectedEmails.forEach((email) => {
      if (!set.has(email)) {
        set.add(email);
        addedCount += 1;
      }
    });
    setCustomEmailsInput(Array.from(set).join(", "));
    setShowDbPickerModal(false);
    showSuccess(`Added ${addedCount} email(s) from database.`);
  };

  // Fetch recipients whenever targetGroup changes
  const loadRecipients = useCallback(async () => {
    if (targetGroup === "custom") {
      const { valid, invalid } = parseCustomEmails(customEmailsInput);
      setCustomEmailsValidation({ valid, invalid });
      return;
    }

    if (targetGroup === "self") {
      setAvailableRecipients(
        user?.email
          ? [
              {
                id: "self",
                name: user?.displayName || "Admin",
                email: user.email,
                designation: "Current User",
              },
            ]
          : []
      );
      setSelectedEmails(new Set(user?.email ? [user.email] : []));
      setMissingEmailCount(0);
      return;
    }

    setLoadingRecipients(true);
    setRecipientFilterText("");
    try {
      if (targetGroup === "core_team") {
        await loadWithCache(
          "email_recipients_core_team",
          async () => {
            const snap = await getDocs(collection(db, "global_core_team"));
            const valid = [];
            let missing = 0;
            snap.docs.forEach((d) => {
              const data = d.data();
              const email = (data.email || "").trim().toLowerCase();
              if (email && email.includes("@")) {
                valid.push({
                  id: d.id,
                  name: data.name || "Core Team Member",
                  email: email,
                  designation: data.designation || "Core Team",
                  group: "core_team",
                });
              } else {
                missing += 1;
              }
            });
            valid.sort((a, b) => a.name.localeCompare(b.name));
            return { valid, missing };
          },
          (result, isCached) => {
            const list = result?.valid || [];
            setAvailableRecipients(list);
            setSelectedEmails(new Set(list.map((r) => r.email)));
            setMissingEmailCount(result?.missing || 0);
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
              where("status", "==", "approved")
            );
            const snap = await getDocs(q);
            const valid = [];
            let missing = 0;
            snap.docs.forEach((d) => {
              const data = d.data();
              const email = (data.email || "").trim().toLowerCase();
              if (email && email.includes("@")) {
                valid.push({
                  id: d.id,
                  name: data.name || "Member",
                  email: email,
                  designation: data.role
                    ? `${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`
                    : "Approved User",
                  group: "approved_users",
                });
              } else {
                missing += 1;
              }
            });
            valid.sort((a, b) => a.name.localeCompare(b.name));
            return { valid, missing };
          },
          (result, isCached) => {
            const list = Array.isArray(result) ? result : result?.valid || [];
            setAvailableRecipients(list);
            setSelectedEmails(new Set(list.map((r) => r.email)));
            setMissingEmailCount(Array.isArray(result) ? 0 : result?.missing || 0);
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
    document.title = "Broadcast Email | CC GNDEC";
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

    if (activeRecipients.length === 0) {
      showError("Please select at least one valid recipient for the broadcast.");
      return;
    }

    // Confirmation if sending to multiple recipients
    if (activeRecipients.length > 1) {
      const ok = await confirm({
        title: "Confirm Email Broadcast",
        message: `You are about to send this announcement to ${activeRecipients.length} recipients. Do you wish to proceed?`,
        confirmText: `Send to ${activeRecipients.length} Recipients`,
        variant: "primary",
      });
      if (!ok) return;
    }

    // Reply-To resolution and validation
    const finalReplyTo = (customReplyTo || "").trim() || user?.email || "";
    if (customReplyTo && customReplyTo.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customReplyTo.trim())) {
        showError("Please enter a valid email address in the Reply-To field.");
        return;
      }
    }

    setSending(true);

    try {
      let sentCount = 0;
      let failedCount = 0;
      const recipientResults = [];

      const adminName = user?.displayName || "Cultural Committee Admin";

      for (const recipient of activeRecipients) {
        const templateParams = {
          to_email: recipient.email,
          to_name: recipient.name || "Member",
          recipient_email: recipient.email,
          recipient_name: recipient.name || "Member",
          email: recipient.email,
          reply_to: finalReplyTo,
          from_email: finalReplyTo,
          from_name: user?.displayName
            ? `${user.displayName} (Cultural Committee GNDEC)`
            : "Cultural Committee GNDEC",
          sender_name: adminName,
          admin_name: adminName,
          name: adminName, // Matches template's 'From Name: {{name}}' and 'Sent by: {{name}} (Admin)'
          title: subject,
          subject: subject,
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
        replyTo: finalReplyTo,
      });

      // Also log general activity
      await logAction(
        "SEND_EMAIL",
        `Sent broadcast announcement "${subject}" to ${sentCount}/${activeRecipients.length} recipient(s) [Audience: ${targetGroup}, Status: ${overallStatus}]`,
        user
      );

      if (sentCount > 0) {
        showSuccess(
          `Announcement successfully sent to ${sentCount} recipient${sentCount > 1 ? "s" : ""}${failedCount > 0 ? ` (${failedCount} failed)` : ""}!`
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

  const modalRecipients = useMemo(() => {
    if (!selectedEmail?.recipients) return [];
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return selectedEmail.recipients;
    return selectedEmail.recipients.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
    );
  }, [selectedEmail, recipientSearch]);

  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

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

                      {/* Audience Recipient Info / Interactive Selection */}
                      {targetGroup === "self" && (
                        <div className="d-flex align-items-center gap-2">
                          <small className="text-muted">
                            Target count:{" "}
                            <Badge bg="info" className="text-dark">
                              1 Recipient
                            </Badge>{" "}
                            ({user?.email || "No email"})
                          </small>
                        </div>
                      )}

                      {(targetGroup === "core_team" || targetGroup === "approved_users") && (
                        <div className="mt-3">
                          {missingEmailCount > 0 && targetGroup === "core_team" && (
                            <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-2">
                              <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                              <div>
                                <strong>{missingEmailCount} member{missingEmailCount > 1 ? "s" : ""}</strong> in Core Team {missingEmailCount > 1 ? "do" : "does"} not have an email address recorded. You can add their emails in the <a href="/core-team" className="alert-link">Core Team</a> page.
                              </div>
                            </div>
                          )}

                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <div className="small">
                              <span className="text-muted">Selected: </span>
                              <Badge bg={activeRecipients.length > 0 ? "primary" : "secondary"}>
                                {activeRecipients.length} of {availableRecipients.length} Recipient{availableRecipients.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="py-0 px-2 small rounded-pill"
                                style={{ fontSize: "12px" }}
                                onClick={handleSelectAllRecipients}
                                disabled={availableRecipients.length === 0}
                              >
                                Select All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                className="py-0 px-2 small rounded-pill"
                                style={{ fontSize: "12px" }}
                                onClick={handleDeselectAllRecipients}
                                disabled={selectedEmails.size === 0}
                              >
                                Deselect All
                              </Button>
                            </div>
                          </div>

                          {availableRecipients.length > 4 && (
                            <Form.Control
                              size="sm"
                              type="search"
                              placeholder="Filter members by name, role, or email..."
                              value={recipientFilterText}
                              onChange={(e) => setRecipientFilterText(e.target.value)}
                              style={inputStyle}
                              className="mb-2"
                            />
                          )}

                          {/* Scrollable Recipient Checklist */}
                          <div
                            className="border rounded p-2 mb-2"
                            style={{
                              maxHeight: "220px",
                              overflowY: "auto",
                              backgroundColor: "var(--bg-main)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            {loadingRecipients ? (
                              <div className="text-center py-3 text-muted small">
                                <Spinner animation="border" size="sm" className="me-2" />
                                Loading recipients...
                              </div>
                            ) : availableRecipients.length === 0 ? (
                              <div className="text-center py-3 text-muted small">
                                No members with registered email addresses found.
                              </div>
                            ) : filteredAvailableRecipients.length === 0 ? (
                              <div className="text-center py-3 text-muted small">
                                No matching recipients found for &quot;{recipientFilterText}&quot;.
                              </div>
                            ) : (
                              filteredAvailableRecipients.map((r) => {
                                const isChecked = selectedEmails.has(r.email);
                                return (
                                  <div
                                    key={r.email}
                                    className={`d-flex align-items-center justify-content-between p-2 rounded mb-1 ${
                                      isChecked ? "bg-primary-subtle" : ""
                                    }`}
                                    style={{
                                      cursor: "pointer",
                                      transition: "background-color 0.15s ease",
                                    }}
                                    onClick={() => handleToggleRecipient(r.email)}
                                  >
                                    <div className="d-flex align-items-center gap-2 text-truncate me-2">
                                      <Form.Check
                                        type="checkbox"
                                        id={`recip-${r.id || r.email}`}
                                        checked={isChecked}
                                        onChange={() => handleToggleRecipient(r.email)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mb-0"
                                      />
                                      <span className="fw-semibold text-truncate small">{r.name}</span>
                                      {r.designation && (
                                        <Badge
                                          bg="secondary"
                                          className="fw-normal text-truncate small"
                                          style={{ maxWidth: "160px" }}
                                        >
                                          {r.designation}
                                        </Badge>
                                      )}
                                    </div>
                                    <small className="text-muted text-truncate font-monospace" style={{ fontSize: "11px" }}>
                                      {r.email}
                                    </small>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </Form.Group>

                    {/* Custom Email Address Input */}
                    {targetGroup === "custom" && (
                      <Form.Group className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <Form.Label className="fw-bold mb-0">
                            Recipient Email Address(es)
                          </Form.Label>
                          <Button
                            type="button"
                            variant="outline-primary"
                            size="sm"
                            className="rounded-pill py-0 px-2 small"
                            style={{ fontSize: "12px" }}
                            onClick={openDbPickerModal}
                          >
                            <i className="bi bi-person-plus-fill me-1"></i> Select from DB
                          </Button>
                        </div>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          placeholder="e.g. principal@college.edu, faculty@gndec.ac.in"
                          value={customEmailsInput}
                          onChange={(e) => setCustomEmailsInput(e.target.value)}
                          style={inputStyle}
                          required
                        />
                        <div className="d-flex justify-content-between align-items-center mt-1">
                          <Form.Text className="text-muted small">
                            Separate multiple addresses with commas, semicolons, or newlines.
                          </Form.Text>
                          <small className="text-muted">
                            Target count:{" "}
                            <Badge bg="info" className="text-dark">
                              {activeRecipients.length} Recipient{activeRecipients.length !== 1 ? "s" : ""}
                            </Badge>
                          </small>
                        </div>
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

                    {/* Reply-To Address Field */}
                    <Form.Group className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <Form.Label className="fw-bold mb-0">
                          <i className="bi bi-reply me-1 text-primary"></i>
                          Reply-To Address
                        </Form.Label>
                        {user?.email && customReplyTo !== user.email && (
                          <Button
                            type="button"
                            variant="outline-secondary"
                            size="sm"
                            className="rounded-pill py-0 px-2 small"
                            style={{ fontSize: "12px" }}
                            onClick={() => setCustomReplyTo(user.email)}
                          >
                            <i className="bi bi-arrow-counterclockwise me-1"></i> Reset to my email
                          </Button>
                        )}
                      </div>
                      <Form.Control
                        type="email"
                        placeholder="e.g. your-email@gndec.ac.in"
                        value={customReplyTo}
                        onChange={(e) => setCustomReplyTo(e.target.value)}
                        style={inputStyle}
                        required
                      />
                      <Form.Text className="text-muted small">
                        Recipient replies will be delivered to this address. Defaults to your admin email ({user?.email || "logged-in account"}).
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
                          <div className="small text-muted mb-2 border-bottom pb-2">
                            <div>
                              <span>From: </span>
                              <strong>{user?.displayName || "Admin"}</strong> (via Cultural Committee System)
                            </div>
                            <div>
                              <span>Reply-To: </span>
                              <strong className="text-primary">{customReplyTo || user?.email || "(none)"}</strong>
                            </div>
                          </div>
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
                          activeRecipients.length === 0 ||
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
                              : `Broadcast to ${activeRecipients.length} Selected Recipient${activeRecipients.length !== 1 ? "s" : ""}`}
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
        scrollable
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
                      {selectedEmail.replyTo && (
                        <span className="ms-2 text-muted">
                          • Reply-To: <strong className="text-body">{selectedEmail.replyTo}</strong>
                        </span>
                      )}
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
                    className="rounded border"
                    style={{
                      borderColor: "var(--border-color)",
                      maxHeight: "260px",
                      overflowY: "auto",
                    }}
                  >
                    <Table hover size="sm" className="mb-0 align-middle">
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                        }}
                      >
                        <tr className="small text-muted">
                          <th className="ps-3 py-2" style={{ backgroundColor: "var(--soft-hover)" }}>Name</th>
                          <th style={{ backgroundColor: "var(--soft-hover)" }}>Email Address</th>
                          <th className="text-center" style={{ backgroundColor: "var(--soft-hover)" }}>Delivery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-3 text-muted small">
                              {recipientSearch.trim()
                                ? `No recipients found matching "${recipientSearch}"`
                                : "No recipients recorded for this dispatch."}
                            </td>
                          </tr>
                        ) : (
                          modalRecipients.map((rec, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 py-2 text-body fw-semibold small">
                                {rec.name || "Recipient"}
                              </td>
                              <td className="small text-muted font-monospace">{rec.email}</td>
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
                          ))
                        )}
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

      {/* SELECT FROM DB MODAL */}
      <Modal
        show={showDbPickerModal}
        onHide={() => setShowDbPickerModal(false)}
        size="lg"
        centered
      >
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Header closeButton className="border-0 pb-0">
            <Modal.Title className="fw-bold fs-5">
              <i className="bi bi-database-check text-primary me-2"></i>
              Select Contacts from Database
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Select contacts from Core Team or Approved Users to insert into your custom recipient list.
            </p>

            {/* Filter Tabs */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button
                size="sm"
                variant={dbPickerTab === "all" ? "primary" : "outline-secondary"}
                className="rounded-pill px-3"
                onClick={() => setDbPickerTab("all")}
              >
                All Contacts ({dbContacts.length})
              </Button>
              <Button
                size="sm"
                variant={dbPickerTab === "core_team" ? "primary" : "outline-secondary"}
                className="rounded-pill px-3"
                onClick={() => setDbPickerTab("core_team")}
              >
                Core Team ({dbContacts.filter((c) => c.group === "core_team").length})
              </Button>
              <Button
                size="sm"
                variant={dbPickerTab === "users" ? "primary" : "outline-secondary"}
                className="rounded-pill px-3"
                onClick={() => setDbPickerTab("users")}
              >
                Approved Users ({dbContacts.filter((c) => c.group === "users").length})
              </Button>
            </div>

            {/* Search & Bulk Selection */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div className="flex-grow-1" style={{ maxWidth: "360px" }}>
                <Form.Control
                  size="sm"
                  type="search"
                  placeholder="Search by name, role, or email..."
                  value={dbPickerSearch}
                  onChange={(e) => setDbPickerSearch(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="rounded-pill px-2 py-0 small"
                  style={{ fontSize: "12px" }}
                  onClick={handleSelectAllDbContacts}
                  disabled={filteredDbContacts.length === 0}
                >
                  Select All ({filteredDbContacts.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="rounded-pill px-2 py-0 small"
                  style={{ fontSize: "12px" }}
                  onClick={handleDeselectAllDbContacts}
                  disabled={dbPickerSelectedEmails.size === 0}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Contacts Checklist */}
            <div
              className="border rounded p-2"
              style={{
                maxHeight: "320px",
                overflowY: "auto",
                backgroundColor: "var(--bg-main)",
                borderColor: "var(--border-color)",
              }}
            >
              {loadingDbContacts ? (
                <div className="text-center py-4 text-muted small">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Loading database contacts...
                </div>
              ) : filteredDbContacts.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  No contacts found.
                </div>
              ) : (
                filteredDbContacts.map((c) => {
                  const isChecked = dbPickerSelectedEmails.has(c.email);
                  return (
                    <div
                      key={c.id}
                      className={`d-flex align-items-center justify-content-between p-2 rounded mb-1 ${
                        isChecked ? "bg-primary-subtle" : ""
                      }`}
                      style={{
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                      onClick={() => handleToggleDbContact(c.email)}
                    >
                      <div className="d-flex align-items-center gap-2 text-truncate me-2">
                        <Form.Check
                          type="checkbox"
                          id={`picker-${c.id}`}
                          checked={isChecked}
                          onChange={() => handleToggleDbContact(c.email)}
                          onClick={(e) => e.stopPropagation()}
                          className="mb-0"
                        />
                        <span className="fw-semibold text-truncate small">{c.name}</span>
                        <Badge
                          bg={c.group === "core_team" ? "primary" : "info"}
                          className={`small fw-normal text-truncate ${
                            c.group === "users" ? "text-dark" : ""
                          }`}
                          style={{ maxWidth: "140px" }}
                        >
                          {c.designation}
                        </Badge>
                      </div>
                      <small className="text-muted font-monospace text-truncate" style={{ fontSize: "11px" }}>
                        {c.email}
                      </small>
                    </div>
                  );
                })
              )}
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              {dbPickerSelectedEmails.size} contact{dbPickerSelectedEmails.size !== 1 ? "s" : ""} selected
            </span>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                className="rounded-pill px-3"
                onClick={() => setShowDbPickerModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="rounded-pill px-4"
                disabled={dbPickerSelectedEmails.size === 0}
                onClick={handleInsertSelectedDbEmails}
              >
                <i className="bi bi-check-lg me-1"></i>
                Insert {dbPickerSelectedEmails.size} Selected
              </Button>
            </div>
          </Modal.Footer>
        </div>
      </Modal>
    </Layout>
  );
}
