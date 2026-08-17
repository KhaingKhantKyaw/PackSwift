import sanitizeHtml from "sanitize-html";

export function cleanText(value, maximumLength) {
  return sanitizeHtml(String(value ?? ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

export function cleanMultilineText(value, maximumLength) {
  return sanitizeHtml(String(value ?? ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximumLength);
}
