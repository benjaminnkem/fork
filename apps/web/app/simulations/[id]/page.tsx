import { SimulationView } from "@/components/simulation-view";

export default async function SimulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SimulationView id={id} />;
}
