// Edge Function: staff-admin
// Lets a signed-in ADMINISTRATOR add staff, change roles/PINs, and (de)activate accounts from the app.
// The secret key is only ever used here, on the server. It is provided automatically by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, (Deno.env.get("SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in." }, 401);
    const { data: me } = await admin.from("staff_profiles").select("role,active").eq("id", u.user.id).single();
    if (!me || !me.active || me.role !== "admin") return json({ error: "Administrators only." }, 403);

    const b = await req.json();
    const okPin = (p: unknown) => /^\d{6,8}$/.test(String(p || ""));
    const okRole = (r: unknown) => r === "admin" || r === "cashier";

    if (b.action === "create") {
      const name = String(b.name || "").trim();
      if (!name) return json({ error: "Enter a name." }, 400);
      if (!okPin(b.pin)) return json({ error: "PIN must be 6 to 8 digits." }, 400);
      if (!okRole(b.role)) return json({ error: "Choose a role." }, 400);
      const email = `s-${crypto.randomUUID().slice(0, 12)}@staff.g7.local`;
      const { data, error } = await admin.auth.admin.createUser({ email, password: String(b.pin), email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: e2 } = await admin.from("staff_profiles").insert({ id: data.user!.id, name, role: b.role, login_email: email });
      if (e2) { await admin.auth.admin.deleteUser(data.user!.id); return json({ error: e2.message.includes("staff_name_uq") ? "A staff member with this name already exists." : e2.message }, 400); }
      return json({ ok: true, id: data.user!.id, email });
    }

    if (b.action === "update") {
      const id = String(b.id);
      const { data: target } = await admin.from("staff_profiles").select("*").eq("id", id).single();
      if (!target) return json({ error: "Staff not found." }, 404);
      const patch: Record<string, unknown> = {};
      if (b.name !== undefined) { const n = String(b.name).trim(); if (!n) return json({ error: "Enter a name." }, 400); patch.name = n; }
      if (b.role !== undefined) { if (!okRole(b.role)) return json({ error: "Choose a role." }, 400); patch.role = b.role; }
      if (b.active !== undefined) patch.active = !!b.active;
      // keep at least one active administrator, and never lock yourself out
      const losesAdmin = target.role === "admin" && target.active && ((patch.role && patch.role !== "admin") || patch.active === false);
      if (losesAdmin) {
        const { count } = await admin.from("staff_profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
        if ((count ?? 0) <= 1) return json({ error: "There must be at least one active administrator." }, 400);
      }
      if (id === u.user.id && patch.active === false) return json({ error: "You cannot deactivate your own account." }, 400);
      if (b.pin !== undefined && b.pin !== "") {
        if (!okPin(b.pin)) return json({ error: "PIN must be 6 to 8 digits." }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password: String(b.pin) });
        if (error) return json({ error: error.message }, 400);
      }
      if (patch.active === false) await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      if (patch.active === true) await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
      if (Object.keys(patch).length) {
        const { error } = await admin.from("staff_profiles").update(patch).eq("id", id);
        if (error) return json({ error: error.message.includes("staff_name_uq") ? "A staff member with this name already exists." : error.message }, 400);
      }
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
