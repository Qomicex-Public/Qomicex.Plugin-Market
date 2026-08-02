import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle,
  Input, Label, MessageBoxProvider, Separator, Tabs, TabContent, Tooltip, cn,
} from '@qomicex/plugin-ui'
import type { Tab } from '@qomicex/plugin-ui'
import {
  getSettings, initApi, installFromUrl, listPlugins, setSettings, showToast,
} from './api.ts'
import { loadCatalog } from './catalog.ts'
import { DEFAULT_MIRRORS } from './catalog.ts'
import type { CatalogResult } from './catalog.ts'
import { permissionLabel } from './permissions.ts'
import type { CatalogPlugin, InstalledPlugin, PluginType } from './types.ts'
import { resolveFaIcon } from './BuiltinIcons.tsx'

const tabs: Tab[] = [
  { id: 'store', label: '商店' },
]

const typeTabs: Tab[] = [
  { id: 'all', label: '全部' },
  { id: 'plugin', label: '插件' },
  { id: 'library', label: '支持库' },
]

function resolveIcon(src: string): string {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:')) return src
  if (!/[/.]/.test(src)) return src
  const base = (typeof window !== 'undefined' && (window as any).__PLUGIN_API_BASE__) as string | undefined
  if (base) return `${base}/${src.replace(/^\.\//, '')}`
  return src
}

function isImageUrl(s: string): boolean {
  return /^(https?:\/\/|[\w.-]+\/.+\.\w+)/.test(s)
}

