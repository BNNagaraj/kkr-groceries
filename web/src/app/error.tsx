"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">&#9888;&#65039;</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Something went wrong
        </h2>
        <p className="text-slate-500 mb-6">
          {error.message || "We encountered an unexpected error. Please try again."}
        </p>
        <button
          onClick={reset}
          className="bg-[#064e3b] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#065f46] transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
