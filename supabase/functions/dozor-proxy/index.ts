import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

async function dozorFetch(path: string) {
  const base = env("DOZOR_BASE_URL").replace(/\/+$/, "");
  const user = env("DOZOR_USER");
  const pass = env("DOZOR_PASS");
  const url = `${base}${path}`;

  console.log(`Proxying: ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Dozor API error [${res.status}]: ${body}`);
    throw new Error(`Dozor API returned ${res.status}`);
  }

  return res.json();
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/dozor-proxy/, "");

    // GET /groups
    if (path === "/groups") {
      const data = await dozorFetch("/groups");
      return jsonResponse(data);
    }

    // GET /vehicles?group=CODE
    if (path === "/vehicles") {
      const group = url.searchParams.get("group");
      if (!group) return errorResponse("Missing ?group= parameter", 400);
      const data = await dozorFetch(`/vehicles/group/${encodeURIComponent(group)}`);
      return jsonResponse(data);
    }

    // GET /vehicle/:code
    const vehicleMatch = path.match(/^\/vehicle\/([^/]+)$/);
    if (vehicleMatch) {
      const code = vehicleMatch[1];
      const data = await dozorFetch(`/vehicle/${encodeURIComponent(code)}`);
      return jsonResponse(data);
    }

    // GET /history?codes=A,B&from=...&to=...
    if (path === "/history") {
      const codes = url.searchParams.get("codes");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!codes) return errorResponse("Missing ?codes= parameter", 400);
      let apiPath = `/vehicles/history/${encodeURIComponent(codes)}`;
      const qs: string[] = [];
      if (from) qs.push(`from=${encodeURIComponent(from)}`);
      if (to) qs.push(`to=${encodeURIComponent(to)}`);
      if (qs.length) apiPath += `?${qs.join("&")}`;
      const data = await dozorFetch(apiPath);
      return jsonResponse(data);
    }

    // GET /trips?code=...&from=...&to=...
    if (path === "/trips") {
      const code = url.searchParams.get("code");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!code) return errorResponse("Missing ?code= parameter", 400);
      let apiPath = `/vehicle/${encodeURIComponent(code)}/trips`;
      const qs: string[] = [];
      if (from) qs.push(`from=${encodeURIComponent(from)}`);
      if (to) qs.push(`to=${encodeURIComponent(to)}`);
      if (qs.length) apiPath += `?${qs.join("&")}`;
      const data = await dozorFetch(apiPath);
      return jsonResponse(data);
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    console.error("dozor-proxy error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500);
  }
});
