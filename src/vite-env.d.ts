/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Amplitude Analytics (client-side by design — not a gateway/auth secret). */
  readonly VITE_AMPLITUDE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
