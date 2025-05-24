import type { SVGProps } from 'react';

export function HelmetIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M20 13c0 3.5-2 8-8 8s-8-4.5-8-8S6 2 12 2s8 7.5 8 11Z" />
      <path d="M4 13h16" />
      <path d="M12 13a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4Z" />
      <path d="M18 10h-2a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h2" />
    </svg>
  );
}
