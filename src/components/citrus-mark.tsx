export function CitrusMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-sunset shadow-card">
        <span className="absolute inset-1 rounded-full bg-citrus-cream/30" />
        <span className="relative font-serif text-citrus-cream leading-none">c</span>
      </span>
      <span className="font-script text-2xl leading-none text-primary">Decido</span>
    </span>
  );
}
