import styled from "styled-components";

interface Props {
  color?: string;
  size?: number;
}

/** A little pushpin, drawn head-on, casting a soft shadow. */
export function Thumbtack({ color = "#d63031", size = 26 }: Props) {
  return (
    <StyledThumbtack
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="26" rx="7" ry="2.5" fill="rgba(0,0,0,0.28)" />
      <circle cx="16" cy="14" r="10" fill={color} />
      <circle cx="16" cy="14" r="10" fill="url(#tack-shade)" />
      <circle cx="12.5" cy="10.5" r="3.2" fill="rgba(255,255,255,0.55)" />
      <rect x="15" y="22" width="2" height="6" rx="1" fill="#7f8c8d" />
      <defs>
        <radialGradient id="tack-shade" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
      </defs>
    </StyledThumbtack>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledThumbtack = styled.svg`
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.4));
`;
