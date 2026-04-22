export interface ImpostazioniStudio {
  giorni_apertura: number[]  // ISO weekday: 1=Lun, 2=Mar, ..., 6=Sab, 7=Dom
  orario_apertura: string    // "HH:MM"
  orario_chiusura: string    // "HH:MM"
}

export const DEFAULT_IMPOSTAZIONI: ImpostazioniStudio = {
  giorni_apertura: [1, 2, 3, 4, 5],
  orario_apertura: '08:30',
  orario_chiusura: '19:30',
}

export const GIORNI_LABEL: Record<number, string> = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica',
}

export const GIORNI_BREVE: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
  7: 'Dom',
}

export function isoWeekday(date: Date): number {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

export function isGiornoApertura(date: Date, giorni: number[]): boolean {
  return giorni.includes(isoWeekday(date))
}
