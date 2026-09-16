/**
 * GitHub Storage Adapter (Secure Proxy Mode)
 *
 * File uploads and downloads are routed through secure Vercel serverless functions
 * (/api/upload and /api/image). All sensitive GitHub tokens remain strictly on
 * the server side and are never exposed in browser bundles or client networks.
 */

import { auth } from "../firebase";

// Cache for loaded image URLs to avoid redundant calls
const imageCache = new Map();

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Uploads a file via the serverless /api/upload proxy.
 *
 * @param {File|Blob} file - The file object to upload
 * @param {string} fileName - Destination file name
 * @param {string} [folder="uploads"] - Subdirectory path
 * @returns {Promise<string|null>} - Returns the uploaded file path (e.g., "core-team/123_photo.jpg") or null
 */
export const uploadToGitHub = async (file, fileName, folder = "uploads") => {
  try {
    // 1. Verify user session
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("Upload aborted: No active user session.");
      alert("Upload Failed: You must be logged in to upload files.");
      return null;
    }

    // 2. Pre-validate file extension
    const effectiveFileName = fileName || file.name || "";
    const extMatch = effectiveFileName.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : "";

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      const errMsg = `File type '.${extension || "unknown"}' is not supported. Permitted types: ${ALLOWED_EXTENSIONS.join(", ")}`;
      console.error(errMsg);
      alert(`Upload Failed: ${errMsg}`);
      return null;
    }

    // 3. Pre-validate file size (5 MB limit)
    if (file && file.size && file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const errMsg = `File is too large (${sizeMb} MB). Maximum allowed size is 5 MB.`;
      console.error(errMsg);
      alert(`Upload Failed: ${errMsg}`);
      return null;
    }

    // 4. Convert File to Base64
    const toBase64 = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });

    const base64Content = await toBase64(file);

    // 5. Retrieve fresh Bearer ID token for authorization
    const idToken = await currentUser.getIdToken();

    // 6. Dispatch upload to secure serverless function
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fileName: effectiveFileName,
        folder,
        base64Content,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("File uploaded successfully via secure proxy:", data.path);
      return data.path;
    } else {
      console.error("Upload Proxy Error:", data);
      alert(`Upload Failed: ${data.error || "Unknown server error"}`);
      return null;
    }
  } catch (error) {
    console.error("Upload to GitHub failed:", error);
    alert(`Upload Failed: ${error.message}`);
    return null;
  }
};

/**
 * Resolves a stored image path to a displayable URL.
 * Routes private repo assets through /api/image?path=...
 *
 * @param {string} path - Stored image path or full URL
 * @returns {Promise<string|null>} - URL to display in <img> src
 */
export const fetchImageFromGitHub = async (path) => {
  if (!path) return null;

  // If already an absolute URL (e.g. data: or https://), return directly
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  // Check cache
  if (imageCache.has(path)) {
    return imageCache.get(path);
  }

  // Route through secure backend proxy endpoint
  const proxyUrl = `/api/image?path=${encodeURIComponent(path)}`;
  imageCache.set(path, proxyUrl);

  return proxyUrl;
};