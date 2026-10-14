/**
 * AppZed workspace-admin (managed=true). HR events become onboarding and
 * offboarding checklists with per-item completion. Schema self-initializes.
 * Bindings: AI, DB (d1).
 */
const SCHEMA = "CREATE TABLE IF NOT EXISTS checklists (id TEXT PRIMARY KEY, person TEXT, kind TEXT, items TEXT, created_at TEXT DEFAULT (datetime('now')))";
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const BASE_ITEMS = {
  onboarding: ["Create email account", "Provision SaaS apps", "Ship equipment", "Schedule orientation", "Grant repo access"],
  offboarding: ["Disable email account", "Revoke SaaS access", "Recover equipment", "Rotate shared secrets", "Archive files"],
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, solution: "workspace-admin" });
    }
    if (request.method === "POST" && url.pathname === "/events") {
      const body = await request.json().catch(() => null);
      if (!body || !body.person || (body.kind !== "onboarding" && body.kind !== "offboarding")) {
        return bad('person and kind ("onboarding" or "offboarding") are required.');
      }
      const items = BASE_ITEMS[body.kind].map((label) => ({ label, done: false }));
      if (body.role) {
        try {
          const out = await env.AI.run(MODEL, {
            messages: [
              { role: "system", content: "Add up to 3 role-specific onboarding/offboarding checklist items as a JSON array of strings. Reply with ONLY the array." },
              { role: "user", content: `${body.kind} checklist additions for role: ${String(body.role).slice(0, 200)}` },
            ],
            max_tokens: 128,
          });
          const extra = JSON.parse(String(out.response || "[]").match(/\[[\s\S]*\]/)?.[0] || "[]");
          for (const label of extra.slice(0, 3)) {
            if (typeof label === "string" && label.trim()) items.push({ label: label.trim().slice(0, 200), done: false });
          }
        } catch {
          // Role-specific items are a bonus; the base checklist stands alone.
        }
      }
      const id = crypto.randomUUID();
      await env.DB.exec(SCHEMA);
      await env.DB.prepare(
        "INSERT INTO checklists (id, person, kind, items) VALUES (?, ?, ?, ?)"
      ).bind(id, body.person, body.kind, JSON.stringify(items)).run();
      return Response.json({ id, person: body.person, kind: body.kind, items }, { status: 201 });
    }
    if (request.method === "GET" && url.pathname === "/checklists") {
      await env.DB.exec(SCHEMA);
      const rows = await env.DB.prepare(
        "SELECT * FROM checklists ORDER BY created_at DESC LIMIT 50"
      ).all();
      const lists = (rows.results || []).map((r) => ({ ...r, items: JSON.parse(r.items) }));
      return Response.json({ checklists: lists });
    }
    const check = url.pathname.match(/^\/check\/([^/]+)\/(\d+)$/);
    if (request.method === "POST" && check) {
      const row = await env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(check[1]).first();
      if (!row) return Response.json({ error: "not found" }, { status: 404 });
      const items = JSON.parse(row.items);
      const index = Number(check[2]);
      if (!items[index]) return bad("item index out of range.");
      items[index].done = true;
      await env.DB.prepare("UPDATE checklists SET items = ? WHERE id = ?").bind(JSON.stringify(items), check[1]).run();
      return Response.json({ id: check[1], items });
    }
    return new Response("Not found", { status: 404 });
  },
};

function bad(message) {
  return Response.json({ error: message }, { status: 400 });
}
