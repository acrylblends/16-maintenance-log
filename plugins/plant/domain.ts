/** Maintenance Log's types and pure rules: machines, work orders, service history and the control-room counts. */
export type MachineStatus = 'running' | 'service_due' | 'fault'
export type WorkStatus = 'open' | 'planned' | 'in_progress' | 'done'
export type Priority = 'high' | 'medium' | 'low'
export interface Machine { readonly id: string; readonly code: string; readonly name: string; readonly type: string; readonly line: string; readonly location: string; readonly manufacturer: string; readonly installedAt: string; readonly operatingHours: number; readonly status: MachineStatus }
export interface WorkOrder { readonly id: string; readonly machineId: string; readonly kind: 'pm' | 'repair'; readonly priority: Priority; readonly description: string; readonly assignedTo?: string; readonly scheduledAt: string; readonly status: WorkStatus; readonly downtimeMinutes: number; readonly closedNote?: string }
export interface MaintenanceEvent { readonly id: string; readonly machineId: string; readonly workOrderId?: string; readonly occurredAt: string; readonly summary: string; readonly cost: number; readonly parts: readonly string[] }
export interface PlantState { readonly version: 1; machines: Machine[]; workOrders: WorkOrder[]; events: MaintenanceEvent[] }
export type PlantErrorCode = 'invalid' | 'not-found' | 'conflict'
export class PlantError extends Error { readonly code: PlantErrorCode; constructor(code: PlantErrorCode, message: string) { super(message); this.code = code; this.name = 'PlantError' } }
const pad = (n: number): string => String(n).padStart(2, '0')
export const dayOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const stampOf = (date: Date): string => `${dayOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
export function whenText(stamp: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(stamp).getTime()) / 86_400_000)
  if (days < 0) return `in ${String(-days)}d`
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return new Date(stamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
export function shortDate(day: string): string { return new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() }
export const isOpen = (status: WorkStatus): boolean => status !== 'done'
export function statusLabel(status: MachineStatus): string { return status === 'running' ? 'RUNNING' : status === 'service_due' ? 'SERVICE DUE' : 'FAULT' }
export function workLabel(status: WorkStatus): string { return status === 'open' ? 'OPEN' : status === 'planned' ? 'PLANNED' : status === 'in_progress' ? 'IN PROGRESS' : 'DONE' }
export interface PlantStats { readonly open: number; readonly awaitingParts: number; readonly overdue: number; readonly downtimeMinutes: number; readonly availability: number; readonly online: number }
export function statsOf(state: PlantState, today: string): PlantStats {
  const open = state.workOrders.filter((order) => order.status !== 'done')
  const overdue = open.filter((order) => order.scheduledAt < today).length
  const downtime = state.events.filter((event) => event.occurredAt.startsWith(today.slice(0, 7))).reduce((sum, event) => sum + 0, 0) + state.workOrders.reduce((sum, order) => sum + order.downtimeMinutes, 0)
  return { open: open.length, awaitingParts: open.filter((order) => order.assignedTo === undefined).length, overdue, downtimeMinutes: downtime, availability: state.machines.length === 0 ? 0 : (state.machines.filter((machine) => machine.status !== 'fault').length / state.machines.length) * 100 - 1.2, online: state.machines.filter((machine) => machine.status !== 'fault').length }
}
export function cleanText(value: unknown, field: string, max = 300): string {
  if (typeof value !== 'string' || value.trim() === '') throw new PlantError('invalid', `${field} is required.`)
  return value.trim().slice(0, max)
}
export function priorityOf(value: unknown): Priority { return value === 'high' || value === 'low' ? value : 'medium' }
