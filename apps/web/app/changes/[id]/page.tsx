import { ChangeDetail } from "@/components/changes-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChangeDetail id={decodeURIComponent(id)} />;
}
