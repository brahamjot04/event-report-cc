// src/utils/github.js

// ⚠️ SECURITY WARNING: In a real app, never store keys here.
// For this project, it's fine, but do not share this code publicly.
const GITHUB_TOKEN = "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"; 
const USERNAME = "brahamjot04";
const REPO_NAME = "event-report-cc-app-data"; // e.g., "event-data"
const BRANCH = "main"; // or "master"

// Cache for loaded images to avoid repeated API calls
const imageCache = new Map();

// ⚠️ THE FIX: Added 'folder' argument with a default value
export const uploadToGitHub = async (file, fileName, folder = "uploads") => {
  try {
    // 1. Convert File to Base64
    const toBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          // Remove "data:*/*;base64," prefix
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });

    const content = await toBase64(file);

    // 2. Construct the Path (The Bug was likely here!)
    // We now use the 'folder' variable passed to the function
    const path = `${folder}/${fileName}`; 

    // 3. Upload via GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload ${fileName}`,
          content: content,
          branch: BRANCH,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      // For private repos, store the path - we'll fetch it later via API
      console.log("Image uploaded successfully:", path);
      console.log("Full upload response:", data);
      return path; // Return the path, not the URL
    } else {
      console.error("GitHub Upload Error:", data);
      alert(`GitHub Upload Failed: ${data.message}`);
      return null;
    }
  } catch (error) {
    console.error("Upload failed:", error);
    return null;
  }
};

// Fetch image from private GitHub repo and convert to data URL
export const fetchImageFromGitHub = async (path) => {
  // Check cache first
  if (imageCache.has(path)) {
    console.log("Image loaded from cache:", path);
    return imageCache.get(path);
  }

  console.log("Fetching image from GitHub:", path);

  try {
    const url = `https://api.github.com/repos/${USERNAME}/${REPO_NAME}/contents/${path}`;
    console.log("Request URL:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch image:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log("GitHub API response data keys:", Object.keys(data));
    
    // Check if content exists
    if (!data.content) {
      console.error("No content in response:", data);
      return null;
    }
    
    // GitHub API returns base64 content
    // Determine mime type from file extension
    const extension = path.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    const mimeType = mimeTypes[extension] || 'image/jpeg';
    
    // Create data URL - remove all newlines and whitespace from base64
    const cleanBase64 = data.content.replace(/\s/g, '');
    const dataUrl = `data:${mimeType};base64,${cleanBase64}`;
    
    // Cache it
    imageCache.set(path, dataUrl);
    
    console.log("Image fetched and cached successfully:", path);
    return dataUrl;
  } catch (error) {
    console.error("Error fetching image from GitHub:", error);
    console.error("Error details:", error.message);
    return null;
  }
};