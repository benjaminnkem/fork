export function ForkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="12" fill="var(--primary)" />
      <g
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3.25"
        strokeLinecap="round"
      >
        <path d="M16 21.4 22.6 29.4" />
        <path d="M32 21.4 25.4 29.4" />
      </g>
      <g fill="var(--primary-foreground)">
        <rect
          x="11.3"
          y="11.3"
          width="9.4"
          height="9.4"
          rx="1.8"
          transform="rotate(45 16 16)"
        />
        <rect
          x="27.3"
          y="11.3"
          width="9.4"
          height="9.4"
          rx="1.8"
          transform="rotate(45 32 16)"
        />
        <rect
          x="19.3"
          y="28.4"
          width="9.4"
          height="9.4"
          rx="1.8"
          transform="rotate(45 24 33.1)"
        />
      </g>
    </svg>
  );
}
