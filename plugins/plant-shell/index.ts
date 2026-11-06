/** The Maintenance Log shell: the PLANT/OPS top bar with the site and the online machine count, then the wrap. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'
import type { Plant } from '../plant/index.ts'
import { createShell, escapeHtml, type NavItem, type Shell } from './core.ts'
import { STYLES } from './styles.ts'
export * from './core.ts'
export const APP_TITLE = 'Maintenance Log'
export interface ShellConfig { readonly prefix?: string }
export const name = 'plant-shell'
export const inject = ['plant', 'router']
declare module '@deepseek-ai/cordis' { interface Context { shell: Shell } }
function topbar(_nav: readonly NavItem[], _crumbs: readonly string[], _href: (path: string) => string, _meta: string, _active: string | undefined): string {
  const online = (_meta.match(/\d+/u)?.[0] ?? '0')
  return `<header class="header"><div class="mark">PLANT<span><i>/</i>OPS</span></div><div class="site">FACILITY 04 / PRODUCTION HALL</div><div class="headright"><span class="light"></span> ${escapeHtml(online)} MACHINES ONLINE <span class="btn">Plant 04 ⌄</span></div></header>`
}
export function apply(ctx: Context, config: ShellConfig = {}): void {
  const plant: Plant = ctx.plant
  const prefix = config.prefix ?? ''
  const shell = createShell(prefix, { appTitle: APP_TITLE, css: STYLES, bodyClass: 'plant', topbar: (nav, crumbs, href, meta, active) => topbar(nav, crumbs, href, meta, active) })
  ctx.provide('shell', shell)
  ctx.router.route(prefix === '' ? '/' : prefix, new Acryl().get('/health', (c) => c.json({ ok: true })))
  void plant
}
