import type { SVGProps } from 'react';

export function TireIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2.5" x2="12" y2="6.5" />
      <line x1="12" y1="17.5" x2="12" y2="21.5" />
      <line x1="21.5" y1="12" x2="17.5" y2="12" />
      <line x1="6.5" y1="12" x2="2.5" y2="12" />
    </svg>
  );
}
