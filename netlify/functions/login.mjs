import { adminPassword, adminUsername, createToken } from "./_shared/auth.mjs";
import { json, methodNotAllowed, parseJson } from "./_shared/http.mjs";

export default async (request) => {
  if (request.method !== "POST") return methodNotAllowed();
  const body = await parseJson(request);
  if (body.username !== adminUsername() || body.password !== adminPassword()) {
    return json({ error: "Username or password is incorrect" }, 401);
  }
  return json({ token: createToken(body.username) });
};

export const config = {
  path: "/api/login"
};
