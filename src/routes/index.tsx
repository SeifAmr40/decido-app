import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, MapPin, Search, Sparkles, Users } from "lucide-react";
import { CitrusMark } from "@/components/citrus-mark";
import { createRoom } from "@/lib/rooms.functions";
import { getGuestId } from "@/lib/guest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Decido — Swipe on places with friends, no sign-in" },
      {
        name: "description",
        content:
          "Type a place, share a link, swipe together. Decido helps friends pick where to eat, drink, or wander — instantly, no accounts.",
      },
      { property: "og:title", content: "Decido — Swipe on places with friends" },
      {
        property: "og:description",
        content: "Type a place, share a link, swipe together. No sign-in.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const router = useRouter();
  const create = useServerFn(createRoom);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const guestId = getGuestId();
      const r = await create({ data: { query: query.trim(), hostGuestId: guestId } });
      toast.success(`Room ready · ${r.inserted} places`);
      router.navigate({ to: "/r/$roomId", params: { roomId: r.roomId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      {/* Floating citrus blobs — depth for the glass to sit on */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-20 h-96 w-96 rounded-full bg-sunset opacity-70 blur-3xl" />
        <div className="absolute top-1/2 -right-24 h-[28rem] w-[28rem] rounded-full bg-grove opacity-60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sunset opacity-40 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <CitrusMark />
        <a
          href="#how"
          className="glass hidden rounded-full px-5 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-block"
        >
          How it works
        </a>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pt-6 pb-16 md:pt-16 md:pb-24">
        <div className="text-center">
          <p className="font-script text-3xl text-accent">where to?</p>
          <h1 className="mt-2 font-serif text-5xl leading-[1.02] text-foreground md:text-7xl text-balance">
            Type a place.<br />
            <span className="text-primary italic">Swipe</span> with your people.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            No sign-in. No apps. Search Google Maps for a spot or vibe, share the link,
            and decide together in seconds.
          </p>
        </div>

        {/* The glass search bar */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onSubmit={handleCreate}
          className="glass mx-auto mt-10 flex max-w-2xl items-center gap-2 rounded-full p-2 shadow-citrus"
        >
          <div className="flex flex-1 items-center gap-3 px-4">
            <Search className="h-5 w-5 shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. cozy ramen in Williamsburg"
              className="w-full bg-transparent py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
              aria-label="Search Google Maps for a place"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-citrus transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Cooking…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Create room
              </>
            )}
          </button>
        </motion.form>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Powered by Google Maps — we'll pull real places matching your search.
        </p>

        {/* Chip suggestions */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[
            "sushi in Soho",
            "rooftop bars in Athens",
            "specialty coffee near me",
            "vegan brunch Berlin",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="glass rounded-full px-3.5 py-1.5 text-xs text-foreground/70 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Search, title: "Search a place", body: "Type a neighborhood, cuisine, or vibe. We pull real spots from Google Maps." },
            { icon: Users, title: "Share the link", body: "Send the room link to friends. No sign-up, no accounts, no friction." },
            { icon: MapPin, title: "Swipe & match", body: "Left to skip, right to love. When everyone matches — you have a plan." },
          ].map((step, i) => (
            <div key={i} className="glass rounded-3xl p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sunset text-citrus-cream shadow-citrus">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-serif text-2xl">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        Made with <span className="text-primary">♥</span> · Decido, 2026 ·{" "}
        <Link to="/" className="underline-offset-2 hover:underline">
          decido.app
        </Link>
      </footer>
    </div>
  );
}
