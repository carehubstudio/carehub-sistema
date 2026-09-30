import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sb } from './supabase'
import type { Cliente, Contrato, Horario, Perfil, Produto, Profissional, Uso } from './types'
import { diff, hoje } from './util'

export interface Base {
  perfil: Perfil
  profissionais: Profissional[]
  produtos: Produto[]
  config: Record<string, any>
  clientes: Map<string, Cliente>
  contratos: Map<string, Contrato>
  horarios: Horario[]
  uso: Map<string, Uso>
  carregado: boolean
  recarregar: () => Promise<void>
  recarregarConfig: () => Promise<void>
  toast: (m: string) => void
}
const Ctx = createContext<Base | null>(null)
export const useBase = () => { const c = useContext(Ctx); if (!c) throw new Error('sem contexto'); return c }

async function todos<T>(tabela: string, order = 'id'): Promise<T[]> {
  const out: T[] = []; let de = 0
  for (;;) {
    const { data, error } = await sb.from(tabela).select('*').order(order).range(de, de + 999)
    if (error) throw error
    out.push(...(data as T[])); if (!data || data.length < 1000) break; de += 1000
  }
  return out
}

export function BaseProvider({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const [profissionais, setProf] = useState<Profissional[]>([])
  const [produtos, setProd] = useState<Produto[]>([])
  const [config, setCfg] = useState<Record<string, any>>({})
  const [clientes, setCli] = useState(new Map<string, Cliente>())
  const [contratos, setCt] = useState(new Map<string, Contrato>())
  const [horarios, setHr] = useState<Horario[]>([])
  const [uso, setUso] = useState(new Map<string, Uso>())
  const [carregado, setCarregado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(x => (x === m ? null : x)), 3200) }, [])

  const recarregarConfig = useCallback(async () => {
    const [p, pr, cf] = await Promise.all([
      todos<Profissional>('profissionais', 'nome'), todos<Produto>('produtos', 'ordem'),
      perfil.papel === 'profissional' ? Promise.resolve([]) : todos<{ chave: string; valor: any }>('configuracoes', 'chave'),
    ])
    setProf(p); setProd(pr); setCfg(Object.fromEntries(cf.map(x => [x.chave, x.valor])))
  }, [perfil.papel])

  const recarregar = useCallback(async () => {
    try {
      const [c, ct, h, u] = await Promise.all([
        todos<Cliente>('clientes', 'nome'), todos<Contrato>('contratos', 'inicio'), todos<Horario>('horarios'), todos<Uso>('contratos_uso', 'contrato_id'),
      ])
      setCli(new Map(c.map(x => [x.id, x]))); setCt(new Map(ct.map(x => [x.id, x]))); setHr(h)
      setUso(new Map(u.map(x => [x.contrato_id, { ...x, usadas: Number(x.usadas), faltas: Number(x.faltas), faltas_avisadas: Number(x.faltas_avisadas) }])))
    } catch (e: any) { toast('Não foi possível carregar os dados: ' + (e.message || e)) }
  }, [toast])

  useEffect(() => {
    Promise.all([recarregarConfig(), recarregar()]).finally(() => setCarregado(true))
    const onFocus = () => { recarregar() }
    window.addEventListener('focus', onFocus)
    const t = setInterval(recarregar, 120000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t) }
  }, [recarregar, recarregarConfig])

  const v = useMemo<Base>(() => ({ perfil, profissionais, produtos, config, clientes, contratos, horarios, uso, carregado, recarregar, recarregarConfig, toast }),
    [perfil, profissionais, produtos, config, clientes, contratos, horarios, uso, carregado, recarregar, recarregarConfig, toast])
  return <Ctx.Provider value={v}>{children}{msg && <div className="toast" role="status">{msg}</div>}</Ctx.Provider>
}

// ---------- regras de negócio ----------
export type StC = 'ok' | 'vence' | 'atrasado' | 'sem' | 'inativo' | 'fim' | 'isento'
export function stContrato(c: Contrato, uso?: Uso): StC {
  if (c.status !== 'ativo') return 'inativo'
  if (c.tipo === 'plano' && c.valor != null && Number(c.valor) === 0) return 'isento'
  if (c.tipo === 'pacote' && c.sessoes && (uso?.usadas || 0) >= c.sessoes) return 'fim'
  if (!c.vencimento) return c.tipo === 'pacote' ? 'ok' : 'sem'
  const d = diff(c.vencimento, hoje())
  if (d < 0) return 'atrasado'; if (d <= 7) return 'vence'; return 'ok'
}
export const RANK: Record<string, number> = { atrasado: 0, vence: 1, fim: 2, sem: 2, ok: 3, isento: 3, inativo: 4 }
export const valorCobranca = (c?: Contrato | null) => !c || c.valor == null ? null : c.tipo === 'pacote' ? Number(c.valor) : Math.round(Number(c.valor) * (c.meses || 1) * 100) / 100
export const tituloContrato = (c: Contrato) => c.descricao || [c.modalidade, c.frequencia ? c.frequencia + '×/sem' : '', c.tipo === 'pacote' && c.sessoes ? c.sessoes + ' sessões' : ''].filter(Boolean).join(' · ')
export function capacidade(c: Contrato | undefined, produtos: Produto[]) {
  if (!c) return 0; const p = produtos.find(x => x.id === c.produto_id); return p?.capacidade || 0
}
