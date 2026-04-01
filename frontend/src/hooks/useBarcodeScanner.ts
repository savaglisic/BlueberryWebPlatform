import { useEffect, useRef } from 'react'

const SCANNER_THRESHOLD_MS = 50  // max ms between chars to be considered a scanner
const MIN_BARCODE_LENGTH = 4     // ignore noise shorter than this

/**
 * Listens globally for barcode scanner input (HID keyboard emulation).
 * Scanners fire keystrokes far faster than a human can type and end with Enter.
 * Calls onScan(barcode) when a scan is detected.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef('')
  const lastKeyTime = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      const timeSinceLast = now - lastKeyTime.current
      lastKeyTime.current = now

      // If gap is too large, this is human typing — reset buffer
      if (timeSinceLast > SCANNER_THRESHOLD_MS && buffer.current.length > 0) {
        buffer.current = ''
      }

      if (e.key === 'Enter') {
        const scanned = buffer.current.trim()
        buffer.current = ''
        if (scanned.length >= MIN_BARCODE_LENGTH) {
          onScan(scanned)
        }
      } else if (e.key.length === 1) {
        // Single printable character
        buffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan])
}
