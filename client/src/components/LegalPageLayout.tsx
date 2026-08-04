import { Link, useLocation } from "wouter";

export default function LegalPageLayout({
  children,
  backTo,
}: {
  children: React.ReactNode;
  backTo?: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full bg-[#f9f6ef] text-stone-900">
      <nav className="flex items-center justify-between px-6 py-4 bg-[#1a3a2a]">
        <span className="font-serif text-xl font-bold text-[#f9f6ef]">Mustard Seed</span>
        <button
          onClick={() => setLocation(backTo ?? "/")}
          data-testid="button-legal-back"
          className="text-sm font-semibold text-[#e8c76a] hover:underline"
        >
          ← Back
        </button>
      </nav>

      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>

      <footer className="border-t border-stone-200 px-6 py-8 text-center text-sm text-stone-500">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/privacy-policy" className="hover:text-stone-700 hover:underline">
            Privacy Policy
          </Link>
          <span className="text-stone-300">•</span>
          <Link href="/terms-of-service" className="hover:text-stone-700 hover:underline">
            Terms of Service
          </Link>
          <span className="text-stone-300">•</span>
          <Link href="/subscription-info" className="hover:text-stone-700 hover:underline">
            Subscription Info
          </Link>
        </div>
        <p className="mt-4 text-xs text-stone-400">
          © {new Date().getFullYear()} Mustard Seed. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
