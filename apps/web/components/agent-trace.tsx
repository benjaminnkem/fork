import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLoading } from "@/components/loading-state";
import { useAgentTrace } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { asString } from "@/lib/format";

export function AgentTrace({ runId }: { runId?: string }) {
  const trace = useAgentTrace(runId);

  if (!runId) {
    return (
      <EmptyState
        title="No agent run"
        description="This simulation did not persist a Groq agent session. The EVM proof still stands on its own. Hidden model reasoning is never stored."
      />
    );
  }

  if (trace.isLoading) return <CardLoading label="Loading agent trace" />;
  if (trace.error) {
    if (trace.error instanceof ApiError && trace.error.status === 404) {
      return (
        <EmptyState
          title="Agent trace not found"
          description="The referenced agent run is missing. Fork does not reconstruct traces from memory."
        />
      );
    }
    return <ErrorState error={trace.error} title="Agent trace unavailable" />;
  }

  const events = trace.data?.events ?? [];
  if (events.length === 0) {
    return (
      <EmptyState
        title="Empty agent trace"
        description="The agent run exists but has no persisted user-safe events."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent evidence</CardTitle>
        <CardDescription>
          User-safe tool summaries only. Planner hidden reasoning is excluded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3">
          {events.map((event, index) => {
            const type = asString(event.type) ?? asString(event.kind) ?? "event";
            const name = asString(event.toolName) ?? asString(event.name);
            const summary = asString(event.summary) ?? asString(event.message);
            return (
              <li key={asString(event.id) ?? String(index)} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{type}</Badge>
                  {name ? <span className="font-mono text-sm">{name}</span> : null}
                </div>
                {summary ? <p className="mt-2 text-sm text-muted-foreground">{summary}</p> : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
