import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      description="This route is not part of the Fork product surface."
    />
  );
}
