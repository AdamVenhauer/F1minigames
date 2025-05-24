import type { SVGProps } from 'react';

export function CheckeredFlagIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
       <path d="M4 3h2v2H4z" fill="currentColor"/>
       <path d="M8 3h2v2H8z" fill="currentColor"/>
       <path d="M12 3h2v2h-2z" fill="currentColor"/>
       <path d="M16 3h2v2h-2z" fill="currentColor"/>
       <path d="M6 5h2v2H6z" fill="currentColor"/>
       <path d="M10 5h2v2h-2z" fill="currentColor"/>
       <path d="M14 5h2v2h-2z" fill="currentColor"/>
       <path d="M18 5h2v2h-2z" fill="currentColor"/>
    </svg>
  );
}
