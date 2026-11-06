import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createApp, readManifest } from '../src/app.ts'
import { pinnedInstance } from '../plugins/instance/index.ts'
import { cleanText, Plant, PlantError, statsOf } from '../plugins/plant/index.ts'
import type { PlantState } from '../plugins/plant/domain.ts'
import { memoryStore } from '../plugins/plant/store.ts'
import { seed } from '../plugins/plant/seed.ts'
import { NOW, noticeOf, projectRoot, withApp } from './support.ts'
const scratch = join(projectRoot, '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })
const newId = (kind: string): string => `${kind}-${Math.random().toString(36).slice(2, 8)}`

test('the seed has five machines, five work orders and three events, with computed stats', () => {
  const state = seed(NOW, newId)
  assert.equal(state.machines.length, 5)
  assert.equal(state.workOrders.length, 5)
  assert.equal(state.events.length, 3)
  const stats = statsOf(state, '2026-11-06')
  assert.equal(stats.open, 5)
  assert.equal(stats.overdue, 1)
  assert.equal(stats.online, 4)
  assert.ok(stats.availability > 60 && stats.availability < 100)
  assert.equal(cleanText(' note ', 'Note'), 'note')
  assert.throws(() => cleanText('', 'Note'), /required/)
})

async function open(): Promise<Plant> {
  let ids = 0
  return Plant.open({ store: memoryStore(), clock: () => NOW, newId: (kind) => `${kind}-${++ids}` })
}

test('a work order is created, assigned and closed with a note that joins the history', async () => {
  const store = memoryStore<PlantState>()
  let ids = 0
  const plant = await Plant.open({ store, clock: () => NOW, newId: (kind) => `${kind}-${++ids}` })
  const machine = plant.machines()[0]
  assert.ok(machine !== undefined)
  const order = await plant.createWorkOrder({ machineId: machine.id, kind: 'repair', priority: 'high', description: 'Replace the drive belt' })
  assert.equal(order.status, 'open')
  const assigned = await plant.assign(order.id, 'L. Weber')
  assert.equal(assigned.status, 'planned')
  await assert.rejects(plant.close(order.id, { note: '', downtimeMinutes: 10 }), /Close-out note/)
  const closed = await plant.close(order.id, { note: 'Belt replaced and tension checked.', downtimeMinutes: 45, parts: 'drive belt' })
  assert.equal(closed.status, 'done')
  assert.equal(closed.downtimeMinutes, 45)
  assert.equal(plant.events(machine.id)[0]?.summary.includes('Belt replaced'), true)
  await assert.rejects(plant.close(order.id, { note: 'x', downtimeMinutes: 0 }), (error: unknown) => error instanceof PlantError && /closed/.test(error.message))
  assert.equal(store.saved, 3)
})

test('the control room shows the register, the stats, the upcoming work and the inspector', () =>
  withApp(async (app) => {
    const page = await app.page('/')
    assert.equal(page.status, 200)
    assert.match(page.html, /Maintenance control/)
    assert.match(page.html, /CNC Mill 03/)
    assert.match(page.html, /Hydraulic fluid replacement/)
    assert.match(page.html, /OPEN WORK ORDERS/)
    assert.match(page.html, /HEALTH INDEX|Recent history/)
  }))

test('a machine page selects that asset and the work order page closes it', () =>
  withApp(async (app) => {
    const machine = app.root.plant.machines().find((item) => item.code === 'HP-001')
    assert.ok(machine !== undefined)
    const page = await app.page(`/machines/${machine.id}`)
    assert.match(page.html, /Hydraulic Press 01/)
    const order = app.root.plant.workOrders(machine.id)[0]
    assert.ok(order !== undefined)
    const detail = await app.page(`/work-orders/${order.id}`)
    assert.match(detail.html, /Close with a dated note/)
    const closed = await app.post(`/work-orders/${order.id}/close`, { note: 'Fluid replaced and pressure tested.', downtimeMinutes: '30' })
    assert.equal(noticeOf(closed).kind, 'ok')
    assert.equal(app.root.plant.workOrder(order.id)?.status, 'done')
  }))

test('creating and assigning from the forms works', () =>
  withApp(async (app) => {
    const machine = app.root.plant.machines()[0]
    assert.ok(machine !== undefined)
    const created = await app.post('/work-orders', { machineId: machine.id, kind: 'pm', priority: 'low', description: 'Quarterly inspection', scheduledAt: '2026-11-10', assignedTo: '' })
    assert.equal(noticeOf(created).kind, 'ok')
    const order = app.root.plant.workOrders(machine.id).find((item) => item.description === 'Quarterly inspection')
    assert.ok(order !== undefined)
    const assigned = await app.post(`/work-orders/${order.id}/assign`, { technician: 'J. Fischer' })
    assert.equal(noticeOf(assigned).kind, 'ok')
    assert.equal(app.root.plant.workOrder(order.id)?.assignedTo, 'J. Fischer')
  }))

test('health, 404, manifest, prefix and switch-off', async () => {
  await withApp(async (app) => {
    assert.equal((await app.page('/health')).status, 200)
    assert.equal((await app.page('/nope')).status, 404)
    assert.deepEqual(readManifest().plugins.map((row) => row.id), ['router', 'home', 'plant', 'plant-shell', 'maintenance', 'extensions', 'server', 'acryl-door'])
  })
  await withApp(async (app) => {
    const response = await app.root.router.request('/app', { headers: { accept: 'text/html' } })
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Maintenance control/)
  }, { prefix: '/app' })
  const manifest = readManifest()
  const without = { ...manifest, plugins: manifest.plugins.map((row) => (row.id === 'maintenance' ? { ...row, disabled: true } : row)) }
  const home = await mkdtemp(join(scratch, 'app-test-off-'))
  let ids = 0
  const app = await createApp(pinnedInstance(home, { root: projectRoot }), { listen: false, manifest: without, overrides: { plant: { clock: () => NOW, newId: (kind: string) => `${kind}-${++ids}` } } })
  try {
    assert.equal((await app.root.router.request('/health')).status, 200)
    assert.equal((await app.root.router.request('/')).status, 404)
  } finally { await app.stop(); await rm(home, { recursive: true, force: true }) }
})
