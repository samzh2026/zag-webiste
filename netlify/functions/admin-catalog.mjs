import { requireAuth } from "./_shared/auth.mjs";
import { readDb } from "./_shared/catalog-store.mjs";
import { publicDb } from "./_shared/catalog-utils.mjs";
import { json, methodNotAllowed } from "./_shared/http.mjs";

export default async (request) => {
  if (request.method !== "GET") return methodNotAllowed();
  const authError = requireAuth(request);
  if (authError) return authError;
  return json(publicDb(await readDb()));
};

export const config = {
  path: "/api/admin/catalog"
};
