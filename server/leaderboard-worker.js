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

function validCategory(value) {
  return value === "classic" || value === "endless" ? value : "";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);
    if (url.pathname !== "/scores") return json({ error: "NOT_FOUND" }, 404);

    if (request.method === "GET") {
      const category = validCategory(url.searchParams.get("category"));
      const mode = validMode(url.searchParams.get("mode"));
      if (!category || !mode) return json({ error: "INVALID_CATEGORY_OR_MODE" }, 400);
      const result = await env.DB.prepare(
        category === "endless"
          ? "SELECT player, streak FROM scores WHERE category = ? AND mode = ? ORDER BY streak DESC, updated_at ASC LIMIT 50"
          : "SELECT player, time FROM scores WHERE category = ? AND mode = ? ORDER BY time ASC, updated_at ASC LIMIT 50"
      ).bind(category, mode).all();
      return json({ scores: result.results || [] });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const category = validCategory(body && body.category);
      const mode = validMode(body && body.mode);
      const time = validTime(body && body.time);
      const streak = Number.isFinite(Number(body && body.streak)) && Number(body.streak) >= 1 ? Math.floor(Number(body.streak)) : 0;
      const player = String((body && body.player) || "匿名玩家").trim().slice(0, 32) || "匿名玩家";
      if (!category || !mode || (category === "classic" ? !time : !streak)) return json({ error: "INVALID_SCORE" }, 400);
      await env.DB.prepare(
        "INSERT INTO scores (player, category, mode, time, streak, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) " +
        "ON CONFLICT(player, category, mode) DO UPDATE SET time = CASE WHEN excluded.category = 'classic' THEN MIN(scores.time, excluded.time) ELSE scores.time END, streak = CASE WHEN excluded.category = 'endless' THEN MAX(scores.streak, excluded.streak) ELSE scores.streak END, updated_at = datetime('now')"
      ).bind(player, category, mode, category === "classic" ? time : 0, category === "endless" ? streak : 0).run();
      return json({ ok: true });
    }

    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  },
};
