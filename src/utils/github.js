// src/utils/github.js

// ⚠️ SECURITY WARNING: In a real app, never store keys here.
// For this project, it's fine, but do not share this code publicly.
const GITHUB_TOKEN = "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"; 
const USERNAME = "brahamjot04";
const REPO_NAME = "event-report-cc-app-data"; // e.g., "event-data"
const BRANCH = "main"; // or "master"

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
      // Return the download URL
      return data.content.download_url; 
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