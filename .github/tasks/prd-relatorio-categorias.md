# PRD: Relatório de Categorias por Período

## 1. Introdução/Overview

O Relatório de Categorias por Período é uma nova feature que permite aos usuários visualizar e analisar seus gastos e receitas organizados por categoria ao longo do tempo. Esta funcionalidade oferece uma visão consolidada em formato de tabela, mostrando como cada categoria se comporta mês a mês, facilitando a identificação de padrões de gastos e tendências financeiras.

**Problema que resolve:** Atualmente, os usuários podem ver gastos por categoria apenas no período atual (card "Categorias por Despesas" no dashboard). Não existe uma forma simples de comparar o comportamento de múltiplas categorias ao longo de vários meses simultaneamente.

**Goal:** Fornecer uma visualização tabular intuitiva que permita aos usuários acompanhar a evolução de seus gastos/receitas por categoria ao longo de um período customizável, com indicadores visuais de tendências.

## 2. Goals

1. Permitir análise comparativa de gastos/receitas entre diferentes meses
2. Facilitar identificação de tendências e padrões de comportamento financeiro por categoria
3. Oferecer filtros flexíveis (categorias específicas e período customizado)
4. Proporcionar indicadores visuais claros de variação mensal (setas e percentuais)
5. Permitir exportação dos dados para análise externa (CSV, Excel, PDF)
6. Integrar com o dashboard existente através do card "Categorias por Despesas"

## 3. User Stories

### US1: Visualização de Período Customizado

**Como** usuário do Opensheets  
**Eu quero** selecionar uma data inicial e final  
**Para que** eu possa ver o comportamento das minhas categorias em qualquer período de tempo

### US2: Filtragem por Categorias Específicas

**Como** usuário com muitas categorias cadastradas  
**Eu quero** selecionar apenas as categorias que me interessam  
**Para que** a tabela fique mais focada e fácil de analisar

### US3: Análise de Tendências

**Como** usuário preocupado com controle financeiro  
**Eu quero** ver setas e percentuais de variação mês a mês  
**Para que** eu identifique rapidamente se meus gastos em cada categoria estão aumentando ou diminuindo

### US4: Exportação de Dados

**Como** usuário que precisa fazer análises externas  
**Eu quero** exportar os dados do relatório em diferentes formatos  
**Para que** eu possa usar em planilhas, apresentações ou compartilhar com terceiros

### US5: Acesso Rápido via Dashboard

**Como** usuário que já visualiza categorias no dashboard  
**Eu quero** clicar em "Ver mais detalhes" no card existente  
**Para que** eu acesse rapidamente o relatório completo sem navegar pelo menu

### US6: Visão Mobile Simplificada

**Como** usuário mobile  
**Eu quero** ver os dados em formato de cards empilhados  
**Para que** eu consiga visualizar confortavelmente sem scroll horizontal complexo

## 4. Functional Requirements

### FR1: Navegação e Acesso

- FR1.1: Adicionar nova seção "Relatórios" no sidebar de navegação
- FR1.2: Adicionar subitem "Categorias" dentro de "Relatórios"
- FR1.3: Rota da página deve ser `/relatorios/categorias`
- FR1.4: Adicionar botão "Ver mais detalhes" no card "Categorias por Despesas" do dashboard que redireciona para o relatório

### FR2: Filtros

- FR2.1: Implementar filtro de **categorias** (multiselect) que permite:
  - Selecionar múltiplas categorias simultaneamente
  - Opção "Todas as categorias" (padrão)
  - Busca/pesquisa por nome de categoria
  - Mostrar ícone da categoria no select
- FR2.2: Implementar filtro de **data inicial** (date picker)
- FR2.3: Implementar filtro de **data final** (date picker)
- FR2.4: Validação: data final deve ser >= data inicial
- FR2.5: Período padrão ao abrir a página: últimos 6 meses
- FR2.6: Filtros devem persistir na URL (query params) para permitir compartilhamento

### FR3: Estrutura da Tabela

- FR3.1: Layout da tabela:
  - **Primeira coluna**: Nome da categoria com ícone
  - **Colunas seguintes**: Um mês por coluna (formato "MMM/YYYY", ex: "Jan/2025")
  - **Última coluna**: Total da categoria (soma de todos os meses)
- FR3.2: Última linha da tabela mostra **totais por mês** (soma de todas categorias)
- FR3.3: Célula inferior direita mostra **total geral** (soma de tudo)
- FR3.4: Mostrar apenas categorias de **despesas e receitas** (ambas mescladas)
- FR3.5: Diferenciar visualmente despesas (vermelho) e receitas (verde) através de badges ou cores

### FR4: Dados das Células

- FR4.1: Cada célula mostra o valor gasto/recebido naquela categoria naquele mês
- FR4.2: Formato: "R$ X.XXX,XX" (padrão brasileiro)
- FR4.3: Quando não há transações, mostrar "R$ 0,00"
- FR4.4: Valores de despesa devem ser mostrados como positivos (não negativos)

### FR5: Indicadores de Variação

