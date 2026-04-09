interface WeaponGlyphProps {
  className?: string;
  id: "hammer" | "laser" | "pulse";
}

export default function WeaponGlyph({ className, id }: WeaponGlyphProps) {
  if (id === "hammer") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        <path d="M4 20l7.2-7.2" />
        <path d="M12.2 5.4 18.6 11.8" />
        <path d="m10.4 7.2 2.4-2.4 5.8 5.8-2.4 2.4" />
        <path d="M8.8 8.8 15.2 15.2" />
      </svg>
    );
  }

  if (id === "pulse") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M4 12h2.4M17.6 12H20M12 4v2.4M12 17.6V20" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    >
      <path d="M3 12h18" />
      <path d="M12 3v18" />
    </svg>
  );
}
