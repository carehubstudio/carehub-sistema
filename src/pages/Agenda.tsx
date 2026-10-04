import { useCallback, useEffect, useMemo, useState } from 'react'
import { sb } from '../lib/supabase'
import { capacidade, stContrato, tituloContrato, useBase } from '../lib/store'
import type { Atendimento, StatusAt } from '../lib/types'
import { addDays, br, DIAS, DIAS_L, hm, hoje, modCls, msgConfirmacao, norm, parse, telWhats, waLink } from '../lib/util'
import { AtendimentoModal, NovoAgendamento, ST, type Slot } from '../components/forms'
import { Empty, Modal } from '../components/ui'

// Grade fixa da agenda: das 5h às 21h (horários fora disso aparecem também, se houver)
const GRADE = Array.from({ length: 17 }, (_, i) => String(i + 5).padStart(2, '0') + ':00')
const comGrade = (hs: string[]) => [...new Set([...GRADE, ...hs])].sort()

const MOD_LEG = [['m-pilates', 'Pilates'], ['m-treino', 'Treino'], ['m-reab', 'Reabilitação'], ['m-body', 'BodyShape'], ['m-aval', 'Avaliação'], ['m-outro', 'Outros']]

// Atendimento que não consome sessão do pacote (a série de horários fixos se estende)
const NAO_CONSOME = new Set(['falta_avisada', 'cancelado'])

export function useSlots(de: string, ate: string) {
  const { contratos, horarios, clientes } = useBase()
  const [ats, setAts] = useState<Atendimento[]>([])
  const [atsPac, setAtsPac] = useState<Atendimento[]>([])
  const pacIds = useMemo(() => [...contratos.values()].filter(c => c.tipo === 'pacote' && c.sessoes && c.status === 'ativo').map(c => c.id).sort().join(','), [contratos])
  const carregar = useCallback(() => {
    sb.from('atendimentos').select('*').gte('data', de).lte('data', ate).then(r => setAts((r.data as Atendimento[]) || []))
    if (pacIds) sb.from('atendimentos').select('*').in('contrato_id', pacIds.split(',')).lte('data', ate).then(r => setAtsPac((r.data as Atendimento[]) || []))
    else setAtsPac([])
  }, [de, ate, pacIds])
  useEffect(carregar, [carregar])

  // Pacotes: os horários fixos aparecem só até completar o número de sessões (e dentro da validade).
  // Conta em ordem cronológica: horários fixos e agendamentos extras do pacote; falta avisada e cancelamento não contam.
  const pacote = useMemo(() => {
    const out = new Map<string, Map<string, number>>() // contrato -> (data|hora -> nº da sessão; 0 = além do limite)
    for (const c of contratos.values()) {
      if (c.tipo !== 'pacote' || !c.sessoes || c.status !== 'ativo') continue
      const hs = horarios.filter(h => h.contrato_id === c.id)
      const meus = atsPac.filter(a => a.contrato_id === c.id)
      const fim = c.vencimento && c.vencimento < ate ? c.vencimento : ate
      const ev: { k: string; st: string; extra: boolean }[] = []
      if (hs.length) for (let d = c.inicio; d <= fim; d = addDays(d, 1)) {
        const w = parse(d).getDay()
        for (const h of hs) if (h.dia_semana === w) {
          const a = meus.find(x => x.origem === 'fixo' && x.data === d && hm(x.hora) === hm(h.hora))
          ev.push({ k: d + '|' + hm(h.hora), st: a?.status || 'confirmado', extra: false })
        }
      }
      for (const a of meus) if (a.origem === 'extra') ev.push({ k: a.data + '|' + hm(a.hora), st: a.status, extra: true })
      ev.sort((x, y) => x.k.localeCompare(y.k))
      const m = new Map<string, number>(); let n = 0
      for (const e of ev) {
        if (NAO_CONSOME.has(e.st)) { m.set((e.extra ? 'x' : '') + e.k, -1); continue }
        if (n < c.sessoes) { n++; m.set((e.extra ? 'x' : '') + e.k, n) } else m.set((e.extra ? 'x' : '') + e.k, 0)
      }
      out.set(c.id, m)
    }
    return out
  }, [contratos, horarios, atsPac, ate])

  const porDia = useMemo(() => {
    const out = new Map<string, Slot[]>()
    for (let d = de; d <= ate; d = addDays(d, 1)) {
      const w = parse(d).getDay(); const list: Slot[] = []
      for (const h of horarios) {
        if (h.dia_semana !== w) continue
        const c = contratos.get(h.contrato_id); if (!c || c.inicio > d) continue
        const at = ats.find(a => a.origem === 'fixo' && a.contrato_id === c.id && a.data === d && hm(a.hora) === hm(h.hora))
        // contrato encerrado ou cliente inativo: só mostra o que já foi registrado (histórico)
        const cli = clientes.get(c.cliente_id)
        if ((c.status !== 'ativo' || !cli || cli.status !== 'ativo') && !at) continue
        let n: number | undefined
        if (c.tipo === 'pacote' && c.sessoes && c.status === 'ativo') {
          const v = pacote.get(c.id)?.get(d + '|' + hm(h.hora))
          if (!at && (v === undefined || v === 0)) continue // além do nº de sessões ou fora da validade
          if (v && v > 0) n = v
        }
        list.push({ data: d, hora: hm(h.hora), cliente_id: c.cliente_id, contrato_id: c.id, profissional_id: at?.profissional_id || c.profissional_id, at, origem: 'fixo', n })
      }
      for (const a of ats) if (a.data === d && a.origem === 'extra') {
        const v = a.contrato_id ? pacote.get(a.contrato_id)?.get('x' + d + '|' + hm(a.hora)) : undefined
        list.push({ data: d, hora: hm(a.hora), cliente_id: a.cliente_id, contrato_id: a.contrato_id, profissional_id: a.profissional_id, at: a, origem: 'extra', n: v && v > 0 ? v : undefined })
      }
      out.set(d, list.sort((x, y) => x.hora.localeCompare(y.hora)))
    }
    return out
  }, [de, ate, ats, horarios, contratos, clientes, pacote])
  return { porDia, carregar }
}

