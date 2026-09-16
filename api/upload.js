/**
 * Vercel Serverless Function: Secure GitHub Upload Proxy
 *
 * Receives file data from the frontend and uploads it to GitHub using a server-side
 * GITHUB_TOKEN environment variable. Tokens are never exposed to browser clients.
 */

// Attempt loading local .env in development
try {
  process.loadEnvFile?.();
} catch (_ERR) {
  // Ignore in production
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

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

    // 1. Sanitize folder and file names to prevent directory traversal
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

    const filePath = cleanFolder
      ? `${cleanFolder}/${cleanFileName}`
      : cleanFileName;

    // 2. Strip data URL header prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Content.includes(",")
      ? base64Content.split(",")[1]
      : base64Content;

    // 3. Dispatch upload via GitHub API
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
