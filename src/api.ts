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

export async function listPlugins(): Promise<InstalledPlugin[]> {
  const res = await fetch('/api/plugins/')
  if (!res.ok) throw new Error(`获取插件列表失败 (${res.status})`)
  return res.json()
}

export async function setPluginState(id: string, state: string): Promise<void> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  if (!res.ok) throw new Error(`操作失败 (${res.status})`)
}

export async function uninstallPlugin(id: string): Promise<void> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`卸载失败 (${res.status})`)
}

async function downloadBlob(downloadUrl: string): Promise<Blob> {
  if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')) {
    const resp = await proxyFetch({ url: downloadUrl })
    if (resp.status >= 400) throw new Error(`下载失败 (HTTP ${resp.status})`)
    if (resp.bodyBase64) return base64ToBlob(resp.bodyBase64)
    if (resp.body != null) return new Blob([resp.body])
    throw new Error('下载失败: 未获取到内容')
  }
  const res = await fetch(`/api/plugins/${PLUGIN_ID}/files/${downloadUrl}`)
  if (!res.ok) throw new Error(`下载失败 (${res.status})`)
  return res.blob()
}

export async function installFromUrl(downloadUrl: string): Promise<unknown> {
  const blob = await downloadBlob(downloadUrl)
  const fd = new FormData()
  fd.append('plugin', blob, 'package.qplugin')
  const res = await fetch('/api/plugins/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`安装失败 (${res.status})`)
  return res.json()
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes])
}
