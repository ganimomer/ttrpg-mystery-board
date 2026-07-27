import { createGlobalStyle } from "styled-components";

/**
 * The only styling that cannot belong to a component: the font, the handful of
 * tokens read from every corner of the app, and the document reset. Everything
 * else lives with the component it dresses.
 */
export const GlobalStyle = createGlobalStyle`
  /* Drop a Caveat woff2 into client/public/fonts/Caveat.woff2 for the full
     handwritten look; until then the cursive fallback stack is used.
     Self-hosted (no CDN) so it also works inside a Discord Activity's strict
     CSP. */
  @font-face {
    font-family: "Caveat";
    src: url("/fonts/Caveat.woff2") format("woff2");
    font-weight: 400 700;
    font-display: swap;
  }

  :root {
    --hand: "Caveat", "Marker Felt", "Comic Sans MS", "Segoe Print", cursive;
    --ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --cork: #c69a5f;
    --cork-dark: #9c7038;
    --panel: #fbf7ef;
    --ink: #2c2114;
    --accent: #b0341d;
  }

  * {
    box-sizing: border-box;
  }
  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }
  body {
    font-family: var(--ui);
    color: var(--ink);
    background: #2a2018;
  }
`;
