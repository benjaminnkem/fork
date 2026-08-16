import { ChangesPage } from "@/components/changes-page";

export default function Page() {
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">Governance changes</h1>
        <p className="text-sm text-muted-foreground">
          Indexed from Ethereum MultichainGovernor and stored locally. This list is empty until
          sync has written real proposals.
        </p>
      </section>
      <ChangesPage />
    </div>
  );
}
