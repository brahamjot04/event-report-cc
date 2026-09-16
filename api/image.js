/**
 * Vercel Serverless Function: Secure GitHub Image/File Proxy
 *
 * Fetches files from the private GitHub repository using the server-side GITHUB_TOKEN
 * and streams the file directly to the client with HTTP caching headers.
 */

// Attempt loading local .env in development
try {
  process.loadEnvFile?.();
} catch (_ERR) {
  // Ignore in production
}

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

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Extract 'path' from req.query or fallback to parsing req.url
  let rawPath = req.query?.path;
  if (!rawPath && req.url) {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      rawPath = parsedUrl.searchParams.get("path");
    } catch (_ERR) {
      // Ignore
    }
  }

  if (!rawPath) {
    return res.status(400).json({ error: "Missing required 'path' query parameter." });
  }

  // Prevent directory traversal
  const safePath = String(rawPath)
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/^\/+/, "");

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

  if (!GITHUB_TOKEN) {
    console.error("[api/image] Server GITHUB_TOKEN is not configured.");
    return res.status(500).json({ error: "Server GITHUB_TOKEN is not configured." });
  }

  const extension = safePath.split(".").pop().toLowerCase();
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };

  const contentType = mimeTypes[extension];
  if (!contentType) {
    return res.status(403).json({
      error: `Access forbidden: File type '.${extension}' is not permitted.`,
    });
  }

  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    const url = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${safePath}`;

    // Request raw binary format directly to bypass 1MB JSON/Base64 API limits
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "CC-GNDEC-Portal-Backend",
      },
    });

    if (!response.ok) {
      // If raw accept wasn't supported, fallback to standard v3 JSON
      const fallbackResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "CC-GNDEC-Portal-Backend",
        },
      });

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        return res.status(fallbackResponse.status).send(errorText);
      }

      const data = await fallbackResponse.json();
      if (!data.content) {
        return res.status(404).json({ error: "File content not found." });
      }

      const cleanBase64 = data.content.replace(/\s/g, "");
      const fileBuffer = Buffer.from(cleanBase64, "base64");

      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800"
      );
      return res.status(200).send(fileBuffer);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Cache image responses in browser and edge CDN for 24 hours
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    return res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("Error fetching image from GitHub proxy:", error);
    return res.status(500).json({ error: error.message || "Failed to load image." });
  }
}
