declare module '@tanstack/react-start/plugin/vite' {
  import type { PluginOption } from 'vite'

  export function tanstackStart(options?: unknown): PluginOption[]
}
