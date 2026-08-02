import type { InstalledPlugin } from './types.ts'

declare global {
  interface Window {
    __PLUGIN_API__?: {
      call: (method: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

const PLUGIN_ID = 'top.qomicex.market'

export function initApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    let n = 0
    function check() {
      if (window.__PLUGIN_API__) { resolve(); return }
      n++
      if (n > 100) { reject(new Error('API bridge timeout')); return }
      setTimeout(check, 50)
    }
    check()
  })
}

function apiCall<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  if (!window.__PLUGIN_API__) throw new Error('API not initialized')
  return window.__PLUGIN_API__.call(method, ...args) as Promise<T>
}

export function getSettings(): Promise<Record<string, unknown>> {
  return apiCall<Record<string, unknown>>('getSettings').catch(() => ({}))
}

export function setSettings(key: string, value: unknown): Promise<void> {
  return apiCall('setSettings', key, value)
}

export function showToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  apiCall('showToast', message, type)
}

export function navigate(path: string): void {
  apiCall('navigate', path)
}

export interface ProxyRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface ProxyResponse {
  status: number
  headers: Record<string, string>
  body?: string | null
  bodyBase64?: string | null
}

export function proxyFetch(req: ProxyRequest): Promise<ProxyResponse> {
  return apiCall<ProxyResponse>('proxyFetch', req)
}

function callBackend<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
  return apiCall<T>('callBackend', endpoint, data)
}

export async function listPlugins(): Promise<InstalledPlugin[]> {
  const data = await callBackend<unknown[]>('/plugins/')
  if (!Array.isArray(data)) return []
  return data.map((p: any) => ({
    manifest: {
      id: p.manifest?.id ?? p.id ?? '',
      name: p.manifest?.name ?? p.name ?? '',
      version: p.manifest?.version ?? p.version ?? '',
    },
    state: p.status === 'active' ? 'active' : 'disabled',
  }))
}

export async function setPluginState(id: string, state: string): Promise<void> {
  await callBackend(`/plugins/${encodeURIComponent(id)}/state`, { _method: 'PUT', State: state })
}

export async function uninstallPlugin(id: string): Promise<void> {
  await callBackend(`/plugins/${encodeURIComponent(id)}`, { _method: 'DELETE' })
}

async function downloadBlob(downloadUrl: string, mirrorPrefixes: string[] = []): Promise<Blob> {
  if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
    const attempted = new Set<string>()
    const targets = [downloadUrl, ...mirrorPrefixes.filter(p => p).map(p => p.replace(/\/+$/, '') + '/' + downloadUrl)]
    for (const target of targets) {
      if (attempted.has(target)) continue
      attempted.add(target)
      try {
        const resp = await proxyFetch({ url: target, timeoutMs: 15000 })
        if (resp.status >= 400) continue
        if (resp.bodyBase64) return base64ToBlob(resp.bodyBase64)
        if (resp.body != null) return new Blob([resp.body])
      } catch {
        // 尝试下一个镜像
      }
    }
    throw new Error('下载失败: 所有下载源均不可用')
  }
  const resp = await callBackend<{ status: number; bodyBase64?: string; body?: string }>(
    `/plugins/${PLUGIN_ID}/files/${downloadUrl}`
  )
  if (resp.status >= 400) throw new Error(`下载失败 (${resp.status})`)
  if (resp.bodyBase64) return base64ToBlob(resp.bodyBase64)
  if (resp.body != null) return new Blob([resp.body])
  return new Blob()
}

export async function installFromUrl(downloadUrl: string, mirrorPrefixes?: string[]): Promise<unknown> {
  const blob = await downloadBlob(downloadUrl, mirrorPrefixes)
  const buf = await blob.arrayBuffer()
  return apiCall('uploadPlugin', Array.from(new Uint8Array(buf)), 'package.qplugin')
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes])
}
