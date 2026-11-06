/** The plant: machines, work orders and service history, and the operations the control room runs. */
import { cleanText, dayOf, type Machine, type MaintenanceEvent, type PlantState, PlantError, priorityOf, type PlantStats, statsOf, stampOf, type WorkOrder, type WorkStatus } from './domain.ts'
import { seed } from './seed.ts'
import type { Store } from './store.ts'
export interface PlantAdapters { readonly store: Store<PlantState>; readonly clock: () => Date; readonly newId: (kind: string) => string }
export interface WorkOrderInput { readonly machineId: string; readonly kind: 'pm' | 'repair'; readonly priority: string; readonly description: string; readonly assignedTo?: string; readonly scheduledAt?: string }
export class Plant {
  private state: PlantState
  private readonly adapters: PlantAdapters
  private constructor(state: PlantState, adapters: PlantAdapters) { this.state = state; this.adapters = adapters }
  static async open(adapters: PlantAdapters): Promise<Plant> { const saved = await adapters.store.load(); return new Plant(saved ?? seed(adapters.clock(), adapters.newId), adapters) }
  get now(): Date { return this.adapters.clock() }
  machines(): readonly Machine[] { return this.state.machines }
  machine(id: string): Machine | undefined { return this.state.machines.find((machine) => machine.id === id) }
  workOrders(machineId?: string): readonly WorkOrder[] { return [...this.state.workOrders].filter((order) => machineId === undefined || order.machineId === machineId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) }
  workOrder(id: string): WorkOrder | undefined { return this.state.workOrders.find((order) => order.id === id) }
  events(machineId: string): readonly MaintenanceEvent[] { return [...this.state.events].filter((event) => event.machineId === machineId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) }
  stats(today = dayOf(this.now)): PlantStats { return statsOf(this.state, today) }
  async createWorkOrder(input: WorkOrderInput): Promise<WorkOrder> {
    if (this.machine(input.machineId) === undefined) throw new PlantError('not-found', 'That machine no longer exists.')
    const order: WorkOrder = { id: this.adapters.newId('work'), machineId: input.machineId, kind: input.kind === 'repair' ? 'repair' : 'pm', priority: priorityOf(input.priority), description: cleanText(input.description, 'Description'), ...(input.assignedTo === undefined || input.assignedTo === '' ? {} : { assignedTo: input.assignedTo }), scheduledAt: input.scheduledAt === undefined || input.scheduledAt === '' ? dayOf(this.now) : cleanText(input.scheduledAt, 'Scheduled date', 10), status: 'open', downtimeMinutes: 0 }
    this.state.workOrders.push(order)
    await this.save()
    return order
  }
  async assign(id: string, technician: string): Promise<WorkOrder> {
    const order = this.require(id)
    if (order.status === 'done') throw new PlantError('conflict', 'That work order is closed.')
    const next = { ...order, assignedTo: cleanText(technician, 'Technician', 80), status: order.status === 'open' ? 'planned' as WorkStatus : order.status }
    this.replace(next)
    await this.save()
    return next
  }
  /** Close with a dated note and the downtime; the history event is written from it. */
  async close(id: string, input: { note: string; downtimeMinutes: number; parts?: string }): Promise<WorkOrder> {
    const order = this.require(id)
    if (order.status === 'done') throw new PlantError('conflict', 'That work order is already closed.')
    const note = cleanText(input.note, 'Close-out note')
    const downtime = Math.max(0, Math.round(input.downtimeMinutes))
    const next: WorkOrder = { ...order, status: 'done', downtimeMinutes: downtime, closedNote: note }
    this.replace(next)
    this.state.events.push({ id: this.adapters.newId('event'), machineId: order.machineId, workOrderId: order.id, occurredAt: stampOf(this.adapters.clock()), summary: `${order.description} · ${note}`, cost: 0, parts: input.parts === undefined || input.parts === '' ? [] : [input.parts] })
    await this.save()
    return next
  }
  private require(id: string): WorkOrder { const order = this.workOrder(id); if (order === undefined) throw new PlantError('not-found', 'That work order no longer exists.'); return order }
  private replace(next: WorkOrder): void { this.state.workOrders = this.state.workOrders.map((order) => (order.id === next.id ? next : order)) }
  private async save(): Promise<void> { this.state = { ...this.state, machines: [...this.state.machines], workOrders: [...this.state.workOrders], events: [...this.state.events] }; await this.adapters.store.save(this.state) }
}
