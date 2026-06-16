"use strict";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { parts.push("<ul>"); inList = true; }
      const body = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      parts.push(`<li>${body}</li>`);
    } else if (!line.trim()) {
      if (inList) { parts.push("</ul>"); inList = false; }
    } else {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) parts.push("</ul>");
  return parts.join("\n");
}

function auditReportToHtml(report) {
  const body = markdownToHtml(report.markdown || "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CogniMesh Audit Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; color: #111; }
    h1 { border-bottom: 2px solid #2563eb; padding-bottom: 0.5rem; }
    h2 { color: #1e40af; margin-top: 1.5rem; }
    ul { line-height: 1.6; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
${body}
<p><em>Generated ${escapeHtml(report.generatedAt || "")} · CogniMesh</em></p>
</body>
</html>`;
}

module.exports = { auditReportToHtml, markdownToHtml };
