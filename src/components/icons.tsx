import type { SVGProps } from "react";

/** Ícones de traço consistente (1.75px, cantos arredondados). Decorativos por padrão. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const IconSun = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>);
export const IconBook = (p: P) => (<Svg {...p}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></Svg>);
export const IconAlbum = (p: P) => (<Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="15.5" cy="8.5" r="1.5" /></Svg>);
export const IconBrush = (p: P) => (<Svg {...p}><path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-2 .9H6v-3.5a3 3 0 0 1 .9-2Z" /><path d="M12 6l6 6" /></Svg>);
export const IconPlus = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconCamera = (p: P) => (<Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></Svg>);
export const IconImage = (p: P) => (<Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Svg>);
export const IconCheck = (p: P) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>);
export const IconLock = (p: P) => (<Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>);
export const IconArrowLeft = (p: P) => (<Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>);
export const IconChevron = (p: P) => (<Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>);
export const IconRotate = (p: P) => (<Svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></Svg>);
export const IconTrash = (p: P) => (<Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>);
export const IconDownload = (p: P) => (<Svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>);
export const IconShuffle = (p: P) => (<Svg {...p}><path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c1.6 0 2.7-1 3.6-2.3M14 9.3C14.9 8 16 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3" /></Svg>);
export const IconInfo = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>);
export const IconAlert = (p: P) => (<Svg {...p}><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></Svg>);
export const IconShare = (p: P) => (<Svg {...p}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></Svg>);
export const IconStar = (p: P) => (<Svg {...p}><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8Z" /></Svg>);
export const IconPencil = (p: P) => (<Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></Svg>);
export const IconSettings = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>);

export const IconHeart = (p: P) => (<Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></Svg>);
export const IconPhone = (p: P) => (<Svg {...p}><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" /></Svg>);
export const IconPin = (p: P) => (<Svg {...p}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" /></Svg>);
export const IconClock = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
export const IconFile = (p: P) => (<Svg {...p}><path d="M7 3h7l5 5v13H7Z" /><path d="M14 3v5h5" /></Svg>);

/** Patinha preenchida — elemento da marca. */
export function Paw({ size = 22, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <ellipse cx="12" cy="16" rx="5" ry="4.2" />
      <ellipse cx="5.6" cy="10.4" rx="2.2" ry="2.7" transform="rotate(-18 5.6 10.4)" />
      <ellipse cx="9.6" cy="6.6" rx="2.2" ry="2.8" transform="rotate(-6 9.6 6.6)" />
      <ellipse cx="14.4" cy="6.6" rx="2.2" ry="2.8" transform="rotate(6 14.4 6.6)" />
      <ellipse cx="18.4" cy="10.4" rx="2.2" ry="2.7" transform="rotate(18 18.4 10.4)" />
    </svg>
  );
}
