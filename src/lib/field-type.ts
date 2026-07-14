export interface FieldSchema {
  type: string
  format?: string
  required?: string[]
  constraints?: { maxLength?: number }
}

/**
 * Derives a human-readable field type label from a Productboard field schema.
 * Used consistently across FieldSelector, MappingPanel, etc.
 */
export function deriveFieldType(schema: FieldSchema): string {
  if (schema.required?.includes('id') && schema.required?.includes('email')) return 'Member'
  if (schema.type === 'string' && schema.format === 'date') return 'Date'
  if (schema.type === 'string' && schema.constraints?.maxLength === 1048576) return 'Description'
  if (schema.type === 'string') return 'Text'
  if (schema.type === 'array') return 'Multi-select'
  if (schema.type === 'object') return 'Single select'
  return schema.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Returns true for field types that have a discrete set of named values (single/multi-select). */
export function isSelectType(schema: FieldSchema): boolean {
  return schema.type === 'array' || schema.type === 'object'
}
