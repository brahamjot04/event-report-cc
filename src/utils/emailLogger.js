import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import { invalidateCache } from "./dataCache";

/**
 * Logs details of sent emails into the Firestore `sent_emails` collection.
 *
 * @param {Object} params
 * @param {"broadcast"|"user_credentials"} params.type
 * @param {string} params.subject
 * @param {string} params.message
 * @param {string} params.audience - e.g. 'self' | 'core_team' | 'approved_users' | 'custom' | 'new_user'
 * @param {Array<{name: string, email: string, status: "sent"|"failed", error?: string, sentAt?: string}>} params.recipients
 * @param {number} [params.successfulCount]
 * @param {number} [params.failedCount]
 * @param {"sent"|"partially_failed"|"failed"} [params.status]
 * @param {Object} [params.sender] - Optional sender details override
 */
export async function logSentEmail({
  type = "broadcast",
  subject = "",
  message = "",
  audience = "custom",
  recipients = [],
  successfulCount,
  failedCount,
  status,
  sender,
}) {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const resolvedSender = {
    name:
      sender?.displayName ||
      sender?.name ||
      currentUser?.displayName ||
      currentUser?.email?.split("@")[0] ||
      "Admin",
    email: sender?.email || currentUser?.email || "system@gndec.ac.in",
    uid: sender?.uid || currentUser?.uid || "unknown",
  };

  const calculatedSuccess =
    typeof successfulCount === "number"
      ? successfulCount
      : recipients.filter((r) => r.status === "sent").length;

  const calculatedFailed =
    typeof failedCount === "number"
      ? failedCount
      : recipients.filter((r) => r.status === "failed").length;

  const resolvedStatus =
    status ||
    (calculatedFailed === 0
      ? "sent"
      : calculatedSuccess > 0
      ? "partially_failed"
      : "failed");

  try {
    const docRef = await addDoc(collection(db, "sent_emails"), {
      type,
      subject,
      message,
      audience,
      sender: resolvedSender,
      recipientCount: recipients.length,
      successfulCount: calculatedSuccess,
      failedCount: calculatedFailed,
      status: resolvedStatus,
      recipients,
      createdAt: serverTimestamp(),
      sentDate: new Date().toISOString(),
    });

    invalidateCache("sent_emails_list");
    return docRef.id;
  } catch (error) {
    console.error("Failed to log sent email to Firestore:", error);
    return null;
  }
}