- FR5.1: Abaixo de cada valor, mostrar indicador comparando com o mês anterior:
  - **Seta para cima (↑)** + percentual em vermelho: aumento em despesas OU diminuição em receitas
  - **Seta para baixo (↓)** + percentual em verde: diminuição em despesas OU aumento em receitas
  - **Traço (-)**: sem variação ou primeiro mês do período
- FR5.2: Cálculo da variação: `((valor_atual - valor_anterior) / valor_anterior) * 100`
- FR5.3: Não mostrar indicador na primeira coluna de mês (não há comparação)
- FR5.4: Quando mês anterior é R$ 0,00 e atual > 0, mostrar "novo" ou "+100%"
- FR5.5: Formato do percentual: "±X%" (sem casas decimais) ou "±X.X%" (uma casa decimal se < 10%)

### FR6: Ordenação

- FR6.1: Ordenação padrão: **maior gasto total** no período (descendente)
- FR6.2: Categorias de despesa aparecem primeiro, depois receitas
- FR6.3: Dentro de cada tipo, ordenar por total decrescente
- FR6.4: Linha de totais sempre fixada no rodapé da tabela

### FR7: Exportação

- FR7.1: Botão "Exportar" com dropdown oferecendo 3 opções:
  - Exportar como CSV
  - Exportar como Excel (.xlsx)
  - Exportar como PDF
- FR7.2: Nome do arquivo exportado: `relatorio-categorias-[data-inicial]-[data-final].[extensao]`
- FR7.3: Arquivo deve incluir:
  - Dados filtrados atualmente na tela
  - Indicadores de variação (como texto no CSV/Excel)
  - Linha e coluna de totais
  - Cabeçalho com período e data de geração
- FR7.4: PDF deve incluir formatação visual (cores, ícones se possível)

### FR8: Responsividade (Mobile)

- FR8.1: Em telas < 768px, transformar tabela em **cards empilhados**
- FR8.2: Cada card representa uma categoria:
  - Cabeçalho: ícone + nome da categoria + total
  - Corpo: lista de meses com valores e indicadores
  - Meses colapsados por padrão (accordion)
- FR8.3: Card de "Totais Gerais" ao final
- FR8.4: Filtros devem continuar acessíveis no topo

### FR9: Estados e Feedback

- FR9.1: Loading state durante carregamento inicial
- FR9.2: Loading state durante aplicação de filtros
- FR9.3: Empty state quando nenhuma categoria selecionada
- FR9.4: Empty state quando não há dados no período
- FR9.5: Toast de sucesso após exportação
- FR9.6: Toast de erro se exportação falhar

### FR10: Performance

- FR10.1: Limitar período máximo a 24 meses
- FR10.2: Implementar paginação ou scroll virtual se > 50 categorias
- FR10.3: Debounce em filtros (300ms)
- FR10.4: Cache de dados no cliente (react-query ou similar)

## 5. Non-Goals (Out of Scope)

1. **Gráficos visuais** - Esta versão foca em tabela. Gráficos podem vir em futuras iterações
2. **Comparação entre pagadores** - O relatório considera apenas o pagador admin/principal
3. **Edição inline de valores** - Relatório é apenas visualização, não edição
4. **Filtros avançados** (por estabelecimento, cartão, etc.) - Apenas categoria e período nesta versão
5. **Alertas automáticos** - Não haverá notificações baseadas em tendências detectadas
6. **Previsões/projeções** - Apenas dados históricos, sem análise preditiva
7. **Subcategorias** - Se existirem no sistema, serão tratadas como categorias independentes
8. **Comparação com orçamentos** - Foco apenas em valores reais, não comparação com orçado

## 6. Design Considerations

### Layout da Página

