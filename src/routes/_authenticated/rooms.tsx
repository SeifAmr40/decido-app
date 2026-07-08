import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, LogIn, Loader2, Users, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({ meta: [{ title: "Rooms — Decido" }] }),
  component: RoomsPage,
});

const CATEGORIES = [
  { value: "restaurant", label: "Restaurants" },
  { value: "cafe", label: "Cafés" },
  { value: "bar", label: "Bars" },
  { value: "bakery", label: "Bakeries" },
  { value: "park", label: "Parks" },
  { value: "museum", label: "Museums" },
  { value: "night_club", label: "Nightlife" },
  { value: "tourist_attraction", label: "Attractions" },
];

function code6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function RoomsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: myRooms, isLoading } = useQuery({
    queryKey: ["myRooms", user.id],
    queryFn: async () => {
      const { data: parts, error } = await supabase
        .from("participants")
        .select("room_id, rooms(id, code, name, category, status, host_id, created_at)")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return parts?.map((p) => p.rooms).filter(Boolean) ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="font-script text-2xl text-accent">let's decide</p>
        <h1 className="font-serif text-4xl">Your rooms</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CreateRoomDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["myRooms"] })} />
        <JoinRoomDialog onJoined={() => queryClient.invalidateQueries({ queryKey: ["myRooms"] })} />
      </div>

      <div className="space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        )}
        {!isLoading && (!myRooms || myRooms.length === 0) && (
          <EmptyState />
        )}
        {myRooms?.map((r: any) => (
          <Link
            key={r.id}
            to="/rooms/$roomId"
            params={{ roomId: r.id }}
            className="group block rounded-3xl border border-border/60 bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-citrus"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-script text-lg text-accent">room</p>
                <h3 className="font-serif text-2xl">{r.name || "Untitled room"}</h3>
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />code {r.code}</span>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                r.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {r.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <p className="font-script text-3xl text-accent">nothing yet</p>
      <h3 className="mt-1 font-serif text-2xl">Start your first room</h3>
      <p className="mt-2 text-muted-foreground">
        Pick a category, share the code with friends, and start swiping.
      </p>
    </div>
  );
}

function CreateRoomDialog({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [radius, setRadius] = useState(2000);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      // Get browser location
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 });
      }).catch(() => null);

      const latitude = pos?.coords.latitude ?? 40.7128;
      const longitude = pos?.coords.longitude ?? -74.006;

      const { data: room, error } = await supabase
        .from("rooms")
        .insert({
          code: code6(),
          host_id: userData.user.id,
          name: name || "Friday night",
          category,
          latitude,
          longitude,
          radius_meters: radius,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("participants").insert({ room_id: room.id, user_id: userData.user.id });

      toast.success("Room created — share the code!");
      setOpen(false);
      onCreated();
      router.navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group flex items-center justify-between gap-4 rounded-3xl bg-sunset p-6 text-left text-citrus-cream shadow-citrus transition hover:-translate-y-0.5">
          <div>
            <p className="font-script text-2xl">host it</p>
            <h3 className="font-serif text-2xl">Create a room</h3>
          </div>
          <Plus className="h-8 w-8 transition-transform group-hover:rotate-90" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">New room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Room name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday night" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Search radius (meters)</Label>
            <Input type="number" min={500} max={20000} step={500} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full rounded-full py-6 shadow-citrus">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinRoomDialog({ onJoined }: { onJoined: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { data: room, error } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code.toUpperCase().trim())
        .maybeSingle();
      if (error) throw error;
      if (!room) throw new Error("No room with that code");
      const { error: pErr } = await supabase
        .from("participants")
        .insert({ room_id: room.id, user_id: userData.user.id });
      if (pErr && !pErr.message.includes("duplicate")) throw pErr;
      toast.success("Joined!");
      setOpen(false);
      onJoined();
      router.navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group flex items-center justify-between gap-4 rounded-3xl border border-border/60 bg-card p-6 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-citrus">
          <div>
            <p className="font-script text-2xl text-accent">join in</p>
            <h3 className="font-serif text-2xl">Join with a code</h3>
          </div>
          <LogIn className="h-8 w-8 text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Join a room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Room code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" className="tracking-widest text-center uppercase" maxLength={6} />
          </div>
          <Button onClick={handleJoin} disabled={loading || code.length < 4} className="w-full rounded-full py-6 shadow-citrus">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join room"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
