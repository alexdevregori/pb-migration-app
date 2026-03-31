import fs from 'fs/promises'
import path from 'path'
import {
  loadState,
  saveState,
  initState,
  STATE_FILE_PATH,
} from '@/lib/state'
import type { MigrationConfig, MigrationState } from '@/lib/productboard/types'

const TEST_CONFIG: MigrationConfig = {
  sourceApiKey: 'src-key',
  destinationApiKey: 'dest-key',
  selectedStatuses: ['In Progress'],
  selectedReleaseGroups: ['rg-1'],
  selectedFields: ['field-1'],
}

describe('State Manager', () => {
  beforeEach(async () => {
    // Remove state file before each test
    await fs.unlink(STATE_FILE_PATH).catch(() => {})
  })

  afterEach(async () => {
    await fs.unlink(STATE_FILE_PATH).catch(() => {})
  })

  it('initState creates a fresh state with all steps pending', () => {
    const state = initState(TEST_CONFIG)
    expect(state.config).toEqual(TEST_CONFIG)
    expect(state.migrationProductId).toBeNull()
    expect(Object.values(state.steps).every((s) => s === 'pending')).toBe(true)
    expect(state.errors).toEqual([])
  })

  it('saveState writes state to disk as JSON', async () => {
    const state = initState(TEST_CONFIG)
    await saveState(state)
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.config.sourceApiKey).toBe('src-key')
  })

  it('loadState returns null when file does not exist', async () => {
    const state = await loadState()
    expect(state).toBeNull()
  })

  it('loadState returns state when file exists', async () => {
    const state = initState(TEST_CONFIG)
    await saveState(state)
    const loaded = await loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.config.sourceApiKey).toBe('src-key')
  })
})
