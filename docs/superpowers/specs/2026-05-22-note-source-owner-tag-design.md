# Note Source Owner Tag

**Date:** 2026-05-22  
**Status:** Approved

## Problem

When a note's owner isn't a member of the destination workspace, the migration drops the owner assignment and emits a warning. The original ownership is then invisible in the destination — there's no way to filter or bulk-update notes by their old owner.

## Solution

Add a checkbox to the Notes section of the migration config UI. When checked, notes whose owner can't be assigned in the destination workspace get `\n\nSource Owner: email@email.com` appended to their `content` field. This makes the original owner searchable/filterable in Productboard's note UI.

## Scope

- Only affects notes where the owner email is present but not found in `destMemberEmails`.
- Does not modify notes with no owner, or notes whose owner is successfully assigned.
- Appends to `content` (note body), not `name`/title.

## Changes

### `src/lib/productboard/types.ts` — `MigrationConfig`

Add:
```ts
appendSourceOwnerOnUnassigned?: boolean
```

### `src/components/NoteFilterSelector.tsx` — `NoteFilterConfig`

Add:
```ts
appendSourceOwnerOnUnassigned: boolean
```

Render a traditional `<input type="checkbox">` below the four bucket rows, labeled:  
**"Append source owner to unassigned notes"**  
Description: *Adds "Source Owner: email@email.com" to the bottom of notes whose owner isn't in the destination workspace.*

### `src/lib/migrators/notes.ts` — `migrateNotes`

In the existing unassigned-owner branch (where `ownerEmail` exists but isn't in `destMemberEmails`), after skipping the `owner` field assignment, conditionally append to `fields.content`:

```ts
if (state.config.appendSourceOwnerOnUnassigned) {
  const existing = typeof fields.content === 'string' ? fields.content : ''
  fields.content = existing ? `${existing}\n\nSource Owner: ${ownerEmail}` : `Source Owner: ${ownerEmail}`
}
```

## Non-goals

- No change to notes with a successfully assigned owner.
- No new API calls or data fetching.
- No changes to the warning/error emitted for unassigned owners.
