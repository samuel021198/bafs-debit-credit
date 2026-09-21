const { list, put } = require("@vercel/blob");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function rows() {
  const { blobs } = await list({ prefix: "board.json" });
  const hit = blobs
    .filter((b) => b.pathname === "board.json")
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  if (!hit) return [];
  const r = await fetch(hit.url, { cache: "no-store" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") return res.status(200).json(await rows());
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const name = String(body.name || "無名").replace(/[<>]/g, "").trim().slice(0, 16) || "無名";
      const score = Math.min(999, Math.max(0, Math.floor(Number(body.score) || 0)));
      const all = await rows();
      all.push({ name, score, t: Date.now() });
      all.sort((a, b) => b.score - a.score || a.t - b.t);
      const top = all.slice(0, 50);
      // ponytail: GET-merge-PUT race if two submits overlap; unique writes if that bites
      await put("board.json", JSON.stringify(top), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return res.status(200).json(top.slice(0, 20));
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
