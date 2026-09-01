import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinRoom, recordSwipe, getRoomState } from "@/lib/rooms.functions";
import { getGuestId } from "@/lib/guest";
import { CitrusMark } from "@/components/citrus-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Heart, X, MapPin, Star, Users, PartyPopper, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export const Route = createFileRoute("/r/$roomId")({
  head: () => ({
    meta: [
      { title: "Room — Decido" },
      { name: "description", content: "Join the room and swipe on places together." },
    ],
  }),
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
  const queryClient = useQueryClient();
  const joinFn = useServerFn(joinRoom);
  const swipeFn = useServerFn(recordSwipe);
  const stateFn = useServerFn(getRoomState);
  const [guestId, setGuestId] = useState<string>("");
  const [joined, setJoined] = useState(false);
  const [matchDialog, setMatchDialog] = useState<Place | null>(null);
  const seenMatches = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = getGuestId();
    setGuestId(id);
    joinFn({ data: { roomId, guestId: id } })
      .catch(() => {})
      .finally(() => setJoined(true));
  }, [roomId, joinFn]);

  const stateQ = useQuery({
    queryKey: ["roomState", roomId, guestId],
    enabled: !!guestId && joined,
    refetchInterval: 3000,
    queryFn: () => stateFn({ data: { roomId, guestId } }),
  });

  const room = stateQ.data?.room;
  const places = (stateQ.data?.places ?? []) as Place[];
  const matches = stateQ.data?.matches ?? [];
  const participantCount = stateQ.data?.participantCount ?? 0;

  // Celebrate newly discovered matches
  useEffect(() => {
    for (const m of matches) {
      if (seenMatches.current.has(m.place_id)) continue;
      seenMatches.current.add(m.place_id);
      if (seenMatches.current.size === matches.length && matches.length > 0 && stateQ.isFetched) {
        const matched = places.find((p) => p.id === m.place_id);
        if (matched) {
          setMatchDialog(matched);
          confetti({ particleCount: 140, spread: 90, origin: { y: 0.3 } });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const swiped = useMemo(
    () => new Set(stateQ.data?.mySwipedPlaceIds ?? []),
    [stateQ.data?.mySwipedPlaceIds],
  );
  const deck = useMemo(() => places.filter((p) => !swiped.has(p.id)), [places, swiped]);


  async function handleSwipe(place: Place, direction: "left" | "right") {
    if (!guestId) return;
    // Optimistic update so cards fly away instantly
    queryClient.setQueryData<Set<string>>(
      ["mySwipes", roomId, guestId],
      (prev) => new Set([...(prev ?? []), place.id]),
    );
    try {
      await swipeFn({ data: { roomId, placeId: place.id, guestId, direction } });
    } catch {
      toast.error("Swipe failed");
      swipesQ.refetch();
    }
  }

  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator.share({ title: "Join my Decido room", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied — send it to your people");
    }
  }

  function copyCode() {
    if (!roomQ.data?.code) return;
    navigator.clipboard.writeText(roomQ.data.code);
    toast.success("Code copied");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper pb-16">
      {/* Ambient blobs behind glass */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-sunset opacity-60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-grove opacity-50 blur-3xl" />
      </div>

      <header className="glass sticky top-3 z-40 mx-auto mt-3 flex max-w-3xl items-center justify-between rounded-full px-4 py-2.5 md:mt-4">
        <Link to="/" className="focus:outline-none">
          <CitrusMark />
        </Link>
        <button
          onClick={share}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-citrus transition hover:scale-[1.02]"
        >
          <Share2 className="h-4 w-4" /> Share link
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
        {roomQ.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-[420px] w-full rounded-3xl" />
          </div>
        ) : !roomQ.data ? (
          <p className="text-center text-muted-foreground">Room not found.</p>
        ) : (
          <div className="space-y-6">
            {/* Room header */}
            <div className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-script text-xl text-accent">the room</p>
                  <h1 className="font-serif text-3xl">{roomQ.data.name || "Untitled"}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {participantsQ.data?.length ?? 0} in room
                    </span>
                    <button
                      onClick={copyCode}
                      className="inline-flex items-center gap-1.5 rounded-full bg-background/50 px-3 py-1 font-mono text-xs tracking-widest backdrop-blur hover:bg-accent hover:text-accent-foreground"
                    >
                      {roomQ.data.code} <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {(participantsQ.data?.length ?? 0) > 0 && (
                <div className="mt-4 flex -space-x-2">
                  {participantsQ.data!.map((p, i) => (
                    <div
                      key={p.user_id}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-sunset text-xs font-semibold text-citrus-cream"
                    >
                      {String.fromCharCode(65 + (i % 26))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deck */}
            {(placesQ.data?.length ?? 0) === 0 ? (
              <div className="glass rounded-3xl p-12 text-center">
                <p className="font-script text-3xl text-accent">loading…</p>
                <h3 className="mt-1 font-serif text-2xl">Fetching places</h3>
              </div>
            ) : deck.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center">
                <p className="font-script text-3xl text-accent">all done</p>
                <h3 className="mt-1 font-serif text-2xl">You've swiped everything</h3>
                <p className="mt-2 text-muted-foreground">Waiting on the rest of the crew…</p>
              </div>
            ) : (
              <div className="relative mx-auto flex h-[520px] max-w-md items-center justify-center">
                <AnimatePresence>
                  {deck.slice(0, 3).reverse().map((place, i) => {
                    const stackDepth = deck.slice(0, 3).length - 1 - i;
                    const isTop = stackDepth === 0;
                    return (
                      <SwipeCard
                        key={place.id}
                        place={place}
                        isTop={isTop}
                        depth={stackDepth}
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
                  {matchesQ.data.map((m) => {
                    const place = m.places as Place | null;
                    return (
                      <div key={m.place_id} className="glass flex gap-3 rounded-2xl p-3">
                        {place?.photo_url ? (
                          <img src={place.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-sunset" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-lg">{place?.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{place?.address}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!matchDialog} onOpenChange={(o) => !o && setMatchDialog(null)}>
        <DialogContent className="glass border-white/40">
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl">It's a match! 🎉</DialogTitle>
          </DialogHeader>
          {matchDialog && (
            <div className="space-y-3">
              {matchDialog.photo_url && (
                <img src={matchDialog.photo_url} alt="" className="w-full rounded-2xl" />
              )}
              <p className="font-serif text-2xl">{matchDialog.name}</p>
              <p className="text-sm text-muted-foreground">{matchDialog.address}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwipeCard({
  place,
  isTop,
  depth,
  onSwipe,
}: {
  place: Place;
  isTop: boolean;
  depth: number;
  onSwipe: (d: "left" | "right") => void;
}) {
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
            <img
              src={place.photo_url}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-sunset">
              <p className="font-script text-6xl text-citrus-cream">
                {place.name.slice(0, 1)}
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-citrus-cream">
            <p className="font-script text-xl">place</p>
            <h3 className="font-serif text-3xl leading-tight text-balance">{place.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-citrus-cream/90">
              {place.rating != null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-citrus-amber text-citrus-amber" />
                  {place.rating.toFixed(1)}
                </span>
              )}
              {place.price_level != null && <span>{"$".repeat(Math.max(1, place.price_level))}</span>}
              {place.address && (
                <span className="truncate">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {place.address}
                </span>
              )}
            </p>
          </div>
        </div>
        {isTop && (
          <div className="glass flex items-center justify-center gap-6 p-4">
            <button
              onClick={() => onSwipe("left")}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-background/60 shadow-card backdrop-blur transition hover:scale-110 hover:border-destructive hover:text-destructive"
              aria-label="Skip"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => onSwipe("right")}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-sunset text-citrus-cream shadow-citrus transition hover:scale-110"
              aria-label="Love"
            >
              <Heart className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
