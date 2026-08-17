import { ChangesPage } from "@/components/changes-page";

export default function Page() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Governance index</p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">Governance changes</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Indexed from Ethereum MultichainGovernor and stored locally. This list is empty until
          sync has written real proposals.
        </p>
      </section>
      <ChangesPage />
    </div>
  );
}
