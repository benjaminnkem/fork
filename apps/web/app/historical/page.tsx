import { HistoricalView } from "@/components/historical-view";

export default function Page() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">Historical replays</h1>
        <p className="text-sm text-muted-foreground">
          Each entry is a real pinned governance effect. The result is recomputed by the worker.
        </p>
      </section>
      <HistoricalView />
    </div>
  );
}
