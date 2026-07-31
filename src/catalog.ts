import { getSettings, proxyFetch } from './api.ts'
import { BUILTIN_CATALOG } from './catalog-data.ts'
import type { CatalogPlugin } from './types.ts'

export interface CatalogResult {
  source: 'remote' | 'builtin'
  plugins: CatalogPlugin[]
}

interface RegistryJson {
  plugins?: CatalogPlugin[]
}

export async function loadCatalog(): Promise<CatalogResult> {
  const settings = await getSettings()
  const registryUrl = (settings.registryUrl as string | undefined)?.trim()
  if (registryUrl) {
    try {
      const resp = await proxyFetch({ url: registryUrl })
      if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`)
      const data = JSON.parse(resp.body ?? '') as RegistryJson
      const plugins = Array.isArray(data.plugins) ? data.plugins : []
      if (plugins.length > 0) return { source: 'remote', plugins }
      throw new Error('仓库返回的插件列表为空')
    } catch (e) {
      console.warn('[plugin-store] 远程仓库加载失败，回退内置目录:', e)
    }
  }
  return { source: 'builtin', plugins: BUILTIN_CATALOG }
}
