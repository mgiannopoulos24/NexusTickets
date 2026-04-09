/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.yaml' {
  const content: Record<string, any>;
  export default content;
}

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}
