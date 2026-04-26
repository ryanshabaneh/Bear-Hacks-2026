import { SignupButtons } from './_components/SignupButtons';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-8">
      <main className="w-full max-w-2xl flex flex-col gap-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-5xl font-semibold tracking-tight">Strata</h1>
          <p className="text-lg text-slate-400">
            Distributed transcription on the open web. Clients submit audio. Distributors host the
            embed and earn 68% of every Forecast.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Get started
          </h2>
          <SignupButtons />
          <p className="text-xs text-slate-500">
            Stub mode: no real auth, role is set by which button you click. Real Auth0 wiring lands
            in Phase 4.
          </p>
        </section>

        <footer className="text-xs text-slate-600 mt-16">
          BearHacks 2026 · Strata · Phase 1 skeleton
        </footer>
      </main>
    </div>
  );
}
