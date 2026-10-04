export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_L = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const MESES_PER: Record<string, number> = { Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 }
export const FORMAS = ['Pix', 'Cartão de débito', 'Cartão de crédito', 'Dinheiro', 'Social', 'Hub']
export interface Forma { nome: string; taxa: number; taxa_parcelado?: number | null; imposto: number; ativo: boolean }
export const formasDe = (config: Record<string, any>): Forma[] => Array.isArray(config.formas) && config.formas.length ? config.formas : FORMAS.map(n => ({ nome: n, taxa: 0, imposto: 0, ativo: true }))
export function descontoDe(config: Record<string, any>, forma: string, parcelas: number) {
  const f = formasDe(config).find(x => x.nome.toLowerCase() === forma.toLowerCase())
  if (!f) return { taxa: 0, imposto: 0 }
  const taxa = parcelas > 1 && f.taxa_parcelado != null ? Number(f.taxa_parcelado) : Number(f.taxa || 0)
  return { taxa, imposto: Number(f.imposto || 0) }
}
const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const hoje = () => iso(new Date())
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const addMonths = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1 + n, 1)
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); t.setDate(Math.min(d, last)); return iso(t)
}
export const diff = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 864e5)
export const br = (s?: string | null) => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}` }
export const brl = (v?: number | null) => v == null || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const norm = (s?: string | null) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const hm = (t: string) => t.slice(0, 5)
export const mesLabel = (ym: string) => MESES[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4)
export function modCls(m?: string | null) {
  const n = norm(m)
  if (n.includes('pilates')) return 'm-pilates'
  if (n.includes('reab') || n.includes('laudo')) return 'm-reab'
  if (n.includes('body')) return 'm-body'
  if (n.includes('avalia') || n.includes('bioimp')) return 'm-aval'
  if (n.includes('treino')) return 'm-treino'
  return 'm-outro'
}
export function csv(rows: (string | number | null | undefined)[][]) {
  const q = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\n')
}
export function baixar(nome: string, conteudo: string) {
  const b = new Blob([conteudo], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a')
  a.href = URL.createObjectURL(b); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------- WhatsApp ----------
export const MSG_CONFIRMACAO_PADRAO = 'Olá, {nome}! Tudo bem? Passando para confirmar sua aula de {modalidade} {quando}, às {hora}, com {profissional}, no CareHub Studio. Podemos confirmar sua presença?'
export function telWhats(tel?: string | null) {
  let d = String(tel || '').replace(/\D/g, '').replace(/^0+/, '')
  if (!d) return null
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d.length >= 12 && d.length <= 13 ? d : null
}
export function quando(data: string) {
  const dd = diff(data, hoje())
  if (dd === 0) return 'hoje'
  if (dd === 1) return 'amanhã'
  return `${DIAS_L[parse(data).getDay()].replace('segunda', 'segunda-feira').replace('terça', 'terça-feira').replace('quarta', 'quarta-feira').replace('quinta', 'quinta-feira').replace('sexta', 'sexta-feira')}, ${data.slice(8)}/${data.slice(5, 7)}`
}
export function msgConfirmacao(modelo: string | undefined, v: { nome: string; modalidade: string; data: string; hora: string; profissional: string }) {
  const q = quando(v.data); const prefixo = q === 'hoje' || q === 'amanhã' ? q : (/^(sábado|domingo)/.test(q) ? 'no ' : 'na ') + q
  const rep: Record<string, string> = { nome: v.nome.split(' ')[0], modalidade: v.modalidade, quando: prefixo, data: br(v.data), hora: v.hora.replace(':00', 'h').replace(':', 'h'), profissional: v.profissional }
  return (modelo?.trim() || MSG_CONFIRMACAO_PADRAO).replace(/\{(\w+)\}/g, (m, k) => rep[k] ?? m)
}
export const waLink = (tel: string, msg: string) => `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
