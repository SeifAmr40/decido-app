import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { sendMessage, getRoomMessages } from "@/lib/rooms.functions";
import { getGuestName, setGuestName } from "@/lib/guest";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export function RoomChat({ roomId, guestId }: { roomId: string; guestId: string }) {
  const queryClient = useQueryClient();
  const sendFn = useServerFn(sendMessage);
  const listFn = useServerFn(getRoomMessages);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(getGuestName());
  }, []);

  const msgQ = useQuery({
    queryKey: ["roomMessages", roomId, guestId],
    enabled: !!guestId,
    refetchInterval: 3000,
    queryFn: () => listFn({ data: { roomId, guestId } }),
  });

  const messages = msgQ.data?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendFn({ data: { roomId, guestId, body, name: name.trim() || undefined } });
      await queryClient.invalidateQueries({ queryKey: ["roomMessages", roomId, guestId] });
    } catch {
      toast.error("Message not sent");
      setDraft(body);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-script text-xl text-accent">before you meet</p>
          <h2 className="font-serif text-2xl">
            <MessageCircle className="mr-1 inline h-5 w-5 text-primary" /> Room chat
          </h2>
        </div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setGuestName(e.target.value);
          }}
          placeholder="your name"
          maxLength={40}
          aria-label="Your display name"
          className="w-36 rounded-full bg-background/50 px-3 py-1.5 text-sm backdrop-blur placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div
        ref={scrollRef}
        className="mt-4 max-h-72 min-h-32 space-y-3 overflow-y-auto rounded-2xl bg-background/30 p-3 backdrop-blur"
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet — say hi and pick a time to meet.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.mine ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                {!m.mine && (
                  <p className="mb-0.5 px-1 text-xs text-muted-foreground">
                    {m.senderName || "Guest"}
                  </p>
                )}
                <div
                  className={
                    m.mine
                      ? "rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "rounded-2xl rounded-bl-sm bg-background/70 px-3 py-2 text-sm text-foreground backdrop-blur"
                  }
                >
                  {m.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the room…"
          maxLength={1000}
          aria-label="Message"
          className="flex-1 rounded-full bg-background/50 px-4 py-2.5 text-sm backdrop-blur placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-citrus transition hover:scale-[1.03] disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
