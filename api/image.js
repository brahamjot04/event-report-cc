/**
 * Vercel Serverless Function: Secure GitHub Image/File Proxy
 *
 * Fetches files from the private GitHub repository using the server-side GITHUB_TOKEN
 * and streams the file directly to the client with HTTP caching headers.
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { path: rawPath } = req.query || {};

  if (!rawPath) {
    return res.status(400).json({ error: "Missing required 'path' query parameter." });
  }

  // Prevent directory traversal
  const safePath = String(rawPath)
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "");

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const USERNAME = process.env.GITHUB_USERNAME || "brahamjot04";
  const REPO_NAME = process.env.GITHUB_REPO || "event-report-cc-app-data";

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: "Server GITHUB_TOKEN is not configured." });
  }

  try {
    const url = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${safePath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CC-GNDEC-Portal-Backend",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();

    if (!data.content) {
      return res.status(404).json({ error: "File content not found." });
    }

    const extension = safePath.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
    };

    const contentType = mimeTypes[extension] || "application/octet-stream";
    const cleanBase64 = data.content.replace(/\s/g, "");
    const fileBuffer = Buffer.from(cleanBase64, "base64");

    // Cache image responses in browser and edge CDN for 24 hours
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("Error fetching image from GitHub proxy:", error);
    return res.status(500).json({ error: error.message || "Failed to load image." });
  }
}