```
┌─────────────────────────────────────────────────────────┐
│ [Breadcrumb: Relatórios > Categorias]                   │
│                                                          │
│ Relatório de Categorias por Período                     │
│ Acompanhe a evolução dos seus gastos e receitas         │
│                                                          │
│ ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │Categorias ▼ │ │Data Inic.│ │Data Final│ │Exportar▼│ │
│ └─────────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐│
│ │ Categoria  │ Jan/25  │ Fev/25  │ Mar/25  │ Total    ││
│ ├────────────┼─────────┼─────────┼─────────┼──────────┤│
│ │ 🍔 Aliment.│ R$ 800  │ R$ 900  │ R$ 850  │ R$ 2.550 ││
│ │            │    -    │  ↑ 12%  │  ↓ 5%   │          ││
│ ├────────────┼─────────┼─────────┼─────────┼──────────┤│
│ │ 🚗 Transp. │ R$ 300  │ R$ 320  │ R$ 310  │ R$ 930   ││
│ │            │    -    │  ↑ 6%   │  ↓ 3%   │          ││
│ ├────────────┼─────────┼─────────┼─────────┼──────────┤│
│ │ Total      │ R$ 1.1K │ R$ 1.2K │ R$ 1.1K │ R$ 3.4K  ││
│ └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Componentes UI a Utilizar (shadcn/ui)

- `Table` - estrutura principal da tabela
- `Select` - filtro de categorias (multiselect com Combobox)
- `DatePicker` - filtros de data
- `Button` - ações e exportação
- `DropdownMenu` - menu de exportação
- `Card` - versão mobile (cards empilhados)
- `Accordion` - mobile, colapsar/expandir meses
- `Badge` - tipo de categoria (despesa/receita)
- `Skeleton` - loading states
- `EmptyState` - quando não há dados

### Paleta de Cores

- **Despesas**: Tons de vermelho (`text-red-600`, `bg-red-50`)
- **Receitas**: Tons de verde (`text-green-600`, `bg-green-50`)
- **Aumento ruim**: Vermelho (`text-red-600`)
- **Diminuição boa**: Verde (`text-green-600`)
- **Neutro**: Muted (`text-muted-foreground`)

## 7. Technical Considerations

### Backend/Data Fetching

- **Arquivo**: `lib/relatorios/fetch-category-report.ts`
- **Função principal**: `fetchCategoryReport(userId, startDate, endDate, categoryIds?)`
- **Reutilizar lógica** de `lib/dashboard/categories/expenses-by-category.ts`
- **Query Drizzle**: JOIN entre `lancamentos`, `categorias`, `pagadores`
- **Filtros SQL**:
  - `userId` = usuário logado
  - `period` IN (lista de períodos entre startDate e endDate)
  - `categoriaId` IN (categoryIds se filtrado)
  - `pagadorRole` = ADMIN (apenas pagador principal)
- **Agregação**: GROUP BY `categoriaId`, `period`
- **Retorno**: Array de objetos `{ categoryId, categoryName, categoryIcon, categoryType, data: { [period]: amount } }`

### Frontend Components Structure

```
components/relatorios/
├── category-report-page.tsx       (client component, orquestra tudo)
├── category-report-filters.tsx    (filtros: categorias + datas)
├── category-report-table.tsx      (tabela desktop)
├── category-report-cards.tsx      (cards mobile)
├── category-report-export.tsx     (lógica de exportação)
├── category-cell.tsx              (célula com valor + indicador)
└── types.ts                       (TypeScript types)
```

### URL Structure

- Base: `/relatorios/categorias`
- Query params:
  - `?inicio=2025-01` - data inicial (período YYYY-MM)
  - `?fim=2025-06` - data final (período YYYY-MM)
  - `?categorias=uuid1,uuid2` - IDs das categorias filtradas

### Authentication & Authorization

- Usar `getUserId()` de `lib/auth/server`
- Adicionar `/relatorios` às rotas protegidas em `proxy.ts`
- Apenas usuário autenticado pode acessar seus próprios dados

### Performance Optimizations

- Server-side: Indexes em `lancamentos(userId, period, categoriaId)`
- Client-side: Memoização de cálculos com `useMemo`
- Lazy loading da tabela se muitas categorias
- Debounce nos filtros

### Exportação - Libraries

- **CSV**: `papaparse` ou implementação nativa
- **Excel**: `xlsx` (SheetJS)
- **PDF**: `jspdf` + `jspdf-autotable`

### Dependencies Adicionais (se necessário)

```json
{
  "papaparse": "^5.4.1",
  "xlsx": "^0.18.5",
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.8.0"
}
```

## 8. Success Metrics

1. **Adoção**: 30% dos usuários ativos acessam o relatório no primeiro mês
2. **Engajamento**: Tempo médio na página > 2 minutos (indica análise real dos dados)
3. **Uso de filtros**: 60% dos usuários utilizam filtros de categoria ou período
4. **Exportações**: 15% dos usuários exportam dados pelo menos uma vez
5. **Retenção**: Usuários que acessam o relatório retornam 3x+ no mês
6. **Mobile**: 40% dos acessos via mobile conseguem visualizar confortavelmente
7. **Performance**: Tempo de carregamento < 2s para períodos de 12 meses

## 9. Open Questions

1. **Categorias inativas**: Se uma categoria foi desativada/deletada mas tem histórico, deve aparecer no relatório?

   - Sugestão: Sim, mas com badge "inativa" ou nome em itálico

2. **Múltiplos pagadores**: No futuro, adicionar filtro de pagador ou manter apenas admin?

   - Decisão pendente baseada em feedback de usuários

3. **Subcategorias**: Se implementadas no futuro, como representar na tabela?

   - Opções: Agrupar ou listar independentemente

4. **Limite de período**: 24 meses é suficiente ou deve ser maior?

   - Avaliar após 2 meses de uso real

5. **Ordenação customizada**: Usuários devem poder ordenar por qualquer coluna clicando no header?

   - Nice-to-have, avaliar complexidade

6. **Salvar filtros favoritos**: Permitir salvar configurações de filtros para uso rápido?

   - Feature futura potencial

7. **Integração com insights AI**: O relatório deve alimentar o módulo de insights?
   - Avaliar sinergia com feature de AI existente

---

**Status**: Draft v1.0  
**Autor**: AI Assistant  
**Data**: 2025-12-07  
**Aprovação pendente**: Product Owner
