import { ProofDetail } from "@/components/proof-detail";

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProofDetail id={id} />;
}
