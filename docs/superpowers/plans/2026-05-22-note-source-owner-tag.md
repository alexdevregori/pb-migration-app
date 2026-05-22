# Note Source Owner Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a note's owner can't be assigned in the destination workspace, optionally append `Source Owner: email@email.com` to the note body so the original owner is searchable/filterable.

**Architecture:** Add a single boolean config flag (`appendSourceOwnerOnUnassigned`) to `MigrationConfig` and `NoteFilterConfig`. Surface it as a checkbox in the Notes UI section. In the migration logic, extend the existing unassigned-owner branch to append the email to `fields.content` when the flag is true.

**Tech Stack:** TypeScript, React (Next.js), Jest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/productboard/types.ts` | Add `appendSourceOwnerOnUnassigned?: boolean` to `MigrationConfig` |
| `src/components/NoteFilterSelector.tsx` | Add field to `NoteFilterConfig` + render checkbox |
| `src/lib/migrators/notes.ts` | Append source owner to content in unassigned-owner branch |
| `src/__tests__/lib/migrators/notes.test.ts` | Add two tests covering the new behaviour |

---

### Task 1: Add config field to `MigrationConfig`

**Files:**
- Modify: `src/lib/productboard/types.ts`

- [ ] **Step 1: Add the field**

In `src/lib/productboard/types.ts`, inside `MigrationConfig` (after the existing `processedOrphanNotesMaxAgeDays` line), add:

```ts
  appendSourceOwnerOnUnassigned?: boolean
```

The block should look like:
```ts
  includeProcessedOrphanNotes?: boolean
  processedOrphanNotesMaxAgeDays?: number | null
  appendSourceOwnerOnUnassigned?: boolean
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/productboard/types.ts
git commit -m "feat: add appendSourceOwnerOnUnassigned to MigrationConfig"
```

---

### Task 2: Update `NoteFilterConfig` and render the checkbox

**Files:**
- Modify: `src/components/NoteFilterSelector.tsx`

- [ ] **Step 1: Add the field to `NoteFilterConfig`**

At the bottom of the `NoteFilterConfig` interface (after `processedOrphanNotesMaxAgeDays`):

```ts
export interface NoteFilterConfig {
  includeLinkedNotes: boolean
  linkedNotesMaxAgeDays: number | null
  includeNotesLinkedToNonMigratedFeatures: boolean
  nonMigratedLinkedNotesMaxAgeDays: number | null
  includeUnprocessedOrphanNotes: boolean
  unprocessedOrphanNotesMaxAgeDays: number | null
  includeProcessedOrphanNotes: boolean
  processedOrphanNotesMaxAgeDays: number | null
  appendSourceOwnerOnUnassigned: boolean
}
```

- [ ] **Step 2: Render the checkbox below the bucket rows**

In `NoteFilterSelector`, after the closing `</div>` of the four `BucketRow` items and before the outer closing `</div>`, add:

```tsx
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '4px' }}>
          <input
            type="checkbox"
            checked={config.appendSourceOwnerOnUnassigned}
            onChange={(e) => set({ appendSourceOwnerOnUnassigned: e.target.checked })}
            style={{ marginTop: '2px', flexShrink: 0, accentColor: '#0079F2', width: '14px', height: '14px' }}
          />
          <div>
            <div style={labelStyle}>Append source owner to unassigned notes</div>
            <div style={descStyle}>Adds &ldquo;Source Owner: email@email.com&rdquo; to the bottom of notes whose owner isn&rsquo;t in the destination workspace.</div>
          </div>
        </label>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/NoteFilterSelector.tsx
git commit -m "feat: add appendSourceOwnerOnUnassigned checkbox to NoteFilterSelector"
```

---

### Task 3: Append source owner in migration logic

**Files:**
- Modify: `src/lib/migrators/notes.ts`

- [ ] **Step 1: Locate the unassigned-owner branch**

In `src/lib/migrators/notes.ts`, find this block inside `migrateNotes` (around line 273):

```ts
        } else {
          const warn = {
            step: 'notes' as const,
            sourceId: note.id,
            name: String(note.fields.name),
            message: `Owner ${ownerEmail} not found in destination — created without owner`,
            severity: 'warning' as const,
          }
          state.errors.push(warn)
          emit({ step: 'notes', status: 'in_progress', migrated, total, error: warn })
        }
