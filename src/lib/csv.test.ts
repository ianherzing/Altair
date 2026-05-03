// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadCsv } from './csv'

describe('downloadCsv', () => {
  let capturedBlobContent: string
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> }
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    capturedBlobContent = ''
    mockAnchor = { href: '', download: '', click: vi.fn() }
    createObjectURLMock = vi.fn(() => 'blob:mock-url')
    revokeObjectURLMock = vi.fn()

    // Capture content passed to Blob constructor
    vi.stubGlobal('Blob', class {
      constructor(content: string[], _options?: BlobPropertyBag) {
        capturedBlobContent = content[0] ?? ''
      }
    })

    // Stub URL methods (not available in node environment)
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })

    // Stub document in node environment — csv.ts only uses createElement('a')
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'a') return mockAnchor
        return {}
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns early without touching the DOM for an empty row array', () => {
    downloadCsv([], 'test.csv')
    expect(mockAnchor.click).not.toHaveBeenCalled()
    expect(createObjectURLMock).not.toHaveBeenCalled()
  })

  it('writes column headers derived from the keys of the first row', () => {
    downloadCsv([{ name: 'Alice', age: 30 }], 'output.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[0]).toBe('name,age')
  })

  it('writes plain string and number values on the data row', () => {
    downloadCsv([{ name: 'Alice', age: 30 }], 'output.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('Alice,30')
  })

  it('quotes values that contain a comma', () => {
    downloadCsv([{ description: 'hello, world' }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('"hello, world"')
  })

  it('quotes values that contain a double-quote and escapes the quote', () => {
    downloadCsv([{ note: 'say "hi"' }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('"say ""hi"""')
  })

  it('quotes values that contain a newline character', () => {
    downloadCsv([{ value: 'line1\nline2' }], 'out.csv')
    // Don't split on \n here — the content itself has an embedded newline
    expect(capturedBlobContent).toContain('"line1\nline2"')
  })

  it('converts null values to empty string', () => {
    downloadCsv([{ present: 'yes', missing: null }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('yes,')
  })

  it('converts boolean values to their string representation', () => {
    downloadCsv([{ active: true, archived: false }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('true,false')
  })

  it('converts number values to strings', () => {
    downloadCsv([{ count: 42, ratio: 3.14 }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines[1]).toBe('42,3.14')
  })

  it('writes all rows in order after the header', () => {
    downloadCsv([
      { name: 'Alice', score: 95 },
      { name: 'Bob', score: 87 },
      { name: 'Carol', score: 100 },
    ], 'scores.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines).toHaveLength(4) // 1 header + 3 data rows
    expect(lines[0]).toBe('name,score')
    expect(lines[1]).toBe('Alice,95')
    expect(lines[2]).toBe('Bob,87')
    expect(lines[3]).toBe('Carol,100')
  })

  it('sets the correct download filename on the anchor element', () => {
    downloadCsv([{ x: 1 }], 'my-report.csv')
    expect(mockAnchor.download).toBe('my-report.csv')
  })

  it('sets the anchor href to the object URL', () => {
    downloadCsv([{ x: 1 }], 'test.csv')
    expect(mockAnchor.href).toBe('blob:mock-url')
  })

  it('triggers a click to initiate the download', () => {
    downloadCsv([{ x: 1 }], 'test.csv')
    expect(mockAnchor.click).toHaveBeenCalledOnce()
  })

  it('revokes the object URL after triggering the download', () => {
    downloadCsv([{ x: 1 }], 'test.csv')
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
  })

  it('handles a single row with a single column', () => {
    downloadCsv([{ value: 'only' }], 'single.csv')
    const lines = capturedBlobContent.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('value')
    expect(lines[1]).toBe('only')
  })

  it('does not quote values that need no escaping', () => {
    downloadCsv([{ id: '123', name: 'plain text' }], 'out.csv')
    const lines = capturedBlobContent.split('\n')
    // 'plain text' has a space but no comma/newline/quote — no quoting needed
    expect(lines[1]).toBe('123,plain text')
  })
})
