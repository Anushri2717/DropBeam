export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return "";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function getFileIcon(fileType, fileName) {
  if (!fileType && !fileName) return "📄";
  const type = fileType || "";
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📕";
  if (["zip","rar","7z","tar"].includes(ext)) return "📦";
  if (["docx","doc"].includes(ext)) return "📝";
  if (["xlsx","csv"].includes(ext)) return "📊";
  if (["pptx","ppt"].includes(ext)) return "📋";
  if (["txt","md"].includes(ext)) return "📃";
  if (["js","ts","py","java","cpp","c","go"].includes(ext)) return "💾";
  if (ext === "folder" || type === "folder") return "📁";
  return "📄";
}

export function buildShareLink(roomId) {
  return `${window.location.origin}?room=${roomId}`;
}

// Reads all files from a directory handle recursively
export async function readDirectoryFiles(dirHandle, path = "") {
  const files = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      const file = await entry.getFile();
      files.push({ file, path: path ? `${path}/${entry.name}` : entry.name });
    } else if (entry.kind === "directory") {
      const subFiles = await readDirectoryFiles(entry, path ? `${path}/${entry.name}` : entry.name);
      files.push(...subFiles);
    }
  }
  return files;
}

// Zips all files using JSZip (loaded from CDN via script tag)
export async function zipFiles(folderName, fileEntries, onProgress) {
  // JSZip must be loaded via <script> in index.html
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("JSZip not loaded");

  const zip = new JSZip();
  const folder = zip.folder(folderName);

  for (const { file, path } of fileEntries) {
    const buffer = await file.arrayBuffer();
    folder.file(path, buffer);
  }

  const blob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
    (meta) => { if (onProgress) onProgress(Math.round(meta.percent)); }
  );

  return blob;
}