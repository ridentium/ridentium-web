'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ricorrente } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Questa settimana',
  mensile: 'Questo mese',
}

function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  if (frequenza === 'mensile') {
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  }
  return now.toISOString().split('T')[0]
}

interface Props {
  ricorrenti: Ricorrente[]
  Heu{ Ricorrente } from '@/types'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

const FREQ_LABEL: Record<string, string> = {
  giornaliero: 'Oggi',
  settimanale: 'Questa settimana',
  mensile: 'Questo mese',
}

function getPeriodoKey(frequenza: string): string {
  const now = new Date()
  if (frequenza === 'giornaliero') return now.toISOString().split('T')[0]
  if (frequenza === 'settimanale') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() + 1)
    return 'W' + d.toISOString().split('T')[0]
  }
  if (frequenza === 'mensile') {
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  }
  return now.toISOString().split('T')[0]
}

interface Props {
  ricorrenti: Ricorrente[]
  I