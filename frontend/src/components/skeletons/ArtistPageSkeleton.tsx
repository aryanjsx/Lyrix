export function ArtistPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="relative h-56 rounded-b-none bg-white/5 sm:h-72">
        <div className="absolute bottom-0 left-0 flex items-end gap-5 px-6 pb-6">
          <div className="h-20 w-20 flex-shrink-0 rounded-full bg-white/10 sm:h-24 sm:w-24" />
          <div>
            <div className="mb-2 h-3 w-12 rounded bg-white/10" />
            <div className="mb-2 h-8 w-48 rounded bg-white/10" />
            <div className="h-3 w-24 rounded bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 px-6">
        <div className="h-10 w-24 rounded-full bg-white/10" />
        <div className="h-10 w-28 rounded-full bg-white/10" />
        <div className="h-10 w-24 rounded-full bg-white/10" />
      </div>

      <div className="mt-8 px-6">
        <div className="mb-4 h-4 w-20 rounded bg-white/10" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2.5">
            <div className="h-4 w-6 rounded bg-white/5" />
            <div className="h-10 w-10 flex-shrink-0 rounded-md bg-white/10" />
            <div className="flex-1">
              <div className="mb-1.5 h-3.5 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
            <div className="h-3 w-8 rounded bg-white/5" />
          </div>
        ))}
      </div>

      <div className="mt-10 px-6">
        <div className="mb-4 h-4 w-28 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 aspect-square rounded-xl bg-white/10" />
              <div className="mb-1 h-3 w-4/5 rounded bg-white/10" />
              <div className="h-3 w-3/5 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
