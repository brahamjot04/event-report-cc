import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

// Try loading local .env in development
try {
  process.loadEnvFile?.();
} catch (_ERR) {
  // Ignore error if not available or already provided
}

// Initialize Firebase Admin SDK safely (once)
if (!getApps().length) {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    try {
      const serviceAccount = rawKey.trim().startsWith("{")
        ? JSON.parse(rawKey)
        : JSON.parse(Buffer.from(rawKey, "base64").toString("utf8"));

      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    }
  }
}

export default async function handler(req, res) {
  const sendJson = (status, payload) => {
    if (typeof res.status === "function") {
      return res.status(status).json(payload);
    }
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(payload));
  };

  if (req.method !== "POST") {
    if (typeof res.setHeader === "function") {
      res.setHeader("Allow", ["POST"]);
    }
    return sendJson(405, { error: `Method ${req.method} not allowed` });
  }

  if (!getApps().length) {
    return sendJson(500, {
      error:
        "Server configuration error: FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid on server.",
    });
  }

  const auth = getAuth();
  const db = getFirestore();

  // 1. Verify caller's Admin ID Token
  const authHeader =
    req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return sendJson(401, { error: "Unauthorized: Missing Bearer token." });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const callerDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (
      !callerDoc.exists ||
      !["admin", "super_admin"].includes(callerDoc.data()?.role)
    ) {
      return sendJson(403, {
        error: "Forbidden: Admin privileges required.",
      });
    }

    const { email, name = "Member", role = "user" } = req.body || {};
    if (!email) {
      return sendJson(400, { error: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check if user already exists in Firebase Auth
    let userRecord;
    let isNewUser = false;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Generate cryptographic random password for initial account creation (user will set their own via link)
        const tempSecret =
          crypto.randomBytes(24).toString("hex") + "Aa1!9";
        userRecord = await auth.createUser({
          email: normalizedEmail,
          displayName: name.trim(),
          password: tempSecret,
        });
        isNewUser = true;
      } else {
        throw err;
      }
    }

    // 3. Ensure Firestore user document exists with approved status
    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          name: name.trim(),
          email: normalizedEmail,
          role: role,
          status: "approved",
          createdAt: new Date(),
        },
        { merge: true }
      );

    // 4. Generate official single-use password setup link
    const host =
      req.headers.origin ||
      (req.headers.referer ? new URL(req.headers.referer).origin : null) ||
      "https://ccgndec.vercel.app";

    const resetLink = await auth.generatePasswordResetLink(normalizedEmail, {
      url: `${host}/login`,
      handleCodeInApp: false,
    });

    return sendJson(200, {
      success: true,
      resetLink,
      isNewUser,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error("Invite user endpoint error:", error);
    return sendJson(500, {
      error: error.message || "Failed to generate invite link.",
    });
  }
}
