import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatRowCount(count: number): string {
  if (count === 1) return '1 row'
  return `${count.toLocaleString()} rows`
}

export function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// PostgreSQL OID to type name mapping (common types)
const PG_TYPE_MAP: Record<number, string> = {
  16: 'bool',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'int8',
  21: 'int2',
  23: 'int4',
  25: 'text',
  26: 'oid',
  114: 'json',
  142: 'xml',
  600: 'point',
  700: 'float4',
  701: 'float8',
  790: 'money',
  829: 'macaddr',
  869: 'inet',
  650: 'cidr',
  1000: 'bool[]',
  1005: 'int2[]',
  1007: 'int4[]',
  1009: 'text[]',
  1014: 'char[]',
  1015: 'varchar[]',
  1016: 'int8[]',
  1021: 'float4[]',
  1022: 'float8[]',
  1042: 'bpchar',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1266: 'timetz',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
  3807: 'jsonb[]',
}

export function pgTypeIdToName(dataTypeID: number): string {
  return PG_TYPE_MAP[dataTypeID] ?? `oid:${dataTypeID}`
}
