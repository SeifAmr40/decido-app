import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { seedRoomPlaces } from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Heart, X, MapPin, Star, Users, PartyPopper, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/rooms/$roomId")({
  head: () => ({ meta: [{ title: "Room — Citrus" }] }),
  component: RoomPage,
});

type Place = {
  id: string;
  name: string;
  address: string | null;
  photo_url: string | null;
  rating: number | null;
  price_level: number | null;
  category: string | null;
  google_place_id: string;
  latitude: number | null;
  longitude: number | null;
};

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const seedFn = useServerFn(seedRoomPlaces);
  const [seeding, setSeeding] = useState(false);
  const [matchDialog, setMatchDialog] = useState<Place | null>(null);

  const roomQ = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (error) throw error;
      return data;
    },
  });

  const participantsQ = useQuery({
    queryKey: ["participants", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("user_id, joined_at, profiles(display_name, avatar_url)")
        .eq("room_id", roomId);
      if (error) throw error;
      return data;
    },
  });

  const placesQ = useQuery({
    queryKey: ["places", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.from("places").select("*").eq("room_id", roomId).order("created_at");
      if (error) throw error;
      return data as Place[];
    },
  });

  const swipesQ = useQuery({
    queryKey: ["mySwipes", roomId, user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swipes")
        .select("place_id")
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      if (error) throw error;
      return new Set(data?.map((s) => s.place_id) ?? []);
    },
  });

  const matchesQ = useQuery({
    queryKey: ["matches", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("place_id, created_at, places(*)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, () => participantsQ.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "places", filter: `room_id=eq.${roomId}` }, () => placesQ.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` }, (payload) => {
        matchesQ.refetch();
        placesQ.refetch();
        const placeId = (payload.new as any)?.place_id;
        const matched = placesQ.data?.find((p) => p.id === placeId);
        if (matched) {
          setMatchDialog(matched);
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 } });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => roomQ.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const swiped = swipesQ.data ?? new Set<string>();
  const deck = useMemo(() => (placesQ.data ?? []).filter((p) => !swiped.has(p.id)), [placesQ.data, swiped]);

  async function handleSeed() {
    if (!roomQ.data) return;
    setSeeding(true);
    try {
      const r = await seedFn({
        data: {
          roomId,
          category: roomQ.data.category ?? "restaurant",
          latitude: roomQ.data.latitude ?? 40.7128,
          longitude: roomQ.data.longitude ?? -74.006,
          radius: roomQ.data.radius_meters ?? 2000,
        },
      });
      toast.success(`Loaded ${r.inserted} places`);
      placesQ.refetch();
      roomQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load places");
    } finally {
      setSeeding(false);
    }
  }

  async function handleSwipe(place: Place, direction: "left" | "right") {
    const { error } = await supabase.from("swipes").insert({
      room_id: roomId,
      place_id: place.id,
      user_id: user.id,
      direction,
    });
    if (error) toast.error("Swipe failed");
    else swipesQ.refetch();
  }

  function copyCode() {
    if (!roomQ.data?.code) return;
    navigator.clipboard.writeText(roomQ.data.code);
    toast.success("Code copied");
  }

  if (roomQ.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full rounded-3xl" /><Skeleton className="h-[420px] w-full rounded-3xl" /></div>;
  }
  if (!roomQ.data) return <p>Room not found.</p>;

  const isHost = roomQ.data.host_id === user.id;
  const hasPlaces = (placesQ.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-script text-xl text-accent">the room</p>
            <h1 className="font-serif text-3xl">{roomQ.data.name || "Untitled"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{participantsQ.data?.length ?? 0} in room</span>
              <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-xs tracking-widest hover:bg-accent hover:text-accent-foreground">
                {roomQ.data.code} <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          {isHost && !hasPlaces && (
            <Button onClick={handleSeed} disabled={seeding} className="rounded-full shadow-citrus">
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Start room
            </Button>
          )}
        </div>

        {participantsQ.data && participantsQ.data.length > 0 && (
          <div className="mt-4 flex -space-x-2">
            {participantsQ.data.map((p: any) => (
              <div key={p.user_id} className="h-9 w-9 rounded-full border-2 border-background bg-sunset flex items-center justify-center text-xs font-semibold text-citrus-cream">
                {(p.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deck */}
      {!hasPlaces ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <p className="font-script text-3xl text-accent">waiting…</p>
          <h3 className="mt-1 font-serif text-2xl">
            {isHost ? "Press \u2018Start room\u2019 to load places" : "The host is picking places"}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {isHost ? "We'll pull places nearby from Google Maps." : "You'll be able to swipe once it starts."}
          </p>
        </div>
      ) : deck.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <p className="font-script text-3xl text-accent">all done</p>
          <h3 className="mt-1 font-serif text-2xl">You've swiped everything</h3>
          <p className="mt-2 text-muted-foreground">Waiting for the rest of the crew…</p>
        </div>
      ) : (
        <div className="relative mx-auto flex h-[520px] max-w-md items-center justify-center">
          <AnimatePresence>
            {deck.slice(0, 3).reverse().map((place, i) => {
              const isTop = i === deck.slice(0, 3).length - 1;
              return (
                <SwipeCard
                  key={place.id}
                  place={place}
                  isTop={isTop}
                  depth={deck.slice(0, 3).length - 1 - i}
                  onSwipe={(dir) => handleSwipe(place, dir)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Matches */}
      {matchesQ.data && matchesQ.data.length > 0 && (
        <div>
          <h2 className="font-serif text-2xl">
            <PartyPopper className="inline h-5 w-5 text-primary" /> Matches
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {matchesQ.data.map((m: any) => (
              <div key={m.place_id} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
                {m.places?.photo_url ? (
                  <img src={m.places.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-sunset" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg truncate">{m.places?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.places?.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match dialog */}
      <Dialog open={!!matchDialog} onOpenChange={(o) => !o && setMatchDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-3xl">It's a match! 🎉</DialogTitle></DialogHeader>
          {matchDialog && (
            <div className="space-y-3">
              {matchDialog.photo_url && <img src={matchDialog.photo_url} alt="" className="w-full rounded-2xl" />}
              <p className="font-serif text-2xl">{matchDialog.name}</p>
              <p className="text-sm text-muted-foreground">{matchDialog.address}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwipeCard({ place, isTop, depth, onSwipe }: { place: Place; isTop: boolean; depth: number; onSwipe: (d: "left" | "right") => void }) {
  return (
    <motion.div
      className="absolute inset-0 select-none"
      style={{ zIndex: 10 - depth }}
      initial={{ scale: 1 - depth * 0.05, y: depth * 8, opacity: 1 }}
      animate={{ scale: 1 - depth * 0.05, y: depth * 8, opacity: 1 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onSwipe("right");
        else if (info.offset.x < -120) onSwipe("left");
      }}
      exit={{ x: 0, opacity: 0, transition: { duration: 0.2 } }}
      whileTap={{ cursor: "grabbing" }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-citrus">
        <div className="relative flex-1 bg-grove">
          {place.photo_url ? (
            <img src={place.photo_url} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center bg-sunset">
              <p className="font-script text-5xl text-citrus-cream">{place.name.slice(0, 1)}</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-citrus-cream">
            <p className="font-script text-xl">place</p>
            <h3 className="font-serif text-3xl leading-tight text-balance">{place.name}</h3>
            <p className="mt-1 flex items-center gap-3 text-sm text-citrus-cream/90">
              {place.rating != null && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-citrus-amber text-citrus-amber" />{place.rating.toFixed(1)}</span>}
              {place.price_level != null && <span>{"$".repeat(Math.max(1, place.price_level))}</span>}
              {place.address && <span className="truncate"><MapPin className="mr-1 inline h-3 w-3" />{place.address}</span>}
            </p>
          </div>
        </div>
        {isTop && (
          <div className="flex items-center justify-center gap-6 bg-card p-4">
            <button onClick={() => onSwipe("left")} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background shadow-card transition hover:scale-110 hover:border-destructive hover:text-destructive">
              <X className="h-6 w-6" />
            </button>
            <button onClick={() => onSwipe("right")} className="flex h-14 w-14 items-center justify-center rounded-full bg-sunset text-citrus-cream shadow-citrus transition hover:scale-110">
              <Heart className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