export function Agenda({ abrirCliente }: { abrirCliente: (id: string) => void }) {
  const { contratos, clientes, profissionais, produtos, uso, perfil } = useBase()
  const [data, setData] = useState(hoje())
  const [modo, setModo] = useState<'dia' | 'semana'>('dia')
  const [prof, setProf] = useState(perfil.papel === 'profissional' ? perfil.profissional_id || '' : '')
  const [mod, setMod] = useState(''); const [st, setSt] = useState<'*' | StatusAt>('*'); const [q, setQ] = useState('')
  const [sel, setSel] = useState<Slot | null>(null); const [novo, setNovo] = useState<false | { hora?: string; prof?: string; data?: string }>(false); const [whats, setWhats] = useState(false)
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
        {equipe && modo === 'dia' && <button className="btn" onClick={() => setWhats(true)}>Confirmar pelo WhatsApp</button>}
        {equipe && <button className="btn pri" onClick={() => setNovo({})}>+ Novo agendamento</button>}
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
    {novo && <NovoAgendamento data={novo.data || data} hora={novo.hora} profissional={novo.prof} onClose={() => setNovo(false)} onSaved={carregar} />}
    {whats && <ConfirmarWhats itens={(porDia.get(data) || []).filter(filtra)} onClose={() => setWhats(false)} />}
  </>

  if (modo === 'semana') {
    const dias = [0, 1, 2, 3, 4, 5].map(i => addDays(seg, i))
    const cols = dias.map(d => (porDia.get(d) || []).filter(filtra))
    const horas = comGrade(cols.flat().map(s => s.hora))
    return <>{head}{
      <section className="panel week"><table><thead><tr><th></th>{dias.map(d => <th key={d} className={d === hoje() ? 'today' : ''}><a style={{ cursor: 'pointer' }} onClick={() => { setData(d); setModo('dia') }}>{DIAS[parse(d).getDay()]} {d.slice(8)}/{d.slice(5, 7)}</a></th>)}</tr></thead>
        <tbody>{horas.map(h => <tr key={h}><td>{h}</td>{cols.map((c, i) => <td key={i} className={equipe ? 'livre' : ''} onClick={e => { if (equipe && e.target === e.currentTarget) setNovo({ data: dias[i], hora: h, prof: prof || undefined }) }}>{c.filter(s => s.hora === h).map((s, j) => {
          const ct = s.contrato_id ? contratos.get(s.contrato_id) : undefined; const late = ct && stContrato(ct, uso.get(ct.id)) === 'atrasado'
          return <span key={j} className={'nm ' + modCls(modOf(s)) + (late ? ' late' : '')} title={clientes.get(s.cliente_id)?.nome + ' · ' + nomeProf(s.profissional_id)} onClick={() => setSel(s)}>{(clientes.get(s.cliente_id)?.nome || '').split(' ').slice(0, 2).join(' ')}</span>
        })}</td>)}</tr>)}</tbody></table></section>}{modais}</>
  }

  const itens = (porDia.get(data) || []).filter(filtra)
  const ordem = profissionais.map(p => p.id)
  const idx = (x: string) => { const i = ordem.indexOf(x); return i < 0 ? 999 : i }
  // colunas: o profissional filtrado, ou todos os ativos (mais quem tiver atendimento no dia)
  const base = prof ? [prof] : profissionais.filter(p => p.ativo).map(p => p.id)
  const profs = [...new Set([...base, ...itens.map(s => s.profissional_id || '')])].sort((a, b) => idx(a) - idx(b))
  if (!profs.length) return <>{head}<section className="panel"><Empty t="Nenhum profissional ativo">Cadastre os profissionais em Configurações.</Empty></section>{modais}</>
  const horas = comGrade(itens.map(s => s.hora))
  return <>{head}
    <section className="calwrap"><div className="cal" style={{ gridTemplateColumns: `64px repeat(${profs.length},minmax(190px,1fr))` }}>
      <div className="ch" />{profs.map(p => <div className="ch" key={p}>{nomeProf(p || null)}</div>)}
      {horas.map(h => <Linha key={h} h={h} profs={profs} itens={itens} onSel={setSel} modOf={modOf} />)}
    </div></section>
    <p className="sub" style={{ marginTop: 10 }}>A cor identifica a modalidade e a etiqueta, o status. Clique no atendimento para registrar comparecimento, falta, reposição ou cancelamento{equipe ? '; clique num espaço vazio para agendar naquele horário' : ''}.</p>
    {modais}</>

  function Linha({ h, profs, itens, onSel, modOf }: { h: string; profs: string[]; itens: Slot[]; onSel: (s: Slot) => void; modOf: (s: Slot) => string }) {
    return <><div className="ct">{h}</div>{profs.map(p => {
      const cs = itens.filter(s => s.hora === h && (s.profissional_id || '') === p)
      return <div className={'cc' + (equipe ? ' livre' : '')} key={p} onClick={e => { if (equipe && e.target === e.currentTarget) setNovo({ hora: h, prof: p || undefined }) }}>{cs.map((s, i) => {
        const ct = s.contrato_id ? contratos.get(s.contrato_id) : undefined; const stt = s.at?.status || 'confirmado'
        const cap = capacidade(ct, produtos); const occ = cap > 1 && ct ? cs.filter(o => o.contrato_id && contratos.get(o.contrato_id)?.modalidade === ct.modalidade && o.at?.status !== 'cancelado').length : 0
        const late = ct && stContrato(ct, uso.get(ct.id)) === 'atrasado'; const u = ct ? uso.get(ct.id) : undefined
        return <button key={i} className={'ag ' + modCls(modOf(s)) + (stt === 'falta' || stt === 'cancelado' || stt === 'falta_avisada' ? ' dim' : '')} onClick={() => onSel(s)}>
          <span className="agtop"><b className={stt === 'cancelado' ? 'strike' : ''}>{(clientes.get(s.cliente_id)?.nome || '').split(' ').slice(0, 2).join(' ')}</b><span className="agst">{ST[stt].i} {ST[stt].l}</span></span>
          <small>{ct ? tituloContrato(ct) : 'Aula extra'}{cap > 1 ? ` · ${occ}/${cap}` : ''}{ct?.tipo === 'pacote' && ct.sessoes && s.n ? ` · sessão ${s.n}/${ct.sessoes}` : ''}{s.origem === 'extra' ? ' · extra' : ''}</small>
          {late && equipe && <span className="aglate">Pagamento em atraso</span>}
        </button>
      })}</div>
    })}</>
  }
}