function PluginIcon({ icon, className }: { icon: string; className?: string }) {
  const src = resolveIcon(icon)

  if (isImageUrl(src)) {
    return <img src={src} alt="" className={cn('object-contain', className)} style={{ width: '1.5em', height: '1.5em', objectFit: 'contain', verticalAlign: '-0.15em' }} />
  }

  const faCls = resolveFaIcon(src)
  if (faCls) {
    return <i className={cn(faCls, className)} style={{ width: '1.5em', height: '1.5em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
  }

  return <span className={cn('text-sm', className)}>{src}</span>
}

export default function App() {
  return (
    <MessageBoxProvider>
      <StoreApp />
    </MessageBoxProvider>
  )
}

function StoreApp() {
  const [tab, setTab] = useState('store')
  const [catalog, setCatalog] = useState<CatalogResult | null>(null)
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | PluginType>('all')
  const [detail, setDetail] = useState<CatalogPlugin | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [registryUrl, setRegistryUrl] = useState('')
  const [mirrors, setMirrors] = useState<string[]>(DEFAULT_MIRRORS)
  const [newMirror, setNewMirror] = useState('')

  const refresh = useCallback(async () => {
    const [cat, inst] = await Promise.allSettled([loadCatalog(), listPlugins()])
    if (cat.status === 'fulfilled') setCatalog(cat.value)
    else showToast('加载插件目录失败: ' + (cat.reason instanceof Error ? cat.reason.message : String(cat.reason)), 'error')
    if (inst.status === 'fulfilled') setInstalled(inst.value)
  }, [])

  useEffect(() => {
    initApi()
      .then(async () => {
        const settings = await getSettings()
        setRegistryUrl((settings.registryUrl as string | undefined) ?? '')
        const savedMirrors = settings.mirrors as string[] | undefined
        if (Array.isArray(savedMirrors) && savedMirrors.length > 0) setMirrors(savedMirrors)
        await refresh()
      })
      .catch((e) => console.error('[plugin-store] init failed', e))
  }, [refresh])

  const installedOf = (id: string) => installed.find(p => p.manifest.id === id)
  const isInstalled = (id: string) => !!installedOf(id)
  const needsUpdate = (p: CatalogPlugin) => {
    const cur = installedOf(p.id)
    return !!cur && cur.manifest.version !== p.version
  }
  const isBusy = (id: string) => busyId === id

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = catalog?.plugins ?? []
    const byType = typeFilter === 'all' ? list : list.filter(p => p.type === typeFilter)
    if (!q) return byType
    return byType.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [catalog, search, typeFilter])

  const allPlugins = useMemo(() => catalog?.plugins ?? [], [catalog])
  const pluginById = useMemo(() => new Map(allPlugins.map(p => [p.id, p])), [allPlugins])

  const resolveDeps = (p: CatalogPlugin, visited = new Set<string>()): CatalogPlugin[] => {
    if (visited.has(p.id)) return []
    visited.add(p.id)
    const deps: CatalogPlugin[] = []
    for (const depId of (p.dependencies ?? [])) {
      const dep = pluginById.get(depId)
      if (!dep || isInstalled(depId)) continue
      deps.push(...resolveDeps(dep, visited), dep)
    }
    return deps
  }

  const handleInstall = async (p: CatalogPlugin) => {
    if (isBusy(p.id)) return
    setBusyId(p.id)
    try {
      const deps = resolveDeps(p)
      const seen = new Set<string>()
      const toInstall = [p, ...deps.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true })]
      for (const item of toInstall) {
        await installFromUrl(item.downloadUrl, mirrors)
      }
      await refresh()
      setDetail(null)
      const depCount = toInstall.length - 1
      showToast(
        depCount > 0
          ? `已安装「${p.name}」及 ${depCount} 个依赖`
          : `「${p.name}」安装成功`,
        'success',
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : '安装失败', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const saveRegistry = async () => {
    await setSettings('registryUrl', registryUrl.trim())
    await setSettings('mirrors', mirrors.filter(p => p.trim()))
    setSettingsOpen(false)
    await refresh()
    showToast('仓库配置已保存', 'success')
  }

  const addMirror = () => {
    const v = newMirror.trim()
    if (!v) return
    setMirrors(m => m.includes(v) ? m : [...m, v])
    setNewMirror('')
  }

  const removeMirror = (target: string) => {
    setMirrors(m => m.filter(p => p !== target))
  }

  const installLabel = (p: CatalogPlugin) =>
    isBusy(p.id) ? '安装中...' : needsUpdate(p) ? '更新' : isInstalled(p.id) ? '已安装' : '安装'
  const installDisabled = (p: CatalogPlugin) => isBusy(p.id) || (isInstalled(p.id) && !needsUpdate(p))

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />
        <Tooltip content="配置仓库" side="left">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>⚙</Button>
        </Tooltip>
      </div>

      <TabContent activeTab={tab} tabId="store">
        <div className="space-y-4">
          <Input
            placeholder="搜索插件名称、描述或标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Tabs tabs={typeTabs} activeTab={typeFilter} onChange={id => setTypeFilter(id as 'all' | PluginType)} />
          {catalog && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">未找到匹配的插件</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Card key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl leading-none"><PluginIcon icon={p.icon} /></span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={p.type === 'library' ? 'secondary' : 'outline'}>
                        {p.type === 'library' ? '支持库' : '插件'}
                      </Badge>
                      <Badge variant={needsUpdate(p) ? 'default' : isInstalled(p.id) ? 'secondary' : 'outline'}>
                        {needsUpdate(p) ? '可更新' : isInstalled(p.id) ? '已安装' : `v${p.version}`}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="mt-2 text-base">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={needsUpdate(p) ? 'default' : isInstalled(p.id) ? 'secondary' : 'outline'}
                    disabled={installDisabled(p)}
                    onClick={e => { e.stopPropagation(); handleInstall(p) }}
                  >
                    {installLabel(p)}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </TabContent>

      <Dialog open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <DialogHeader onClose={() => setDetail(null)}>
              <DialogTitle className="flex items-center gap-2">
                <PluginIcon icon={detail.icon} className="text-2xl" />{detail.name}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <p className="text-sm text-muted-foreground">{detail.description}</p>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">类型</span>
                <Badge variant={detail.type === 'library' ? 'secondary' : 'outline'}>
                  {detail.type === 'library' ? '支持库' : '插件'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">作者</span>
                <span>{detail.author}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">版本</span>
                <span>v{detail.version}</span>
              </div>
              {detail.minLauncherVersion && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">最低启动器版本</span>
                  <span>{detail.minLauncherVersion}</span>
                </div>
              )}
              {detail.dependencies && detail.dependencies.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">依赖</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.dependencies.map(depId => {
                      const dep = pluginById.get(depId)
                      const installed = isInstalled(depId)
                      return (
                        <Badge key={depId} variant={installed ? 'secondary' : 'outline'}>
                          {dep ? dep.name : depId}{installed ? ' (已安装)' : ''}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
              {detail.permissions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">权限申请</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.permissions.map(pid => {
                      const info = permissionLabel(pid)
                      return (
                        <Badge key={pid} variant={info.risk === 'danger' ? 'destructive' : info.risk === 'warning' ? 'outline' : 'secondary'}>
                          {info.label}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
            </DialogBody>
            <DialogFooter className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDetail(null)}>取消</Button>
              <Button disabled={installDisabled(detail)} onClick={() => handleInstall(detail)}>
                {installLabel(detail)}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogHeader onClose={() => setSettingsOpen(false)}>
          <DialogTitle>仓库配置</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div>
            <Label>远程仓库地址</Label>
            <Input
              className="mt-1.5"
              placeholder="https://example.com/registry.json"
              value={registryUrl}
              onChange={e => setRegistryUrl(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            留空则使用默认远程仓库（Qomicex.Plugin-Market 的 repository 分支），加载失败时回退内置目录。仓库需返回 JSON：{'{ "plugins": [ { "id": "...", "downloadUrl": "...", ... } ] }'}
          </p>
          <Separator />
          <div>
            <Label>下载镜像</Label>
            <p className="text-xs text-muted-foreground mt-1">
              下载失败时依次尝试下方镜像，最后回退官方源。填写前缀（如 https://ghproxy.net/）。
            </p>
            <div className="space-y-1.5 mt-2">
              {mirrors.map(m => (
                <div key={m} className="flex items-center justify-between text-sm">
                  <span className="text-xs break-all">{m || '官方源（无前缀）'}</span>
                  {m && (
                    <Button size="sm" variant="ghost" onClick={() => removeMirror(m)}>删除</Button>
                  )}
                </div>
              ))}
              <div className="flex gap-1.5">
                <Input
                  className="flex-1"
                  placeholder="https://ghproxy.net/"
                  value={newMirror}
                  onChange={e => setNewMirror(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMirror() } }}
                />
                <Button variant="outline" onClick={addMirror}>添加</Button>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>取消</Button>
          <Button onClick={saveRegistry}>保存</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
