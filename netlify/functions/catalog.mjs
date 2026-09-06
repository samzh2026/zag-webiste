import { readDb } from "./_shared/catalog-store.mjs";
import { filterPublicCatalog } from "./_shared/catalog-utils.mjs";
import { json, methodNotAllowed } from "./_shared/http.mjs";

export default async (request) => {
  if (request.method !== "GET") return methodNotAllowed();
  const url = new URL(request.url);
  return json(filterPublicCatalog(await readDb(), url.searchParams));
};

export const config = {
  path: "/api/catalog"
};
