/**
 * The handful of Material Symbols this board needs, inlined.
 *
 * Inlined rather than loaded as an icon font because a Discord Activity's CSP
 * blocks external requests — the same reason Caveat is self-hosted. Paths are
 * verbatim from Material Symbols Outlined at 24px, which is why the viewBox is
 * the Symbols one (`0 -960 960 960`) rather than `0 0 24 24`.
 */

import styled from "styled-components";

const PATHS = {
  visibility:
    "M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z",
  visibilityOff:
    "m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z",
  rotateLeft:
    "M440-80q-50-5-96-24.5T256-156l56-58q29 21 61.5 34t66.5 18v82Zm80 0v-82q104-15 172-93.5T760-438q0-117-81.5-198.5T480-718h-8l64 64-56 56-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-438q0 137-91 238.5T520-80ZM198-214q-32-42-51.5-88T122-398h82q5 34 18 66.5t34 61.5l-58 56Zm-76-264q6-51 25-98t51-86l58 56q-21 29-34 61.5T204-478h-82Z",
  delete:
    "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
  hideImage:
    "m840-234-80-80v-446H314l-80-80h526q33 0 56.5 23.5T840-760v526ZM792-56l-64-64H200q-33 0-56.5-23.5T120-200v-528l-64-64 56-56 736 736-56 56ZM240-280l120-160 90 120 33-44-283-283v447h447l-80-80H240Zm297-257ZM424-424Z",
} as const;

interface Props {
  /** Edge length in px; the glyph inherits its colour from the text. */
  size?: number;
}

function symbol(path: string) {
  return function Icon({ size = 20 }: Props) {
    return (
      <StyledIcon
        width={size}
        height={size}
        viewBox="0 -960 960 960"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={path} />
      </StyledIcon>
    );
  };
}

export const VisibilityIcon = symbol(PATHS.visibility);
export const VisibilityOffIcon = symbol(PATHS.visibilityOff);
export const RotateIcon = symbol(PATHS.rotateLeft);
export const DeleteIcon = symbol(PATHS.delete);
export const HideImageIcon = symbol(PATHS.hideImage);

/* ─── styles ───────────────────────────────────────────────────── */

/** Block so it never picks up the line-height of the text around it. */
const StyledIcon = styled.svg`
  display: block;
  flex: none;
`;
