import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — Citrus" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("favorites").delete().eq("id", id);
    if (error) toast.error("Could not remove");
    else {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-script text-2xl text-accent">saved for later</p>
        <h1 className="font-serif text-4xl">Favorites</h1>
      </div>
      {isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Heart className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 font-serif text-2xl">Nothing saved yet</p>
          <p className="text-muted-foreground">Tap the heart on any place to save it here.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((f) => (
          <div key={f.id} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
            {f.photo_url ? (
              <img src={f.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-sunset" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg truncate">{f.name}</p>
              <p className="truncate text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{f.address}</p>
              {f.category && <p className="mt-1 text-xs text-muted-foreground capitalize">{f.category.replace(/_/g, " ")}</p>}
            </div>
            <button onClick={() => remove(f.id)} aria-label="Remove" className="self-start rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
