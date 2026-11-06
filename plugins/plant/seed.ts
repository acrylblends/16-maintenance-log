/** The plant a new install starts with: five machines, five work orders and three history events. */
import type { Machine, MaintenanceEvent, PlantState, WorkOrder } from './domain.ts'
import { stampOf } from './domain.ts'
export function seed(now: Date, newId: (kind: string) => string): PlantState {
  const at = (daysFromNow: number): string => stampOf(new Date(now.getTime() + daysFromNow * 86_400_000))
  const machines: Machine[] = [
    { id: newId('machine'), code: 'MC-003', name: 'CNC Mill 03', type: 'Machining', line: 'Line A', location: 'Bay 3', manufacturer: 'Haas VF-2', installedAt: '2022-03-14', operatingHours: 8421, status: 'running' },
    { id: newId('machine'), code: 'HP-001', name: 'Hydraulic Press 01', type: 'Forming', line: 'Line B', location: 'Bay 1', manufacturer: 'Schuler', installedAt: '2019-08-02', operatingHours: 15620, status: 'service_due' },
    { id: newId('machine'), code: 'CV-007', name: 'Conveyor Belt 07', type: 'Assembly', line: 'Line C', location: 'Bay 7', manufacturer: 'Interroll', installedAt: '2021-01-20', operatingHours: 22140, status: 'running' },
    { id: newId('machine'), code: 'UT-002', name: 'Compressor 02', type: 'Utilities', line: '', location: 'Utility room', manufacturer: 'Atlas Copco', installedAt: '2018-11-05', operatingHours: 31005, status: 'fault' },
    { id: newId('machine'), code: 'LC-001', name: 'Laser Cutter 01', type: 'Fabrication', line: 'Line A', location: 'Bay 5', manufacturer: 'Trumpf', installedAt: '2023-05-10', operatingHours: 5120, status: 'running' },
  ]
  const machine = (code: string): Machine => machines.find((item) => item.code === code) as Machine
  const workOrders: WorkOrder[] = [
    { id: newId('work'), machineId: machine('MC-003').id, kind: 'pm', priority: 'medium', description: 'Lubrication & spindle inspection', assignedTo: 'L. Weber', scheduledAt: at(1), status: 'planned', downtimeMinutes: 0 },
    { id: newId('work'), machineId: machine('HP-001').id, kind: 'pm', priority: 'high', description: 'Hydraulic fluid replacement', assignedTo: 'M. Novak', scheduledAt: at(-2), status: 'open', downtimeMinutes: 0 },
    { id: newId('work'), machineId: machine('CV-007').id, kind: 'pm', priority: 'low', description: 'Belt tension & alignment', assignedTo: 'J. Fischer', scheduledAt: at(2), status: 'planned', downtimeMinutes: 0 },
    { id: newId('work'), machineId: machine('UT-002').id, kind: 'repair', priority: 'high', description: 'Filter and pressure check', scheduledAt: at(5), status: 'open', downtimeMinutes: 0 },
    { id: newId('work'), machineId: machine('LC-001').id, kind: 'pm', priority: 'low', description: 'Laser optics calibration', assignedTo: 'L. Weber', scheduledAt: at(7), status: 'planned', downtimeMinutes: 0 },
  ]
  const events: MaintenanceEvent[] = [
    { id: newId('event'), machineId: machine('MC-003').id, occurredAt: at(-9), summary: 'Spindle vibration inspection · within tolerance · WO-2408', cost: 320, parts: [] },
    { id: newId('event'), machineId: machine('MC-003').id, occurredAt: at(-23), summary: 'Coolant system service · filter replaced · WO-2381', cost: 180, parts: ['coolant filter'] },
    { id: newId('event'), machineId: machine('MC-003').id, occurredAt: at(-35), summary: 'Unexpected downtime · sensor recalibrated · 42 minutes', cost: 0, parts: [] },
  ]
  return { version: 1, machines, workOrders, events }
}
