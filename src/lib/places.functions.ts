import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const seedInput = z.object({
  roomId: z.string().uuid(),
  category: z.string().min(1).max(80),
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number().int().min(200).max(50000).default(2000),
});

/**
 * Host action: query Google Places (New) for the room's category + location
 * and seed the room's `places` table with the top ~20 results.
 */
export const seedRoomPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => seedInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector not configured");
    }

    // Verify caller is the host of this room
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, host_id")
      .eq("id", data.roomId)
      .single();
    if (roomErr || !room) throw new Error("Room not found");
    if (room.host_id !== userId) throw new Error("Only the host can start a room");

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.photos,places.primaryType,places.types",
      },
      body: JSON.stringify({
        includedTypes: [data.category],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: data.latitude, longitude: data.longitude },
            radius: data.radius,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Places API error", res.status, body);
      throw new Error(`Places API failed [${res.status}]: ${body.slice(0, 200)}`);
    }
    const payload = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        rating?: number;
        priceLevel?: string;
        photos?: Array<{ name: string }>;
        primaryType?: string;
      }>;
    };

    const rows = (payload.places ?? []).map((p) => {
      const photoName = p.photos?.[0]?.name;
      const photoUrl = photoName
        ? `${GATEWAY_URL}/places/v1/${photoName}/media?maxWidthPx=800`
        : null;
      const priceLevelMap: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };
      return {
        room_id: data.roomId,
        google_place_id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress ?? null,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        rating: p.rating ?? null,
        price_level: p.priceLevel ? priceLevelMap[p.priceLevel] ?? null : null,
        photo_url: photoUrl,
        category: p.primaryType ?? data.category,
      };
    });

    if (rows.length === 0) {
      throw new Error("No places found for that category and area — try a wider radius");
    }

    const { error: insErr } = await supabase
      .from("places")
      .upsert(rows, { onConflict: "room_id,google_place_id", ignoreDuplicates: true });
    if (insErr) throw insErr;

    await supabase.from("rooms").update({ status: "active" }).eq("id", data.roomId);
    return { inserted: rows.length };
  });
