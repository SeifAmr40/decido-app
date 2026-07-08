import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Compass, Heart, User, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { CitrusMark } from "./citrus-mark";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/rooms", label: "Rooms", icon: Compass },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/rooms" className="focus:outline-none">
            <CitrusMark />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-citrus"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="ml-2 rounded-full p-2 text-foreground/60 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pt-10">{children}</main>

      {/* mobile bottom nav */}
      <nav className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-background/90 p-1.5 shadow-citrus backdrop-blur md:hidden">
        {nav.map((n) => {
          const active = pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                active ? "bg-primary text-primary-foreground" : "text-foreground/70"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
        <button onClick={handleSignOut} aria-label="Sign out" className="rounded-full p-2 text-foreground/60">
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
