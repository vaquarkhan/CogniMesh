/**
 * Dependency-free store-only ZIP builder + browser download.
 * Implements CRC32 + local file headers + central directory + EOCD.
 */

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(str) {
  return new TextEncoder().encode(str);
}

function u16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
function u32(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

/**
 * Build a ZIP blob from a map of { filename: textContent }.
 * @param {Record<string, string>} files
 * @returns {Blob}
 */
export function buildZipBlob(files) {
  const entries = Object.entries(files);
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = toBytes(name);
    const dataBytes = toBytes(content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // signature
      0x14, 0x00,             // version needed (2.0)
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression (store)
      0x00, 0x00,             // mod time
      0x00, 0x00,             // mod date
      ...u32(crc),
      ...u32(size),           // compressed
      ...u32(size),           // uncompressed
      ...u16(nameBytes.length),
      ...u16(0),              // extra field length
      ...nameBytes,
      ...dataBytes,
    ]);
    localHeaders.push(local);

    // Central directory header
    const central = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // signature
      0x14, 0x00,             // version made by
      0x14, 0x00,             // version needed
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression
      0x00, 0x00,             // mod time
      0x00, 0x00,             // mod date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),              // extra
      ...u16(0),              // comment
      ...u16(0),              // disk start
      ...u16(0),              // internal attrs
      ...u32(0),              // external attrs
      ...u32(offset),         // local header offset
      ...nameBytes,
    ]);
    centralHeaders.push(central);
    offset += local.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, h) => s + h.length, 0);

  // End of central directory
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0),                // disk number
    ...u16(0),                // disk with CD
    ...u16(entries.length),   // entries on disk
    ...u16(entries.length),   // total entries
    ...u32(centralDirSize),
    ...u32(centralDirOffset),
    ...u16(0),                // comment length
  ]);

  return new Blob([...localHeaders, ...centralHeaders, eocd], { type: "application/zip" });
}

/**
 * Download a ZIP file in the browser.
 * @param {string} filename - e.g. "my-agent-agentcore.zip"
 * @param {Record<string, string>} files - { "agent.py": "...", ... }
 */
export function downloadZip(filename, files) {
  const blob = buildZipBlob(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
