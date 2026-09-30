export type Papel = 'pendente' | 'admin' | 'gestao' | 'recepcao' | 'profissional'
export interface Perfil { id: string; nome: string; email: string | null; papel: Papel; profissional_id: string | null; ativo: boolean }
export interface Profissional { id: string; nome: string; ativo: boolean }
export interface Produto {
  id: string; tipo: 'plano_semanal' | 'preco_fixo' | 'pacote' | 'avulso'; grupo: string; nome: string; modalidade: string
  capacidade: number | null; frequencia: number | null; periodicidade: string | null; meses: number; valor: number
  sessoes: number | null; validade_meses: number | null; nota: string | null; ordem: number; ativo: boolean
}
export interface Cliente { id: string; nome: string; telefone: string | null; email: string | null; nascimento: string | null; status: 'ativo' | 'inativo' | 'trancado'; obs: string | null; created_at: string }
export interface Contrato {
  id: string; cliente_id: string; produto_id: string | null; profissional_id: string | null; tipo: 'plano' | 'pacote'
  modalidade: string; descricao: string | null; frequencia: number | null; periodicidade: string | null; meses: number
  valor: number | null; sessoes: number | null; inicio: string; vencimento: string | null; status: 'ativo' | 'encerrado'; obs: string | null
}
export interface Horario { id: string; contrato_id: string; dia_semana: number; hora: string }
export type StatusAt = 'confirmado' | 'compareceu' | 'falta' | 'falta_avisada' | 'reposicao' | 'cancelado'
export interface Atendimento { id: string; data: string; hora: string; cliente_id: string; contrato_id: string | null; profissional_id: string | null; origem: 'fixo' | 'extra'; status: StatusAt; obs: string | null }
export interface Pagamento {
  id: string; data: string; cliente_id: string | null; contrato_id: string | null; produto_id: string | null; profissional_id: string | null
  descricao: string | null; modalidade: string | null; valor: number; forma: string; parcelas: number; cv: string | null; nf: string | null
  pagante: string | null; obs: string | null; taxa_pct: number; imposto_pct: number; liquido: number
}
export interface Regra { id: string; profissional_id: string; modalidade: string | null; pct_estudio: number; vigencia_inicio: string }
export interface Repasse {
  id: string; profissional_id: string; competencia: string; origem: 'pagamento' | 'sessao'; pagamento_id: string | null; atendimento_id: string | null
  descricao: string | null; base: number; base_estimada: boolean; pct_estudio: number | null; valor_estudio: number | null; valor_profissional: number | null; created_at: string
}
export interface Uso { contrato_id: string; usadas: number; faltas: number; faltas_avisadas: number }