// Lista do dia para enviar a confirmação de presença pelo WhatsApp (abre o WhatsApp com a mensagem pronta)
function ConfirmarWhats({ itens, onClose }: { itens: Slot[]; onClose: () => void }) {
  const { clientes, contratos, profissionais, config } = useBase()
  const [enviados, setEnviados] = useState<Set<string>>(new Set())
  const lista = itens.filter(s => !['cancelado', 'falta_avisada'].includes(s.at?.status || 'confirmado'))
  return <Modal title="Confirmar presença pelo WhatsApp" onClose={onClose}>
    <div className="pbody" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="sub" style={{ margin: 0 }}>Cada botão abre o WhatsApp com a mensagem pronta para o aluno. Confira e toque em enviar. Quando o aluno responder, registre na agenda se for o caso.</p>
      {!lista.length && <p className="sub">Nenhum atendimento para confirmar neste dia.</p>}
      <div className="listx">{lista.map((s, i) => {
        const cli = clientes.get(s.cliente_id); const ct = s.contrato_id ? contratos.get(s.contrato_id) : undefined
        const tel = telWhats(cli?.telefone); const k = s.data + s.hora + s.cliente_id
        const msg = msgConfirmacao(config.msg_confirmacao, { nome: cli?.nome || '', modalidade: ct?.modalidade || 'aula', data: s.data, hora: s.hora, profissional: profissionais.find(p => p.id === s.profissional_id)?.nome || 'a equipe' })
        return <div key={i}><span><b>{s.hora}</b> · {cli?.nome}{enviados.has(k) && <span className="tag">aberto</span>}</span>
          {tel ? <a className={'btn sm ' + (enviados.has(k) ? 'ghost' : 'pri')} href={waLink(tel, msg)} target="_blank" rel="noopener" onClick={() => setEnviados(new Set(enviados).add(k))}>WhatsApp</a> : <span className="sub">sem celular no cadastro</span>}</div>
      })}</div>
    </div>
  </Modal>
}
