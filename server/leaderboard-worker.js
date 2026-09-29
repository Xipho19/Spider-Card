/**
 * Cloudflare Worker endpoint for the classic-mode leaderboard.
 * Bind a D1 database as `DB` and run the schema in server/schema.sql.
 */
const ALLOWED_ORIGIN = "https://xipho19.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validMode(value) {
  const mode = Number(value);
  return mode === 1 || mode === 2 || mode === 4 ? mode : 0;
}

function validTime(value) {
  const time = Number(value);
  return Number.isFinite(time) && time >= 1 && time <= 86400 ? Math.ceil(time) : 0;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);
    if (url.pathname !== "/scores") return json({ error: "NOT_FOUND" }, 404);

    if (request.method === "GET") {
      const mode = validMode(url.searchParams.get("mode"));
      if (!mode) return json({ error: "INVALID_MODE" }, 400);
      const result = await env.DB.prepare(
        "SELECT player, time FROM scores WHERE mode = ? ORDER BY time ASC, updated_at ASC LIMIT 50"
      ).bind(mode).all();
      return json({ scores: result.results || [] });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const mode = validMode(body && body.mode);
      const time = validTime(body && body.time);
      const player = String((body && body.player) || "匿名玩家").trim().slice(0, 32) || "匿名玩家";
      if (!mode || !time) return json({ error: "INVALID_SCORE" }, 400);
      await env.DB.prepare(
        "INSERT INTO scores (player, mode, time, updated_at) VALUES (?, ?, ?, datetime('now')) " +
        "ON CONFLICT(player, mode) DO UPDATE SET time = MIN(scores.time, excluded.time), updated_at = datetime('now')"
      ).bind(player, mode, time).run();
      return json({ ok: true });
    }

    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  },
};
