import { ExecutionPage } from "@/components/execution-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExecutionPage simulationId={id} />;
}
