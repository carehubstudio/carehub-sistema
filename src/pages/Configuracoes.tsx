import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useBase } from '../lib/store'
import type { Perfil, Regra } from '../lib/types'
import { br, hoje } from '../lib/util'
import { Confirmar } from '../components/ui'

const PAPEIS: Record<string, string> = { pendente: 'Aguardando liberação', gestao: 'Gestão', recepcao: 'Recepção', profissional: 'Profissional' }

export function Configuracoes() {
  const { profissionais, produtos, config, toast, recarregarConfig, perfil } = useBase()
  const [perfis, setPerfis] = useState<Perfil[]>([]); const [regras, setRegras] = useState<Regra[]>([])
  const [novoProf, setNovoProf] = useState('')
  const [nr, setNr] = useState({ profissional_id: '', modalidade: '', pct_estudio: '', vigencia_inicio: hoje() })
  const [taxas, setTaxas] = useState<Record<string, string>>({}); const [imp, setImp] = useState(''); const [prazo, setPrazo] = useState('')
  const carregar = () => {
    sb.from('perfis').select('*').order('created_at').then(r => setPerfis((r.data as Perfil[]) || []))
    sb.from('regras_repasse').select('*').order('vigencia_inicio', { ascending: false }).then(r => setRegras((r.data as Regra[]) || []))
  }
  useEffect(carregar, [])
  useEffect(() => {
    setTaxas(Object.fromEntries(Object.entries(config.taxas || {}).map(([k, v]) => [k, String(v)])))
    setImp(String(config.imposto_pct ?? 0)); setPrazo(String(config.prazo_aviso_falta_horas ?? 12))
  }, [config])
  const mods = [...new Set(produtos.map(p => p.modalidade))].sort()
  const nome = (id: string) => profissionais.find(p => p.id === id)?.nome || '—'
  const ok = (r: { error: any }, msg: string) => { if (r.error) { toast('Não foi possível salvar: ' + r.error.message); return false } toast(msg); return true }

  async function atualizaPerfil(id: string, patch: Partial<Perfil>) { if (ok(await sb.from('perfis').update(patch).eq('id', id), 'Usuário atualizado')) carregar() }
  async function addProf() { if (!novoProf.trim()) return; if (ok(await sb.from('profissionais').insert({ nome: novoProf.trim() }), 'Profissional incluído')) { setNovoProf(''); recarregarConfig() } }
  async function addRegra() {
    if (!nr.profissional_id || nr.pct_estudio === '') return toast('Escolha o profissional e o percentual do estúdio.')
    if (ok(await sb.from('regras_repasse').insert({ ...nr, modalidade: nr.modalidade || null, pct_estudio: Number(nr.pct_estudio) }), 'Regra incluída. Use “Recalcular mês” no Repasse para aplicá-la a lançamentos já feitos.')) { setNr({ ...nr, pct_estudio: '' }); carregar() }
  }
  async function salvarFin() {
    const t = Object.fromEntries(Object.entries(taxas).map(([k, v]) => [k, Number(v) || 0]))
    const r = await sb.from('configuracoes').upsert([{ chave: 'taxas', valor: t }, { chave: 'imposto_pct', valor: Number(imp) || 0 }, { chave: 'prazo_aviso_falta_horas', valor: Number(prazo) || 0 }])
    if (ok(r, 'Taxas e imposto salvos. Valem para os próximos pagamentos.')) recarregarConfig()
  }
  return <>
    <div className="viewhead"><div><h1>Configurações</h1><p>Usuários, profissionais, regras de repasse, taxas e imposto</p></div></div>
    <div className="cfggrid">
      <section className="panel"><header><div><h2>Usuários</h2><p>Cada pessoa cria o próprio acesso em “Criar conta” na tela de entrada. Depois, libere aqui com o perfil certo.</p></div></header>
        <div className="tbl"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Profissional</th><th></th></tr></thead><tbody>
          {perfis.map(u => <tr key={u.id}><td><b>{u.nome || u.email}</b><div className="sub">{u.email}</div></td>
            <td><select aria-label="Perfil" value={u.papel} disabled={u.id === perfil.id} onChange={e => atualizaPerfil(u.id, { papel: e.target.value as any })}>{Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><select aria-label="Profissional vinculado" value={u.profissional_id || ''} onChange={e => atualizaPerfil(u.id, { profissional_id: e.target.value || null })}><option value="">—</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></td>
            <td>{u.id !== perfil.id && <button className="btn sm ghost" onClick={() => atualizaPerfil(u.id, { ativo: !u.ativo })}>{u.ativo ? 'Bloquear' : 'Desbloquear'}</button>}</td></tr>)}
        </tbody></table></div>
        <p className="sub" style={{ padding: '0 16px 12px' }}>Gestão vê tudo. Recepção opera agenda, clientes e pagamentos, mas não vê repasse nem corrige pagamentos. Profissional vê só a própria agenda, os próprios alunos e o próprio repasse.</p></section>

      <section className="panel"><header><div><h2>Regras de repasse</h2><p>Percentual que fica com o <b>estúdio</b>, sobre o valor líquido de taxa e imposto. Regra por modalidade vale antes da regra geral do profissional.</p></div></header>
        <div className="tbl"><table><thead><tr><th>Profissional</th><th>Modalidade</th><th className="num">% estúdio</th><th className="num">% profissional</th><th>Desde</th><th></th></tr></thead><tbody>
          {regras.map(r => <tr key={r.id}><td>{nome(r.profissional_id)}</td><td className="sub">{r.modalidade || 'Todas'}</td><td className="num">{r.pct_estudio}%</td><td className="num">{100 - r.pct_estudio}%</td><td className="num">{br(r.vigencia_inicio)}</td>
            <td><Confirmar className="btn sm ghost" label="Excluir" onConfirm={async () => { if (ok(await sb.from('regras_repasse').delete().eq('id', r.id), 'Regra excluída')) carregar() }} /></td></tr>)}
          {!regras.length && <tr><td colSpan={6} className="sub">Nenhuma regra ainda. Sem regra, o repasse aparece como “sem regra” e não é calculado.</td></tr>}
        </tbody></table></div>
        <div className="pbody inline" style={{ borderTop: '1px solid var(--line)' }}>
          <select aria-label="Profissional" value={nr.profissional_id} onChange={e => setNr({ ...nr, profissional_id: e.target.value })}><option value="">Profissional…</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          <select aria-label="Modalidade" value={nr.modalidade} onChange={e => setNr({ ...nr, modalidade: e.target.value })}><option value="">Todas as modalidades</option>{mods.map(m => <option key={m}>{m}</option>)}</select>
          <input aria-label="% do estúdio" type="number" min="0" max="100" step="0.5" placeholder="% estúdio" style={{ width: 110 }} value={nr.pct_estudio} onChange={e => setNr({ ...nr, pct_estudio: e.target.value })} />
          <input aria-label="Vigência" type="date" value={nr.vigencia_inicio} onChange={e => setNr({ ...nr, vigencia_inicio: e.target.value })} />
          <button className="btn pri" onClick={addRegra}>Incluir regra</button>
        </div></section>

      <section className="panel"><header><div><h2>Taxas e imposto</h2><p>Descontados do valor pago antes de calcular o repasse. Cada pagamento guarda a taxa da data em que foi lançado.</p></div></header>
        <div className="pbody" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {Object.keys(taxas).map(k => <label className="f" key={k}>{k} (%)<input type="number" step="0.01" min="0" value={taxas[k]} onChange={e => setTaxas({ ...taxas, [k]: e.target.value })} /></label>)}
          <label className="f">Imposto sobre receita (%)<input type="number" step="0.01" min="0" value={imp} onChange={e => setImp(e.target.value)} /></label>
          <label className="f">Aviso mínimo de falta (horas)<input type="number" step="1" min="0" value={prazo} onChange={e => setPrazo(e.target.value)} /></label>
        </div>
        <div className="pbody" style={{ borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}><button className="btn pri" onClick={salvarFin}>Salvar</button></div></section>

      <section className="panel"><header><div><h2>Profissionais</h2></div></header>
        <div className="pbody listx">{profissionais.map(p => <div key={p.id}><span>{p.nome}{!p.ativo && <span className="tag">inativo</span>}</span>
          <button className="btn sm ghost" onClick={async () => { if (ok(await sb.from('profissionais').update({ ativo: !p.ativo }).eq('id', p.id), 'Profissional atualizado')) recarregarConfig() }}>{p.ativo ? 'Desativar' : 'Reativar'}</button></div>)}</div>
        <div className="pbody inline" style={{ borderTop: '1px solid var(--line)' }}><input aria-label="Nome" placeholder="Nome do profissional" value={novoProf} onChange={e => setNovoProf(e.target.value)} /><button className="btn" onClick={addProf}>Incluir</button></div></section>
    </div>
  </>
}
