import type { Config } from 'tailwindcss'
import pluginUiPreset from '@qomicex/plugin-ui/tailwind-preset'

export default {
  presets: [pluginUiPreset],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@qomicex/plugin-ui/**/*.{js,ts,tsx}',
  ],
  darkMode: 'class',
} satisfies Config
