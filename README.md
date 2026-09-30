# CareHub Studio · Sistema de gestão

App web do estúdio: agenda por horário fixo, clientes, contratos, planos e valores, financeiro, repasse e usuários com perfis de acesso.

- **Frontend:** React + TypeScript + Vite, publicado na Vercel.
- **Banco e login:** Supabase (região São Paulo). As regras de acesso (RLS) e os cálculos de taxa, imposto e repasse ficam no banco, em `supabase/migrations`.

## Perfis
| Perfil | Acesso |
|---|---|
| Gestão | Tudo, inclusive repasse, regras, taxas, usuários e correção de pagamentos |
| Recepção | Agenda, clientes, contratos, lançamento de pagamentos. Não vê repasse. |
| Profissional | Só a própria agenda, os próprios alunos e o próprio repasse |

## Regras de repasse
- Percentual cadastrado = parte do **estúdio** (FEE). O profissional recebe o restante.
- Base = valor pago − taxa da forma de pagamento − imposto (percentuais em Configurações, gravados no pagamento).
- Planos e avulsos: repasse no mês do pagamento. Pacotes: a cada sessão realizada (compareceu, reposição ou falta sem aviso). Falta avisada com antecedência não consome sessão.

## Desenvolvimento
```
cp .env.example .env.local
npm install
npm run dev
```
