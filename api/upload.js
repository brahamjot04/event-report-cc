/**
 * Vercel Serverless Function: Secure GitHub Upload Proxy
 *
 * Receives file data from authenticated frontend clients and uploads it to GitHub
 * using a server-side GITHUB_TOKEN environment variable.
 * Enforces strict caller authentication (Firebase Admin), approved account verification,
 * allowed file extension whitelisting, and a 5 MB payload limit.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Attempt loading local .env in development
try {
  process.loadEnvFile?.();
} catch (_ERR) {
  // Ignore in production
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
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY in /api/upload:", err);
    }
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default async function handler(req, res) {
  // Polyfill helper methods for non-Vercel/bare node environments (e.g. Vite dev)
  if (!res.status) {
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function (data) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return res;
    };
  }
  if (!res.send) {
    res.send = function (data) {
      res.end(data);
      return res;
    };
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // 1. Verify Authorization Bearer Token (SEC-14)
  const authHeader =
    req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing Bearer authorization token." });
  }

  if (!getApps().length) {
    return res.status(500).json({
      error:
        "Server configuration error: FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid on server.",
    });
  }

  const auth = getAuth();
  const db = getFirestore();

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (authErr) {
    console.error("Token verification failed in /api/upload:", authErr);
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired ID token." });
  }

  // 2. Verify caller has 'approved' status or an admin role
  try {
    const callerDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!callerDoc.exists) {
      return res
        .status(403)
        .json({ error: "Forbidden: User profile record not found." });
    }

    const userData = callerDoc.data();
    const isApproved = userData?.status?.toLowerCase() === "approved";
    const isAdmin = ["admin", "super_admin"].includes(userData?.role);

    if (!isApproved && !isAdmin) {
      return res.status(403).json({
        error:
          "Forbidden: Only approved committee members or administrators can upload files.",
      });
    }
  } catch (dbErr) {
    console.error("User authorization lookup failed in /api/upload:", dbErr);
    return res
      .status(500)
      .json({ error: "Internal error verifying user permissions." });
  }

  // Server-side environment variables (supports both GITHUB_TOKEN and VITE_ fallback)
  const GITHUB_TOKEN =
    process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
  const USERNAME =
    process.env.GITHUB_USERNAME ||
    process.env.VITE_GITHUB_USERNAME ||
    "brahamjot04";
  const REPO_NAME =
    process.env.GITHUB_REPO ||
    process.env.VITE_GITHUB_REPO ||
    "event-report-cc-app-data";
  const BRANCH =
    process.env.GITHUB_BRANCH ||
    process.env.VITE_GITHUB_BRANCH ||
    "main";

  if (!GITHUB_TOKEN) {
    console.error("Missing GITHUB_TOKEN in server environment variables.");
    return res.status(500).json({
      error: "Server storage configuration error: GITHUB_TOKEN is not configured.",
    });
  }

  try {
    const { fileName, folder = "uploads", base64Content } = req.body || {};

    if (!fileName || !base64Content) {
      return res.status(400).json({
        error: "Bad Request: 'fileName' and 'base64Content' are required.",
      });
    }

    // 3. Sanitize folder and file names to prevent directory traversal
    const cleanFolder = String(folder)
      .replace(/\\/g, "/")
      .replace(/[^a-zA-Z0-9_\-/]/g, "")
      .replace(/^\/+|\/+$/g, "");

    const cleanFileName = String(fileName)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "");

    if (!cleanFileName) {
      return res.status(400).json({ error: "Invalid file name provided." });
    }

    // 4. File extension validation - Whitelist Check (SEC-15)
    const extMatch = cleanFileName.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : "";

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return res.status(400).json({
        error: `Invalid file type '.${extension || "unknown"}'. Permitted types: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
    }

    // 5. File size validation - 5 MB maximum limit
    const cleanBase64 = base64Content.includes(",")
      ? base64Content.split(",")[1]
      : base64Content;

    const approximateSizeBytes = Math.ceil((cleanBase64.length * 3) / 4);
    if (approximateSizeBytes > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        error: `File exceeds maximum allowed size of 5 MB (size: ${(approximateSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
      });
    }

    const filePath = cleanFolder
      ? `${cleanFolder}/${cleanFileName}`
      : cleanFileName;

    // 6. Dispatch upload via GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "CC-GNDEC-Portal-Backend",
        },
        body: JSON.stringify({
          message: `Upload ${cleanFileName} via Portal`,
          content: cleanBase64,
          branch: BRANCH,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GitHub API upload failed:", data);
      return res.status(response.status).json({
        error: data.message || "Failed to upload file to GitHub repository.",
      });
    }

    return res.status(200).json({
      success: true,
      path: filePath,
      downloadUrl: data.content?.download_url || null,
      htmlUrl: data.content?.html_url || null,
      size: data.content?.size || null,
    });
  } catch (error) {
    console.error("Unhandled error in /api/upload handler:", error);
    return res.status(500).json({
      error: error.message || "Internal server error while processing upload.",
    });
  }
}
