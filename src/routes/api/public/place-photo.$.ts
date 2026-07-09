import { createFileRoute } from "@tanstack/react-router";

// Proxies Google Places photo bytes through our origin so <img> tags can render them
// without exposing gateway auth headers to the browser.
export const Route = createFileRoute("/api/public/place-photo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
        if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
          return new Response("Maps not configured", { status: 500 });
        }
        const splat = (params as { _splat?: string })._splat ?? "";
        // splat looks like "places/PLACE_ID/photos/PHOTO_REF"
        if (!splat.startsWith("places/")) return new Response("Bad path", { status: 400 });

        const url = new URL(request.url);
        const maxWidth = url.searchParams.get("w") ?? "800";
        const target = `https://connector-gateway.lovable.dev/google_maps/places/v1/${splat}/media?maxWidthPx=${encodeURIComponent(maxWidth)}`;

        const res = await fetch(target, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          },
          redirect: "follow",
        });
        if (!res.ok) return new Response("Photo unavailable", { status: res.status });
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        return new Response(res.body, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});