```

- [ ] **Step 2: Append source owner to content in that branch**

Replace the `else` block with:

```ts
        } else {
          const warn = {
            step: 'notes' as const,
            sourceId: note.id,
            name: String(note.fields.name),
            message: `Owner ${ownerEmail} not found in destination — created without owner`,
            severity: 'warning' as const,
          }
          state.errors.push(warn)
          emit({ step: 'notes', status: 'in_progress', migrated, total, error: warn })

          if (state.config.appendSourceOwnerOnUnassigned) {
            const existing = typeof fields.content === 'string' ? fields.content : ''
            fields.content = existing ? `${existing}\n\nSource Owner: ${ownerEmail}` : `Source Owner: ${ownerEmail}`
          }
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/migrators/notes.ts
git commit -m "feat: append source owner email to unassigned note content"
```

---

### Task 4: Add tests

**Files:**
- Modify: `src/__tests__/lib/migrators/notes.test.ts`

- [ ] **Step 1: Write a failing test — flag ON, owner unassigned**

Add this test inside the existing `describe('migrateNotes', ...)` block in `src/__tests__/lib/migrators/notes.test.ts`:

```ts
  it('appends source owner to content when flag is on and owner is unassigned', async () => {
    const sourceNotes: PBNote[] = [
      {
        id: 'note-2',
        type: 'textNote',
        fields: {
          name: 'Orphan note',
          content: 'Some feedback',
          owner: { email: 'old@example.com' },
        },
      },
    ]

    const dest = new ProductboardClient('dest')
    const mockRequest = jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-2' } })

    const state = initState({
      sourceApiKey: 'src',
      destinationApiKey: 'dest',
      selectedStatuses: [],
      selectedProducts: [],
      selectedReleaseGroups: [],
      selectedFields: [],
      appendSourceOwnerOnUnassigned: true,
    })

    await migrateNotes(
      sourceNotes,
      new Map(),
      new ProductboardClient('src'),
      dest,
      state,
      jest.fn(),
      new Set(['other@example.com']), // 'old@example.com' is NOT in this set
    )

    const postedBody = JSON.parse((mockRequest.mock.calls[0][1] as RequestInit).body as string)
    expect(postedBody.data.fields.content).toBe('Some feedback\n\nSource Owner: old@example.com')
  })
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest src/__tests__/lib/migrators/notes.test.ts --testNamePattern="appends source owner" -t "appends source owner"
```
Expected: FAIL (the content won't have the suffix yet until Task 3 is done — if running in order, it should already pass; if running this task first, it will fail).

- [ ] **Step 3: Write a failing test — flag ON but owner IS assigned (no append)**

Add a second test immediately after the first:

```ts
  it('does not append source owner when owner is successfully assigned', async () => {
    const sourceNotes: PBNote[] = [
      {
        id: 'note-3',
        type: 'textNote',
        fields: {
          name: 'Assigned note',
          content: 'Clean content',
          owner: { email: 'member@example.com' },
        },
      },
    ]

    const dest = new ProductboardClient('dest')
    const mockRequest = jest.spyOn(dest, 'request').mockResolvedValueOnce({ data: { id: 'dest-note-3' } })

    const state = initState({
      sourceApiKey: 'src',
      destinationApiKey: 'dest',
      selectedStatuses: [],
      selectedProducts: [],
      selectedReleaseGroups: [],
      selectedFields: [],
      appendSourceOwnerOnUnassigned: true,
    })

    await migrateNotes(
      sourceNotes,
      new Map(),
      new ProductboardClient('src'),
      dest,
      state,
      jest.fn(),
      new Set(['member@example.com']), // owner IS in this set
    )

    const postedBody = JSON.parse((mockRequest.mock.calls[0][1] as RequestInit).body as string)
    expect(postedBody.data.fields.content).toBe('Clean content')
  })
```

- [ ] **Step 4: Run all notes tests**

```bash
npx jest src/__tests__/lib/migrators/notes.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/lib/migrators/notes.test.ts
git commit -m "test: add coverage for appendSourceOwnerOnUnassigned flag"
```
