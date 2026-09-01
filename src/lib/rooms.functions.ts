import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function code6() {
  // Room join code — short + shareable
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function placesTextSearch(query: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps connector not configured");
  }

  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.photos,places.primaryType",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
      // Bias results to Egypt
      regionCode: "EG",
      languageCode: "en",
      locationBias: {
        circle: {
          center: { latitude: 26.8206, longitude: 30.8025 },
          radius: 50000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Places API error", res.status, body);
    throw new Error(`Places search failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as {
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
}

const priceLevelMap: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// ── createRoom ────────────────────────────────────────────────────────────
export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        hostGuestId: z.string().uuid(),
        hostName: z.string().trim().max(40).optional(),
        roomName: z.string().trim().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await getAdmin();

    const payload = await placesTextSearch(data.query);
    const first = payload.places?.[0];
    if (!payload.places || payload.places.length === 0) {
      throw new Error("No places matched that search. Try something more specific.");
    }

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({
        code: code6(),
        host_id: data.hostGuestId,
        name: data.roomName || data.query.slice(0, 60),
        category: first?.primaryType ?? "restaurant",
        latitude: first?.location?.latitude ?? null,
        longitude: first?.location?.longitude ?? null,
        radius_meters: 2000,
        status: "active",
      })
      .select()
      .single();
    if (roomErr) throw roomErr;

    const rows = payload.places.map((p) => {
      const photoName = p.photos?.[0]?.name; // "places/PID/photos/PREF"
      const photoUrl = photoName ? `/api/public/place-photo/${photoName}?w=800` : null;
      return {
        room_id: room.id,
        google_place_id: p.id,
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress ?? null,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        rating: p.rating ?? null,
        price_level: p.priceLevel ? priceLevelMap[p.priceLevel] ?? null : null,
        photo_url: photoUrl,
        category: p.primaryType ?? null,
      };
    });

    const { error: insErr } = await supabase
      .from("places")
      .upsert(rows, { onConflict: "room_id,google_place_id", ignoreDuplicates: true });
    if (insErr) throw insErr;

    await supabase.from("participants").insert({ room_id: room.id, user_id: data.hostGuestId });

    return { roomId: room.id, code: room.code, inserted: rows.length };
  });

// ── joinRoom ──────────────────────────────────────────────────────────────
export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ roomId: z.string().uuid(), guestId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await getAdmin();
    // Ignore duplicate participant errors — user rejoining.
    const { error } = await supabase
      .from("participants")
      .upsert({ room_id: data.roomId, user_id: data.guestId }, { onConflict: "room_id,user_id", ignoreDuplicates: true });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

// ── recordSwipe ───────────────────────────────────────────────────────────
export const recordSwipe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        placeId: z.string().uuid(),
        guestId: z.string().uuid(),
        direction: z.enum(["left", "right"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await getAdmin();
    const { error } = await supabase.from("swipes").insert({
      room_id: data.roomId,
      place_id: data.placeId,
      user_id: data.guestId,
      direction: data.direction,
    });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

// ── getRoomState ──────────────────────────────────────────────────────────
// All room reads go through here: the client cannot read these tables directly
// (RLS denies it). Access requires being a participant of the room.
export const getRoomState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ roomId: z.string().uuid(), guestId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await getAdmin();

    const { data: member } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", data.roomId)
      .eq("user_id", data.guestId)
      .maybeSingle();
    if (!member) throw new Error("Not a member of this room");

    const [roomRes, participantsRes, placesRes, swipesRes, matchesRes] = await Promise.all([
      supabase.from("rooms").select("id, code, name, category, status, created_at").eq("id", data.roomId).maybeSingle(),
      supabase.from("participants").select("user_id, joined_at").eq("room_id", data.roomId),
      supabase.from("places").select("id, name, address, photo_url, rating, price_level, category, google_place_id, latitude, longitude").eq("room_id", data.roomId).order("created_at"),
      supabase.from("swipes").select("place_id").eq("room_id", data.roomId).eq("user_id", data.guestId),
      supabase.from("matches").select("place_id, created_at, places(id, name, address, photo_url, rating, price_level, category, google_place_id, latitude, longitude)").eq("room_id", data.roomId).order("created_at", { ascending: false }),
    ]);

    if (!roomRes.data) throw new Error("Room not found");

    return {
      room: roomRes.data,
      // Only anonymous ordinal info is needed by the UI, not raw guest identifiers.
      participantCount: participantsRes.data?.length ?? 0,
      places: placesRes.data ?? [],
      mySwipedPlaceIds: (swipesRes.data ?? []).map((s) => s.place_id),
      matches: matchesRes.data ?? [],
    };
  });
