export type PluginType = 'plugin' | 'library'

export interface CatalogPlugin {
  id: string
  name: string
  description: string
  author: string
  icon: string
  type?: PluginType
  version: string
  minLauncherVersion?: string
  permissions: string[]
  tags: string[]
  downloadUrl: string
}

export interface InstalledPlugin {
  manifest: {
    id: string
    name: string
    version: string
  }
  state: 'installed' | 'active' | 'disabled'
}
