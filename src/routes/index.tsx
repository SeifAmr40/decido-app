import { createFileRoute, Link } from "@tanstack/react-router";
import { CitrusMark } from "@/components/citrus-mark";
import { ArrowRight, Users, MapPin, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Decido — Swipe on places with friends" },
      {
        name: "description",
        content:
          "Create a room, invite friends, and swipe on real places nearby until you all match. Warm, fast, delightful.",
      },
      { property: "og:title", content: "Decido — Swipe on places with friends" },
      {
        property: "og:description",
        content: "Decide where to go, together. Real-time swiping on real places.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <CitrusMark />
        <Link
          to="/auth"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-citrus transition-transform hover:scale-[1.02]"
        >
          Sign in
        </Link>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-10 pb-24 md:pt-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-script text-3xl text-accent">where to?</p>
            <h1 className="mt-2 font-serif text-5xl leading-[1.05] text-foreground md:text-7xl text-balance">
              Decide together.<br />
              <span className="text-primary italic">Swipe</span> on real places.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Decido turns "where should we eat?" into a game. Create a room, invite
              your people, and swipe on real spots nearby until you all match — in
              real time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-medium text-primary-foreground shadow-citrus transition-transform hover:scale-[1.02]"
              >
                Start a room
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-7 py-3.5 text-base font-medium text-foreground hover:bg-muted"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
              <div className="absolute inset-0 rotate-[-6deg] rounded-3xl bg-grove shadow-card" />
              <div className="absolute inset-0 rotate-[3deg] rounded-3xl bg-sunset shadow-citrus" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-8 text-center">
                  <p className="font-script text-6xl text-citrus-cream drop-shadow-md">Decido</p>
                  <p className="mt-2 font-serif text-2xl text-citrus-cream/90">
                    tangy decisions,<br />sweeter together
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: "Create a room", body: "Pick a category and radius. Share the code with friends." },
            { icon: MapPin, title: "Swipe on places", body: "Real spots pulled from Google Maps. Left to skip, right to love." },
            { icon: Sparkles, title: "Match instantly", body: "When everyone right-swipes the same place, it's a match." },
          ].map((step, i) => (
            <div key={i} className="rounded-3xl border border-border/60 bg-card p-8 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sunset text-citrus-cream">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-serif text-2xl">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Made with <span className="text-primary">♥</span> — Decido, 2026
      </footer>
    </div>
  );
}
