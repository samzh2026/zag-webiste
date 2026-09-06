export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed" }, 405);
}

export async function parseJson(request) {
  const raw = await request.text();
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}
