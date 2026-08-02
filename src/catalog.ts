import { getSettings, proxyFetch } from './api.ts'
import { BUILTIN_CATALOG } from './catalog-data.ts'
import type { CatalogPlugin, PluginType } from './types.ts'

export interface CatalogResult {
  source: 'remote' | 'builtin'
  plugins: CatalogPlugin[]
}

function normalizeType(t: unknown): PluginType {
  return t === 'library' ? 'library' : 'plugin'
}

function normalizePlugins(list: CatalogPlugin[]): CatalogPlugin[] {
  return list.map(p => ({ ...p, type: normalizeType(p.type) }))
}

interface RegistryJson {
  plugins?: CatalogPlugin[]
}

export const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/Qomicex-Public/Qomicex.Plugin-Market/repository/plugins.json'

export const DEFAULT_MIRRORS = [
  'https://ghproxy.net/',
  'https://gh-proxy.com/',
  'https://ghfast.top/',
]

export async function loadCatalog(): Promise<CatalogResult> {
  const settings = await getSettings()
  const registryUrl = (settings.registryUrl as string | undefined)?.trim() || DEFAULT_REGISTRY_URL
  if (registryUrl) {
    try {
      const resp = await proxyFetch({ url: registryUrl })
      if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`)
      const data = JSON.parse(resp.body ?? '') as RegistryJson
      const plugins = Array.isArray(data.plugins) ? data.plugins : []
      if (plugins.length > 0) return { source: 'remote', plugins: normalizePlugins(plugins) }
      throw new Error('仓库返回的插件列表为空')
    } catch (e) {
      console.warn('[plugin-store] 远程仓库加载失败，回退内置目录:', e)
    }
  }
  return { source: 'builtin', plugins: normalizePlugins(BUILTIN_CATALOG) }
}
