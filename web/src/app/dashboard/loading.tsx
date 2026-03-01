export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#064e3b]" />
        <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
      </div>
    </div>
  );
}
