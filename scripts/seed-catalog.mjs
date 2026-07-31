#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PARENT = path.resolve(ROOT, '..')
const SELF_ID = 'top.qomicex.market'

const COPY_ONLY = process.argv.includes('--copy-only')

function listQpluginFiles() {
  const found = []
  for (const name of fs.readdirSync(PARENT)) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const full = path.join(PARENT, name)
    if (full === ROOT) continue
    let stat
    try { stat = fs.statSync(full) } catch { continue }
    if (stat.isDirectory()) {
      const pkgDir = path.join(full, 'dist', 'pkg')
      if (fs.existsSync(pkgDir)) {
        for (const f of fs.readdirSync(pkgDir)) {
          if (f.endsWith('.qplugin') && !f.includes(SELF_ID)) found.push(path.join(pkgDir, f))
        }
      }
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith('.qplugin') && !f.includes(SELF_ID)) found.push(path.join(full, f))
      }
    } else if (name.endsWith('.qplugin') && !name.includes(SELF_ID)) {
      found.push(full)
    }
  }
  return [...new Set(found)]
}

function readZipManifest(zipPath) {
  try {
    const out = execSync(`unzip -p ${JSON.stringify(zipPath)} manifest.json`, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(out)
  } catch {
    return null
  }
}

function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'store-meta.json'), 'utf8'))
  } catch {
    return {}
  }
}

function buildEntries() {
  const meta = loadMeta()
  const entries = []
  for (const pkg of listQpluginFiles()) {
    const manifest = readZipManifest(pkg)
    if (!manifest || !manifest.id) {
      console.warn('[seed] 跳过无效包:', path.basename(pkg))
      continue
    }
    const m = meta[manifest.id]
    if (!m) {
      console.warn('[seed] 跳过未收录的包（未在 store-meta.json 中配置）:', path.basename(pkg))
      continue
    }
    entries.push({
      id: manifest.id,
      name: m.name || manifest.name || manifest.id,
      description: m.description || '暂无简介',
      author: m.author || '未知作者',
      icon: m.icon || '📦',
      version: manifest.version || '0.0.0',
      minLauncherVersion: manifest.minLauncherVersion || '',
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      tags: Array.isArray(m.tags) ? m.tags : [],
      downloadUrl: 'packages/' + path.basename(pkg),
    })
  }
  return entries
}

function writeCatalogData(entries) {
  const content = [
    "import type { CatalogPlugin } from './types.ts'",
    '',
    '// 本文件由 scripts/seed-catalog.js 自动生成，请勿手动修改',
    'export const BUILTIN_CATALOG: CatalogPlugin[] = ' + JSON.stringify(entries, null, 2),
    '',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'src', 'catalog-data.ts'), content)
  console.log('[seed] 目录条目:', entries.length)
}

function isListed(zipPath) {
  const manifest = readZipManifest(zipPath)
  if (!manifest?.id) return false
  return !!loadMeta()[manifest.id]
}

function copyPackages() {
  const dest = path.join(ROOT, 'dist', 'packages')
  fs.mkdirSync(dest, { recursive: true })
  for (const pkg of listQpluginFiles()) {
    if (!isListed(pkg)) continue
    fs.copyFileSync(pkg, path.join(dest, path.basename(pkg)))
    console.log('[seed] 复制包:', path.basename(pkg))
  }
}

if (COPY_ONLY) {
  copyPackages()
} else {
  writeCatalogData(buildEntries())
}
