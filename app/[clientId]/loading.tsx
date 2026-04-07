export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-7">
        <div>
          <div className="h-8 w-64 bg-[var(--sand)] rounded-[6px] mb-2" />
          <div className="h-4 w-40 bg-[var(--sand)] rounded-[4px]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-48 bg-[var(--sand)] rounded-[6px]" />
          <div className="h-9 w-40 bg-[var(--sand)] rounded-[6px]" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[10px] mb-[10px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card-base" style={{ padding: 22 }}>
            <div className="h-3 w-16 bg-[var(--sand)] rounded-[3px] mb-3" />
            <div className="h-7 w-24 bg-[var(--sand)] rounded-[4px] mb-2" />
            <div className="h-5 w-16 bg-[var(--sand)] rounded-full" />
          </div>
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="bento">
        <div className="c5">
          <div className="card-base" style={{ padding: 22, height: 280 }}>
            <div className="h-4 w-20 bg-[var(--sand)] rounded-[3px] mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-[var(--sand)] rounded-[3px]" style={{ width: `${100 - i * 15}%`, margin: "0 auto" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="c7">
          <div className="card-deep" style={{ padding: 22, height: 280 }}>
            <div className="h-4 w-32 bg-[var(--sand)] rounded-[3px] mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-5 bg-[var(--sand)] rounded-[3px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
