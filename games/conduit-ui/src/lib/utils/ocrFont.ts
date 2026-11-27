// OCR-A (Matthew Skala's, fonts/OCRA.otf), the emblem letters' typeface, set as text. Measured from
// the font: every character advances 0.723 em, and digits and $ stand 0.78 em tall on the baseline.
const Advance = 0.723
const DigitHeight = 0.78

export function ocrTextWidth(text: string, fontSize: number): number {
    return text.length * Advance * fontSize
}

// The dy that centres digits on y with the alphabetic baseline (see docs/phone-rendering.md).
export function ocrCentredShift(fontSize: number): number {
    return (DigitHeight / 2) * fontSize
}
