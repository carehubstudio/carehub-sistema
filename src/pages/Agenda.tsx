import { useCallback, useEffect, useMemo, useState } from 'react'
import { sb } from '../lib/supabase'
import { capacidade, stContrato, tituloContrato, useBase } from '../lib/store'
import type { Atendimento, StatusAt } from '../lib/types'
import { addDays, br, DIAS, DIAS_L, hm, hoje, modCls, norm, parse } from '../lib/util'
import { AtendimentoModal, NovoAgendamento, ST, type Slot } from '../components/forms'
import { Empty } from '../components/ui'

const MOD_LEG = [['m-pilates', 'Pilates'], ['m-treino', 'Treino'], ['m-reab', 'Reabilitação'], ['m-body', 'BodyShape'], ['m-aval', 'Avaliação'], ['m-outro', 'Outros']]

export function useSlots(de: string, ate: string) {
  const { contratos, horarios, clientes } = useBase()
  const [ats, setAts] = useState<Atendimento[]>([])
  const carregar = useCallback(() => {
    sb.from('atendimentos').select('*').gte('data', de).lte('data', ate).then(r => setAts((r.data as Atendimento[]) || []))
  }, [de, ate])
  useEffect(carregar, [carregar])
  const porDia = useMemo(() => {
    const out = new Map<string, Slot[]>()
    for (let d = de; d <= ate; d = addDays(d, 1)) {
      const w = parse(d).getDay(); const list: Slot[] = []
      for (const h of horarios) {
        if (h.dia_semana !== w) continue
        const c = contratos.get(h.contrato_id); if (!c || c.status !== 'ativo' || c.inicio > d) continue
        const cli = clientes.get(c.cliente_id); if (!cli || cli.status !== 'ativo') continue
        const at = ats.find(a => a.origem === 'fixo' && a.contrato_id === c.id && a.data === d && hm(a.hora) === hm(h.hora))
        list.push({ data: d, hora: hm(h.hora), cliente_id: c.cliente_id, contrato_id: c.id, profissional_id: at?.profissional_id || c.profissional_id, at, origem: 'fixo' })
      }
      for (const a of ats) if (a.data === d && a.origem === 'extra') list.push({ data: d, hora: hm(a.hora), cliente_id: a.cliente_id, contrato_id: a.contrato_id, profissional_id: a.profissional_id, at: a, origem: 'extra' })
      out.set(d, list.sort((x, y) => x.hora.localeCompare(y.hora)))
    }
    return out
  }, [de, ate, ats, horarios, contratos, clientes])
  return { porDia, carregar }
}

