const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isUUID(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v) }
export function isEmail(v: unknown): v is string { return typeof v === 'string' && EMAIL_RE.test(v) }
export function isISODate(v: unknown): v is string { return typeof v === 'string' && ISO_DATE_RE.test(v) && !isNaN(Date.parse(v)) }
export function isString(v: unknown, maxLen = 500): v is string { return typeof v === 'string' && v.length > 0 && v.length <= maxLen }
export function isBool(v: unknown): v is boolean { return typeof v === 'boolean' }
export function isNum(v: unknown, min = -Infinity, max = Infinity): v is number { return typeof v === 'number' && !isNaN(v) && v >= min && v <= max }
export function isEnum<T extends string>(v: unknown, values: T[]): v is T { return typeof v === 'string' && values.includes(v as T) }
