import type { CatalogPlugin } from './types.ts'

// 本文件由 scripts/seed-catalog.js 自动生成，请勿手动修改
export const BUILTIN_CATALOG: CatalogPlugin[] = [
  {
    "id": "top.qomicex.assistant",
    "name": "AI 助手",
    "description": "内置 DeepSeek 对话能力，支持悬浮窗快速问答、代码高亮与 Markdown 渲染，可自定义模型与接口地址。",
    "author": "Qomicex",
    "icon": "🧠",
    "type": "plugin",
    "version": "1.0.0",
    "minLauncherVersion": "0.1.0",
    "permissions": [
      "ui:toast",
      "ui:sub_window",
      "ui:inject_sidebar",
      "config:read",
      "config:write",
      "network:fetch",
      "network:cors_proxy",
      "cache:access"
    ],
    "tags": [
      "工具",
      "AI"
    ],
    "downloadUrl": "packages/Qomicex.Plugin-AI.Assistant.qplugin"
  },
  {
    "id": "com.qomicex.launch-meme",
    "name": "启动梗",
    "description": "在启动游戏时随机播放一段整活动画，为漫长的加载等待增添乐趣。",
    "author": "Qomicex",
    "icon": "😆",
    "type": "plugin",
    "version": "1.0.0",
    "minLauncherVersion": "0.1.0",
    "permissions": [
      "ui:toast"
    ],
    "tags": [
      "娱乐"
    ],
    "downloadUrl": "packages/com.qomicex.launch-meme.qplugin"
  },
  {
    "id": "com.qomicex.example-toolkit",
    "name": "示例工具包",
    "description": "官方插件开发示例：完整演示 Qomicex 组件库与插件 API 的用法，是插件开发者的最佳入门参考。",
    "author": "Qomicex",
    "icon": "🧰",
    "type": "plugin",
    "version": "1.0.0",
    "minLauncherVersion": "0.1.0",
    "permissions": [
      "ui:toast",
      "ui:navigate",
      "config:read",
      "config:write",
      "http:request",
      "shell:execute"
    ],
    "tags": [
      "开发",
      "示例"
    ],
    "downloadUrl": "packages/example-toolkit.qplugin"
  }
]
