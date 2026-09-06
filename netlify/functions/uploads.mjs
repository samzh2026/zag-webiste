import { getImage } from "./_shared/catalog-store.mjs";
import { text } from "./_shared/http.mjs";

export default async (request, context) => {
  if (request.method !== "GET") return text("Method not allowed", 405);
  const image = await getImage(context.params?.fileName);
  if (!image) return text("Not found", 404);

  return new Response(image.data, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
};

export const config = {
  path: "/uploads/:fileName"
};
