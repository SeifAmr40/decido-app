import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CitrusMark } from "@/components/citrus-mark";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Decido" },
      { name: "description", content: "Sign in to Decido to start swiping on places with friends." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/rooms", replace: true });
    });
  }, [router]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/rooms`,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Decido! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.navigate({ to: "/rooms", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.navigate({ to: "/rooms", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-paper md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        <div className="absolute inset-0 bg-sunset" />
        <div className="relative flex h-full flex-col justify-between p-12 text-citrus-cream">
          <CitrusMark />
          <div>
            <p className="font-script text-5xl">where to?</p>
            <h2 className="mt-2 font-serif text-5xl leading-tight">
              A tangy way to decide, together.
            </h2>
            <p className="mt-4 max-w-md text-citrus-cream/85">
              Real places. Real friends. Real-time swiping until you all match.
            </p>
          </div>
          <p className="text-sm text-citrus-cream/70">© Decido 2026</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8"><CitrusMark /></div>
          <h1 className="font-serif text-3xl">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your Decido room." : "Just a few details to get started."}
          </p>

          <Button
            onClick={handleGoogle}
            disabled={loading}
            variant="outline"
            className="mt-6 w-full rounded-full py-6 text-base"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or with email
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eva" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@decido.app" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base shadow-citrus">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "No account yet? Create one." : "Already have an account? Sign in."}
          </button>
        </div>
      </div>
    </div>
  );
}
