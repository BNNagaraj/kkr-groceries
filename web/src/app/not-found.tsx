import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-4">404</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Page Not Found
        </h2>
        <p className="text-slate-500 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#065f46] transition-colors"
        >
          Back to Store
        </Link>
      </div>
    </div>
  );
}
