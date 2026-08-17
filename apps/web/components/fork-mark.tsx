export function ForkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3v7.2c0 1.2.9 2.2 2.1 2.3L12 13l2.9-.5c1.2-.2 2.1-1.1 2.1-2.3V3" />
      <path d="M12 13v8" />
      <circle cx="12" cy="21" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
