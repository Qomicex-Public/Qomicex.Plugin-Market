import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
  Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle,
  Input, Label, MessageBoxProvider, Separator, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Tabs, TabContent, Tooltip, useMessageBox,
} from '@qomicex/plugin-ui'
import type { Tab } from '@qomicex/plugin-ui'
import {
  getSettings, initApi, installFromUrl, listPlugins, navigate, setPluginState,
  setSettings, showToast, uninstallPlugin,
} from './api.ts'
import { loadCatalog } from './catalog.ts'
import type { CatalogResult } from './catalog.ts'
import { permissionLabel } from './permissions.ts'
import type { CatalogPlugin, InstalledPlugin } from './types.ts'

const tabs: Tab[] = [
  { id: 'store', label: '商店' },
  { id: 'mine', label: '我的插件' },
]

export default function App() {
  return (
    <MessageBoxProvider>
      <StoreApp />
    </MessageBoxProvider>
  )
}

function StoreApp() {
  const msg = useMessageBox()
  const [tab, setTab] = useState('store')
  const [catalog, setCatalog] = useState<CatalogResult | null>(null)
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<CatalogPlugin | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [registryUrl, setRegistryUrl] = useState('')

  const refresh = useCallback(async () => {
    const [cat, inst] = await Promise.all([loadCatalog(), listPlugins()])
    setCatalog(cat)
    setInstalled(inst)
  }, [])

  useEffect(() => {
    initApi()
      .then(async () => {
        const settings = await getSettings()
        setRegistryUrl((settings.registryUrl as string | undefined) ?? '')
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
    if (!q) return list
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [catalog, search])

  const handleInstall = async (p: CatalogPlugin) => {
    if (isBusy(p.id)) return
    setBusyId(p.id)
    try {
      await installFromUrl(p.downloadUrl)
      await refresh()
      setDetail(null)
      showToast(`「${p.name}」安装成功`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '安装失败', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleState = async (p: InstalledPlugin) => {
    const target = p.state === 'disabled' ? 'active' : 'disabled'
    try {
      await setPluginState(p.manifest.id, target)
      await refresh()
      showToast(`已${target === 'active' ? '启用' : '禁用'}「${p.manifest.name}」`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  const handleUninstall = async (p: InstalledPlugin) => {
    const ok = await msg.confirm(`确定卸载插件「${p.manifest.name}」吗？卸载后其配置将一并清除。`, '卸载插件')
    if (!ok) return
    try {
      await uninstallPlugin(p.manifest.id)
      await refresh()
      showToast(`已卸载「${p.manifest.name}」`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '卸载失败', 'error')
    }
  }

  const saveRegistry = async () => {
    await setSettings('registryUrl', registryUrl.trim())
    setSettingsOpen(false)
    await refresh()
    showToast('仓库配置已保存', 'success')
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
          {catalog?.source === 'builtin' && (
            <p className="text-xs text-muted-foreground">
              当前展示内置目录（未配置远程仓库或远程加载失败），可在右上角 ⚙ 中配置仓库地址
            </p>
          )}
          {catalog && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">未找到匹配的插件</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Card key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl leading-none">{p.icon}</span>
                    <Badge variant={needsUpdate(p) ? 'default' : isInstalled(p.id) ? 'secondary' : 'outline'}>
                      {needsUpdate(p) ? '可更新' : isInstalled(p.id) ? '已安装' : `v${p.version}`}
                    </Badge>
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

      <TabContent activeTab={tab} tabId="mine">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">共 {installed.length} 个已安装插件</p>
            <Button variant="outline" size="sm" onClick={refresh}>刷新</Button>
          </div>
          {installed.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚未安装任何插件，去「商店」看看吧。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installed.map(p => (
                  <TableRow key={p.manifest.id}>
                    <TableCell className="font-medium">{p.manifest.name}</TableCell>
                    <TableCell>v{p.manifest.version}</TableCell>
                    <TableCell>
                      <Badge variant={p.state === 'active' ? 'default' : 'secondary'}>
                        {p.state === 'active' ? '已启用' : '已禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/plugins/p/${p.manifest.id}`)}>打开</Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleState(p)}>
                          {p.state === 'active' ? '禁用' : '启用'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleUninstall(p)}>卸载</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabContent>

      <Dialog open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <DialogHeader onClose={() => setDetail(null)}>
              <DialogTitle className="flex items-center gap-2">
                <span>{detail.icon}</span>{detail.name}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <p className="text-sm text-muted-foreground">{detail.description}</p>
              <Separator />
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
        </DialogBody>
        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setSettingsOpen(false)}>取消</Button>
          <Button onClick={saveRegistry}>保存</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
