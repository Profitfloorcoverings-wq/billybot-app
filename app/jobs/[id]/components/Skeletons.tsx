export function JobDetailSkeleton() {
  return (
    <div className="page-container animate-pulse">
      <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="h-10 rounded-xl bg-white/5" />
          <div className="h-48 rounded-2xl bg-white/5" />
          <div className="h-48 rounded-2xl bg-white/5" />
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-white/5" />
          <div className="h-48 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
