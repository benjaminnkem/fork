"use client";

import { IndexedChangesList } from "@/components/changes-list";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useChange, useChanges } from "@/hooks/use-api";
import { EvidenceList } from "@/components/evidence-list";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ChangesPage() {
  const changes = useChanges();
  return (
    <div className="grid gap-6">
      {changes.isLoading ? <Skeleton className="h-40" /> : null}
      {changes.error ? <ErrorState error={changes.error} title="Change index unavailable" /> : null}
      {changes.data ? <IndexedChangesList changes={changes.data.changes} /> : null}
    </div>
  );
}

export function ChangeDetail({ id }: { id: string }) {
  const change = useChange(id);
  if (change.isLoading) return <Skeleton className="h-48" />;
  if (change.error) return <ErrorState error={change.error} title="Change not found" />;
  if (!change.data) return null;
  const record = change.data;
  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h1 className="font-heading text-3xl tracking-tight">{record.change.type}</h1>
        <p className="font-mono text-sm text-muted-foreground">{record.change.id}</p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status
            <StatusBadge value={record.change.status} kind="plain" />
          </CardTitle>
          <CardDescription>
            Source {record.sourceStatus} · destination {record.destinationStatus} · support{" "}
            {record.change.supportLevel}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>Proposal {record.change.proposalId ?? "—"}</div>
          <div>Governor state {record.rawGovernorState}</div>
          <div className="font-mono">for {record.forVotesRaw}</div>
          <div className="font-mono">against {record.againstVotesRaw}</div>
          <EvidenceList evidence={record.change.evidence} />
        </CardContent>
      </Card>
    </div>
  );
}
