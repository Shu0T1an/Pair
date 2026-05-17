import { describe, it, expect } from 'vitest'
import { cn, formatTimestamp, truncateText } from '../utils'

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('should handle tailwind merge (conflicts)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('should handle empty inputs', () => {
    expect(cn()).toBe('')
  })

  it('should handle undefined and null', () => {
    expect(cn('a', undefined, 'b', null)).toBe('a b')
  })
})

describe('formatTimestamp', () => {
  it('should format Date object', () => {
    const date = new Date(2026, 4, 17, 14, 30)
    const result = formatTimestamp(date)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('should format ISO string', () => {
    const result = formatTimestamp('2026-05-17T14:30:00')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('should format timestamp number', () => {
    const result = formatTimestamp(Date.now())
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('should return --:-- for invalid date string', () => {
    expect(formatTimestamp('not-a-date')).toBe('--:--')
  })

  it('should return --:-- for NaN date', () => {
    expect(formatTimestamp('')).toBe('--:--')
  })
})

describe('truncateText', () => {
  it('should return text as-is when shorter than maxLength', () => {
    expect(truncateText('hello', 10)).toBe('hello')
  })

  it('should return text as-is when exactly maxLength', () => {
    expect(truncateText('hello', 5)).toBe('hello')
  })

  it('should truncate and add ellipsis when longer', () => {
    expect(truncateText('hello world', 5)).toBe('hello...')
  })

  it('should handle empty string', () => {
    expect(truncateText('', 5)).toBe('')
  })

  it('should handle maxLength of 0', () => {
    expect(truncateText('test', 0)).toBe('...')
  })
})
