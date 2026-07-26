/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Discord application (OAuth2) client id — required to run as an Activity. */
  readonly VITE_DISCORD_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