export function Agenda({ abrirCliente }: { abrirCliente: (id: string) => void }) {
  const { contratos, clientes, profissionais, produtos, uso, perfil } = useBase()
  const [data, setData] = useState(hoje())
  const [modo, setModo] = useState<'dia' | 'semana'>('dia')
  const [prof, setProf] = useState(perfil.papel === 'profissional' ? perfil.profissional_id || '' : '')
  const [mod, setMod] = useState(''); const [st, setSt] = useState<'*' | StatusAt>('*'); const [q, setQ] = useState('')
  const [sel, setSel] = useState<Slot | null>(null); const [novo, setNovo] = useState(false)
  const seg = addDays(data, -((parse(data).getDay() + 6) % 7))
  const de = modo === 'dia' ? data : seg, ate = modo === 'dia' ? data : addDays(seg, 5)
  const { porDia, carregar } = useSlots(de, ate)
  const equipe = perfil.papel !== 'profissional'
  const modOf = (s: Slot) => s.contrato_id ? contratos.get(s.contrato_id)?.modalidade || '' : 'Aula extra'
  const filtra = (s: Slot) => (!prof || s.profissional_id === prof) && (!mod || modOf(s) === mod) && (!q || norm(clientes.get(s.cliente_id)?.nome).includes(norm(q))) && (modo === 'semana' || st === '*' || (s.at?.status || 'confirmado') === st)
  const mods = [...new Set([...contratos.values()].filter(c => c.status === 'ativo').map(c => c.modalidade))].sort()
  const nomeProf = (id: string | null) => profissionais.find(p => p.id === id)?.nome || 'Sem profissional'

  const head = <>
    <div className="viewhead"><div><h1>Agenda</h1><p>{DIAS_L[parse(data).getDay()]} · {br(data)}</p></div>
      <div className="toolbar" style={{ margin: 0 }}>
        <div className="seg"><button aria-pressed={modo === 'dia'} onClick={() => setModo('dia')}>Dia</button><button aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>Semana</button></div>
        {equipe && <button className="btn pri" onClick={() => setNovo(true)}>+ Novo agendamento</button>}
      </div></div>
    <div className="toolbar">
      <div className="datenav"><button className="btn sm" onClick={() => setData(addDays(data, modo === 'dia' ? -1 : -7))} aria-label="Anterior">‹</button>
        <button className={'btn sm ' + (data === hoje() ? '' : 'pri')} onClick={() => setData(hoje())}>Hoje</button>
        <button className="btn sm" onClick={() => setData(addDays(data, modo === 'dia' ? 1 : 7))} aria-label="Próximo">›</button>
        {modo === 'semana' && <strong style={{ minWidth: 0, fontSize: 15 }}>{br(de)} a {br(ate)}</strong>}</div>
      {equipe && <select value={prof} onChange={e => setProf(e.target.value)} aria-label="Profissional"><option value="">Todos os profissionais</option>{profissionais.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
      <select value={mod} onChange={e => setMod(e.target.value)} aria-label="Modalidade"><option value="">Todas as modalidades</option>{mods.map(m => <option key={m}>{m}</option>)}</select>
      {modo === 'dia' && <select value={st} onChange={e => setSt(e.target.value as any)} aria-label="Status"><option value="*">Todos os status</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>}
      <input type="search" placeholder="Buscar cliente" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar cliente" />
    </div>
    <div className="legend">{MOD_LEG.map(([k, l]) => <span className="lg" key={k}><i className={k} />{l}</span>)}<span className="lgsep" />{Object.values(ST).map(v => <span className="lgs" key={v.l}>{v.i} {v.l}</span>)}</div>
  </>
  const modais = <>
    {sel && <AtendimentoModal slot={sel} onClose={() => setSel(null)} onSaved={carregar} abrirCliente={abrirCliente} />}
    {novo && <NovoAgendamento data={data} onClose={() => setNovo(false)} onSaved={carregar} />}
  </>

  if (modo === 'semana') {
    const dias = [0, 1, 2, 3, 4, 5].map(i => addDays(seg, i))
    const cols = dias.map(d => (porDia.get(d) || []).filter(filtra))
    const horas = [...new Set(cols.flat().map(s => s.hora))].sort()
    return <>{head}{!horas.length ? <section className="panel"><Empty t="Semana sem atendimentos">Cadastre os horários fixos nos contratos.</Empty></section> :
      <section className="panel week"><table><thead><tr><th></th>{dias.map(d => <th key={d} className={d === hoje() ? 'today' : ''}><a style={{ cursor: 'pointer' }} onClick={() => { setData(d); setModo('dia') }}>{DIAS[parse(d).getDay()]} {d.slice(8)}/{d.slice(5, 7)}</a></th>)}</tr></thead>
        <tbody>{horas.map(h => <tr key={h}><td>{h}</td>{cols.map((c, i) => <td key={i}>{c.filter(s => s.hora === h).map((s, j) => {
          const ct = s.contrato_id ? contratos.get(s.contrato_id) : undefined; const late = ct && stContrato(ct, uso.get(ct.id)) === 'atrasado'
          return <span key={j} className={'nm ' + modCls(modOf(s)) + (late ? ' late' : '')} title={clientes.get(s.cliente_id)?.nome + ' · ' + nomeProf(s.profissional_id)} onClick={() => setSel(s)}>{(clientes.get(s.cliente_id)?.nome || '').split(' ').slice(0, 2).join(' ')}</span>
        })}</td>)}</tr>)}</tbody></table></section>}{modais}</>
  }

  const itens = (porDia.get(data) || []).filter(filtra)
  const temHorario = [...contratos.values()].some(c => c.status === 'ativo')
  if (!itens.length) return <>{head}<section className="panel"><Empty t="Nenhum atendimento neste dia">{temHorario ? 'Nenhum horário corresponde aos filtros para este dia.' : 'Ainda não há contratos com horário fixo. Cadastre um cliente e o contrato com os horários.'}</Empty></section>{modais}</>
  const ordem = profissionais.map(p => p.id)
  const idx = (x: string) => { const i = ordem.indexOf(x); return i < 0 ? 999 : i }
  const profs = [...new Set(itens.map(s => s.profissional_id || ''))].sort((a, b) => idx(a) - idx(b))
  const horas = [...new Set(itens.map(s => s.hora))].sort()
  return <>{head}
    <section className="calwrap"><div className="cal" style={{ gridTemplateColumns: `64px repeat(${profs.length},minmax(190px,1fr))` }}>
      <div className="ch" />{profs.map(p => <div className="ch" key={p}>{nomeProf(p || null)}</div>)}
      {horas.map(h => <Linha key={h} h={h} profs={profs} itens={itens} onSel={setSel} modOf={modOf} />)}
    </div></section>
    <p className="sub" style={{ marginTop: 10 }}>A cor identifica a modalidade e a etiqueta, o status. Clique no atendimento para registrar comparecimento, falta, reposição ou cancelamento.</p>
    {modais}</>

  function Linha({ h, profs, itens, onSel, modOf }: { h: string; profs: string[]; itens: Slot[]; onSel: (s: Slot) => void; modOf: (s: Slot) => string }) {
    return <><div className="ct">{h}</div>{profs.map(p => {
      const cs = itens.filter(s => s.hora === h && (s.profissional_id || '') === p)
      return <div className="cc" key={p}>{cs.map((s, i) => {
        const ct = s.contrato_id ? contratos.get(s.contrato_id) : undefined; const stt = s.at?.status || 'confirmado'
        const cap = capacidade(ct, produtos); const occ = cap > 1 && ct ? cs.filter(o => o.contrato_id && contratos.get(o.contrato_id)?.modalidade === ct.modalidade && o.at?.status !== 'cancelado').length : 0
        const late = ct && stContrato(ct, uso.get(ct.id)) === 'atrasado'; const u = ct ? uso.get(ct.id) : undefined
        return <button key={i} className={'ag ' + modCls(modOf(s)) + (stt === 'falta' || stt === 'cancelado' || stt === 'falta_avisada' ? ' dim' : '')} onClick={() => onSel(s)}>
          <span className="agtop"><b className={stt === 'cancelado' ? 'strike' : ''}>{(clientes.get(s.cliente_id)?.nome || '').split(' ').slice(0, 2).join(' ')}</b><span className="agst">{ST[stt].i} {ST[stt].l}</span></span>
          <small>{ct ? tituloContrato(ct) : 'Aula extra'}{cap > 1 ? ` · ${occ}/${cap}` : ''}{ct?.tipo === 'pacote' && ct.sessoes ? ` · sessão ${Math.min((u?.usadas || 0) + (stt === 'confirmado' ? 1 : 0), ct.sessoes)}/${ct.sessoes}` : ''}{s.origem === 'extra' ? ' · extra' : ''}</small>
          {late && equipe && <span className="aglate">Pagamento em atraso</span>}
        </button>
      })}</div>
    })}</>
  }
}
