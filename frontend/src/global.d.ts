/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.yaml' {
  /** Parsed YAML as JSON-compatible data (nested maps, strings, etc.). */
  const content: unknown;
  export default content;
}
