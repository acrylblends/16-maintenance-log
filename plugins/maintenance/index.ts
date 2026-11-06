/** The maintenance control room: register, upcoming work, asset inspector, work-order detail and actions. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'
import { PlantError, shortDate, statusLabel, whenText, workLabel } from '../plant/index.ts'
const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export const name = 'maintenance'
export const inject = ['plant', 'shell', 'router']
export function apply(ctx: Context): void {
  const { plant, shell } = ctx
  const e = shell.e
  const prefix = shell.prefix
  const control = (selectedId: string | undefined, url: string): string => {
    const selected = (selectedId === undefined ? undefined : plant.machine(selectedId)) ?? plant.machines()[0]
    const stats = plant.stats()
    const upcoming = plant.workOrders().filter((order) => order.status !== 'done').slice(0, 5)
    const selectedOrders = selected === undefined ? [] : plant.workOrders(selected.id).filter((order) => order.status !== 'done')
    const history = selected === undefined ? [] : plant.events(selected.id)
    const machines = plant.machines().map((machine) => `<a class="machine${machine.id === selected?.id ? ' active' : ''}" href="${shell.href(`/machines/${encodeURIComponent(machine.id)}`)}" style="text-decoration:none"><span style="color:${machine.status === 'running' ? '#83c59d' : machine.status === 'fault' ? '#e58b74' : '#e4ad60'}">● ${statusLabel(machine.status)}</span><b>${escape(machine.name)}</b><small>${escape(machine.type)}${machine.line === '' ? '' : ` · ${escape(machine.line)}`} · ${escape(machine.code)}</small></a>`).join('')
    const main = `${shell.notice(url)}<div class="title"><div><small>ASSET RELIABILITY / MAINTENANCE OPERATIONS</small><h1>Maintenance control</h1><p>Preventive work, equipment history and downtime in one operational view.</p></div><a class="btn warn" href="#new-order" style="text-decoration:none">＋ Create work order</a></div><section class="stats"><article class="stat"><label>OPEN WORK ORDERS</label><strong>${String(stats.open).padStart(2, '0')}</strong><small>${String(stats.awaitingParts)} awaiting an owner</small></article><article class="stat"><label>OVERDUE PM TASKS</label><strong style="color:#e6ae63">${String(stats.overdue).padStart(2, '0')}</strong><small>scheduled before today</small></article><article class="stat"><label>DOWNTIME · MTD</label><strong>${(stats.downtimeMinutes / 60).toFixed(1)} <small>hrs</small></strong><small style="color:#83c59d">from closed work orders</small></article><article class="stat"><label>ASSET AVAILABILITY</label><strong>${stats.availability.toFixed(1)}%</strong><small>Target ≥ 95%</small></article></section><div class="bodygrid"><section class="panel"><div class="ph"><h2>Equipment register</h2><small>${String(plant.machines().length)} assets</small></div>${machines}</section><section class="panel"><div class="ph"><div><h2>Upcoming maintenance</h2><small>Planned work · next 14 days</small></div><span class="btn">Calendar ↗</span></div><div class="sched">${upcoming.map((order) => `<a class="schedrow" href="${shell.href(`/work-orders/${encodeURIComponent(order.id)}`)}" style="text-decoration:none"><time>${escape(shortDate(order.scheduledAt))}</time><div><b>${escape(order.description)}</b><small>${escape(plant.machine(order.machineId)?.name ?? '')} · ${order.assignedTo === undefined ? 'Unassigned' : `Technician: ${escape(order.assignedTo)}`}</small></div><span class="badge${order.status === 'planned' ? ' green' : ''}">${workLabel(order.status)}</span></a>`).join('')}</div>${selected === undefined ? '' : `<div class="form" id="new-order"><h2>Create work order</h2><form method="post" action="${shell.href('/work-orders')}"><input type="hidden" name="machineId" value="${e(selected.id)}"><label>KIND<select name="kind"><option value="pm">Preventive</option><option value="repair">Repair</option></select></label><label>PRIORITY<select name="priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></label><label>DESCRIPTION<input name="description" required maxlength="300" placeholder="What needs doing"></label><label>SCHEDULED<input name="scheduledAt" type="date" value="${selected === undefined ? '' : plant.now.toISOString().slice(0, 10)}"></label><label>TECHNICIAN<input name="assignedTo" maxlength="80" placeholder="Optional"></label><div class="actions"><button class="primary">Create work order</button></div></form></div>`}</section>${selected === undefined ? '' : `<aside class="panel"><div class="machinehero"><small>SELECTED ASSET / ${escape(selected.code)}</small><h2>${escape(selected.name)}</h2><p>${escape(selected.manufacturer)} · Installed ${escape(selected.installedAt)}${selected.line === '' ? '' : ` · ${escape(selected.line)}`}</p><div style="display:flex;justify-content:space-between;margin-top:15px;font-size:8px;color:#a7b0a6"><span>HEALTH INDEX</span><b>${String(Math.max(30, 100 - selectedOrders.length * 12))} / 100</b></div><div class="gauge"><i style="width:${String(Math.max(30, 100 - selectedOrders.length * 12))}%"></i></div></div><div class="specs"><div class="spec"><small>OPERATING HOURS</small><b>${selected.operatingHours.toLocaleString('en-GB')} h</b></div><div class="spec"><small>NEXT SERVICE</small><b>${upcoming[0] === undefined ? '—' : escape(shortDate(upcoming[0].scheduledAt))}</b></div><div class="spec"><small>LAST DOWNTIME</small><b>${String(selectedOrders.reduce((sum, order) => sum + order.downtimeMinutes, 0))} min</b></div><div class="spec"><small>OPEN ORDERS</small><b>${String(selectedOrders.length)} tasks</b></div></div><div class="ph"><h2>Recent history</h2></div><div class="events">${history.length === 0 ? '<p class="empty">No history yet.</p>' : history.slice(0, 3).map((event) => `<div class="event"><small>${escape(event.occurredAt.slice(0, 10))}</small><b>${escape(event.summary.split(' · ')[0] ?? '')}</b><p>${escape(event.summary.split(' · ').slice(1).join(' · '))}</p></div>`).join('')}</div></aside>`}</div>`
    return shell.page({ active: 'control', title: 'Maintenance control', main })
  }
  const detail = (id: string, url: string): string | undefined => {
    const order = plant.workOrder(id)
    if (order === undefined) return undefined
    const machine = plant.machine(order.machineId)
    const main = `${shell.notice(url)}<div class="title"><div><small>MAINTENANCE / WORK ORDER</small><h1>${escape(order.description)}</h1><p>${escape(machine?.name ?? '')} · ${escape(workLabel(order.status))} · ${escape(shortDate(order.scheduledAt))}</p></div><a class="btn" href="${shell.href(`/machines/${encodeURIComponent(order.machineId)}`)}" style="text-decoration:none">Back to the asset ↗</a></div><section class="panel" style="margin-top:16px"><div class="ph"><h2>Work order</h2><small>${escape(order.kind === 'pm' ? 'Preventive' : 'Repair')} · ${escape(order.priority)} priority</small></div><p style="padding:14px;font-size:10px;color:#a7b0a6">Assigned to ${escape(order.assignedTo ?? 'nobody yet')} · Scheduled ${escape(order.scheduledAt)}${order.closedNote === undefined ? '' : ` · Closed: ${escape(order.closedNote)}`}</p>${order.status === 'done' ? '' : `<form class="form" method="post" action="${shell.href(`/work-orders/${encodeURIComponent(order.id)}/assign`)}"><h2>Assign a technician</h2><label>TECHNICIAN<input name="technician" required maxlength="80" value="${escape(order.assignedTo ?? '')}"></label><div class="actions"><button class="primary">Assign</button></div></form><form class="form" method="post" action="${shell.href(`/work-orders/${encodeURIComponent(order.id)}/close`)}"><h2>Close with a dated note</h2><label>CLOSE-OUT NOTE<textarea name="note" required rows="3" placeholder="What was done and what was verified"></textarea></label><label>DOWNTIME (minutes)<input name="downtimeMinutes" inputmode="numeric" value="0"></label><label>PARTS<input name="parts" maxlength="120" placeholder="Optional"></label><div class="actions"><button class="primary">Close work order</button></div></form>`}</section>`
    return shell.page({ active: 'control', title: order.description, main })
  }
  const app = new Acryl()
    .get('/', (c) => c.html(control(undefined, c.req.url)))
    .get('/machines/:id', (c) => {
      if (plant.machine(c.req.param('id')) === undefined) return c.redirect(shell.url('/', { kind: 'error', text: 'That machine no longer exists.' }), 303)
      return c.html(control(c.req.param('id'), c.req.url))
    })
    .get('/work-orders/:id', (c) => {
      const main = detail(c.req.param('id'), c.req.url)
      if (main === undefined) return c.redirect(shell.url('/', { kind: 'error', text: 'That work order no longer exists.' }), 303)
      return c.html(main)
    })
    .post('/work-orders', async (c) => {
      const form = await c.req.parseBody()
      try {
        const order = await plant.createWorkOrder({ machineId: String(form.machineId ?? ''), kind: form.kind === 'repair' ? 'repair' : 'pm', priority: String(form.priority ?? 'medium'), description: String(form.description ?? ''), assignedTo: String(form.assignedTo ?? ''), scheduledAt: String(form.scheduledAt ?? '') })
        return c.redirect(shell.url(`/work-orders/${encodeURIComponent(order.id)}`, { kind: 'ok', text: 'Work order created.' }), 303)
      } catch (error) {
        if (!(error instanceof PlantError)) throw error
        return c.redirect(shell.url('/', { kind: 'error', text: error.message }), 303)
      }
    })
    .post('/work-orders/:id/assign', async (c) => {
      const form = await c.req.parseBody()
      try {
        await plant.assign(c.req.param('id'), String(form.technician ?? ''))
        return c.redirect(shell.url(`/work-orders/${encodeURIComponent(c.req.param('id'))}`, { kind: 'ok', text: 'Technician assigned.' }), 303)
      } catch (error) {
        return c.redirect(shell.url(`/work-orders/${encodeURIComponent(c.req.param('id'))}`, { kind: 'error', text: (error as Error).message }), 303)
      }
    })
    .post('/work-orders/:id/close', async (c) => {
      const form = await c.req.parseBody()
      try {
        await plant.close(c.req.param('id'), { note: String(form.note ?? ''), downtimeMinutes: Number(form.downtimeMinutes ?? 0), parts: String(form.parts ?? '') })
        return c.redirect(shell.url(`/work-orders/${encodeURIComponent(c.req.param('id'))}`, { kind: 'ok', text: 'Work order closed and added to the history.' }), 303)
      } catch (error) {
        return c.redirect(shell.url(`/work-orders/${encodeURIComponent(c.req.param('id'))}`, { kind: 'error', text: (error as Error).message }), 303)
      }
    })
  ctx.router.route(prefix === '' ? '/' : prefix, app)
}
