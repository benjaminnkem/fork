import { HistoricalView } from "@/components/historical-view";

export default function Page() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Pinned evidence</p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">Historical replays</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Each entry is a real pinned governance effect. The result is recomputed by the worker.
        </p>
      </section>
      <HistoricalView />
    </div>
  );
}
