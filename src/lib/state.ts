import fs from 'fs/promises'
import path from 'path'
import type { MigrationConfig, MigrationState, StepName } from './productboard/types'

export const STATE_FILE_PATH = path.join(process.cwd(), 'migration-state.json')

const STEP_NAMES: StepName[] = [
  'discovery',
  'migrationProduct',
  'products',
  'components',
  'releaseGroups',
  'releases',
  'features',
  'subfeatures',
  'dependencies',
  'discoverNotes',
  'companies',
  'users',
  'notes',
]

export function initState(config: MigrationConfig): MigrationState {
  return {
    config,
    migrationProductId: null,
    idMap: {
      products: {},
      components: {},
      features: {},
      subfeatures: {},
      releaseGroups: {},
      releases: {},
      companies: {},
      users: {},
      notes: {},
    },
    steps: Object.fromEntries(STEP_NAMES.map((name) => [name, 'pending'])) as MigrationState['steps'],
    errors: [],
  }
}

export async function saveState(state: MigrationState): Promise<void> {
  await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

export async function loadState(): Promise<MigrationState | null> {
  try {
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8')
    return JSON.parse(raw) as MigrationState
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function clearState(): Promise<void> {
  try {
    await fs.unlink(STATE_FILE_PATH)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
