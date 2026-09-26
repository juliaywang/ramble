import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {children}
    </svg>
  );
}

export function IconBack() {
  return (
    <Svg>
      <path d="M15 5L8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCompass() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14.8 9.2l-1.3 4.3-4.3 1.3 1.3-4.3 4.3-1.3z" fill="currentColor" />
    </Svg>
  );
}

export function IconDice() {
  return (
    <Svg>
      <rect x="4" y="4" width="16" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" />
      <circle cx="15" cy="15" r="1.1" fill="currentColor" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" />
    </Svg>
  );
}

export function IconPath() {
  return (
    <Svg>
      <path d="M6 17c2.5-4 3-7 6.5-7S15 13 18 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="6" cy="17" r="1.7" fill="currentColor" />
      <circle cx="18" cy="8" r="1.7" fill="currentColor" />
    </Svg>
  );
}

export function IconBook() {
  return (
    <Svg>
      <path d="M5 5.5h6.2A2.8 2.8 0 0 1 14 8.3V19a2.4 2.4 0 0 0-2.4-2.1H5V5.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M19 5.5h-6.2A2.8 2.8 0 0 0 10 8.3V19a2.4 2.4 0 0 1 2.4-2.1H19V5.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconPerson() {
  return (
    <Svg>
      <circle cx="12" cy="9" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.2 18.5c1.2-2.6 3.2-3.8 5.8-3.8s4.6 1.2 5.8 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}
