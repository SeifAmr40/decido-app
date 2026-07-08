import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Decido" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setLanguage(profile.preferred_language ?? "en");
      setTheme((profile.theme as "light" | "dark") ?? "light");
    }
  }, [profile]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: displayName,
        preferred_language: language,
        theme,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <p className="font-script text-2xl text-accent">it's you</p>
        <h1 className="font-serif text-4xl">Profile</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-3xl" />
      ) : (
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sunset text-2xl font-serif text-citrus-cream">
              {(displayName || user.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-serif text-xl truncate">{displayName || "Nameless"}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="pt">Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-full py-6 shadow-citrus">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
