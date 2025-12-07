# Tasks: Relatório de Categorias por Período

## Relevant Files

### Files to Create

- `app/(dashboard)/relatorios/categorias/page.tsx` - Página principal do relatório (server component)
- `app/(dashboard)/relatorios/categorias/loading.tsx` - Loading state da página
- `lib/relatorios/fetch-category-report.ts` - Função para buscar dados do relatório com agregação por categoria e período
- `lib/relatorios/types.ts` - TypeScript types para o relatório
- `lib/relatorios/utils.ts` - Funções utilitárias (cálculo de variação, formatação, etc.)
- `components/relatorios/category-report-page.tsx` - Componente client-side principal que orquestra toda a UI
- `components/relatorios/category-report-filters.tsx` - Componente de filtros (categorias + datas)
- `components/relatorios/category-report-table.tsx` - Tabela desktop com categorias × meses
- `components/relatorios/category-report-cards.tsx` - Cards mobile (visão empilhada)
- `components/relatorios/category-report-export.tsx` - Componente de exportação (CSV, Excel, PDF)
- `components/relatorios/category-cell.tsx` - Célula individual com valor + indicador de variação
- `components/relatorios/types.ts` - Types específicos dos componentes

### Files to Modify

- `components/sidebar/nav-link.tsx` - Adicionar seção "Relatórios" com subitem "Categorias"
- `proxy.ts` - Adicionar `/relatorios` às rotas protegidas
- `components/dashboard/expenses-by-category-widget.tsx` - Adicionar botão "Ver mais detalhes" que redireciona para o relatório
- `package.json` - Adicionar dependências de exportação (xlsx, jspdf, jspdf-autotable)

### Reference Files (for patterns)

- `app/(dashboard)/orcamentos/page.tsx` - Padrão de page com filtros e data fetching
- `components/orcamentos/budgets-page.tsx` - Estrutura de página client com filtros
- `lib/dashboard/categories/expenses-by-category.ts` - Lógica de busca de gastos por categoria
- `lib/utils/period/index.ts` - Funções de manipulação de períodos (parsePeriodParam, getPreviousPeriod)
- `components/dashboard/expenses-by-category-widget.tsx` - Visualização de categorias com indicadores
- `components/ui/table.tsx` - Componente Table do shadcn/ui

### Notes

- Reutilizar padrões existentes de `parsePeriodParam()` e `getPreviousPeriod()` de `lib/utils/period/index.ts`
- Seguir estrutura de data fetching similar a `fetchExpensesByCategory()` 
- Usar `getUserId()` de `lib/auth/server` para autenticação
- Períodos no formato "YYYY-MM" conforme padrão do projeto
- Valores de despesa como positivos, usar `Math.abs()` conforme padrão existente
- Use `npx jest [optional/path/to/test/file]` to run tests

---

## Tasks

- [ ] **1.0 Setup de Infraestrutura e Navegação**
  - [ ] 1.1 Criar estrutura de pastas `app/(dashboard)/relatorios/categorias/`
  - [ ] 1.2 Criar estrutura de pastas `components/relatorios/`
  - [ ] 1.3 Criar estrutura de pastas `lib/relatorios/`
  - [ ] 1.4 Adicionar `/relatorios` ao array `PROTECTED_ROUTES` em `proxy.ts`
  - [ ] 1.5 Atualizar `nav-link.tsx` para adicionar seção "Relatórios" com ícone `RiLineChartLine`
  - [ ] 1.6 Adicionar subitem "Categorias" dentro de "Relatórios" apontando para `/relatorios/categorias`
  - [ ] 1.7 Criar arquivo `app/(dashboard)/relatorios/categorias/loading.tsx` com skeleton states

- [ ] **2.0 Backend: Data Fetching e Tipos**
  - [ ] 2.1 Criar `lib/relatorios/types.ts` com tipos:
    - `CategoryReportItem` (categoryId, name, icon, type, monthlyData, total)
    - `MonthlyData` (period, amount, previousAmount, percentageChange)
    - `CategoryReportData` (categories, periods, totals)
    - `CategoryReportFilters` (startPeriod, endPeriod, categoryIds?)
  - [ ] 2.2 Criar `lib/relatorios/utils.ts` com funções:
    - `calculatePercentageChange(current, previous)` - reutilizar lógica de `expenses-by-category.ts`
    - `formatPeriodLabel(period)` - formatar "YYYY-MM" para "MMM/YYYY"
    - `generatePeriodRange(startPeriod, endPeriod)` - gerar array de períodos entre duas datas
    - `validateDateRange(start, end)` - validar que fim >= início e limite de 24 meses
  - [ ] 2.3 Criar `lib/relatorios/fetch-category-report.ts` com função `fetchCategoryReport(userId, filters)`:
    - Query Drizzle com JOINs: `lancamentos` ⟕ `categorias` ⟕ `pagadores`
    - WHERE: `userId`, `period IN (periods)`, `pagadorRole = ADMIN`, opcional `categoriaId IN (categoryIds)`
    - GROUP BY: `categoriaId`, `period`
    - SELECT: `categoriaId`, `categoriaNome`, `categoriaIcon`, `categoriaType`, `period`, `SUM(amount)`
    - Excluir lançamentos com nota começando com `ACCOUNT_AUTO_INVOICE_NOTE_PREFIX`
    - Processar resultado em estrutura `CategoryReportData`
    - Calcular totais por mês e categoria
    - Calcular variações percentuais entre meses consecutivos
    - Ordenar: despesas primeiro (por total desc), depois receitas (por total desc)

- [ ] **3.0 Componentes de Filtros**
  - [ ] 3.1 Criar `components/relatorios/types.ts` com tipos de UI:
    - `CategoryOption` (id, name, icon, type)
    - `FilterState` (selectedCategories, startPeriod, endPeriod)
  - [ ] 3.2 Criar `components/relatorios/category-report-filters.tsx` ("use client"):
    - Receber props: `categories: CategoryOption[]`, `filters: FilterState`, `onFiltersChange: (filters) => void`
    - Implementar Combobox multiselect de categorias usando shadcn/ui
    - Mostrar ícones das categorias no select
    - Busca/filtro por nome de categoria
    - Opção "Todas" que limpa seleção
    - Input de data inicial (formato "YYYY-MM") usando `<input type="month">`
    - Input de data final (formato "YYYY-MM") usando `<input type="month">`
    - Validação: mostrar erro se data final < data inicial
    - Validação: mostrar aviso se período > 24 meses
    - Botão "Aplicar Filtros" desabilitado se validação falhar
    - Usar `useMemo` para otimizar lista de categorias
    - Layout responsivo: stack vertical em mobile, grid horizontal em desktop

- [ ] **4.0 Componente de Tabela Desktop**
  - [ ] 4.1 Criar `components/relatorios/category-cell.tsx`:
    - Props: `value: number`, `previousValue: number`, `categoryType: "despesa" | "receita"`, `isFirstMonth: boolean`
    - Exibir valor formatado em BRL usando `Intl.NumberFormat`
    - Se `!isFirstMonth`, calcular e mostrar indicador:
      - Seta para cima + % vermelho se: (despesa aumentou) OU (receita diminuiu)
      - Seta para baixo + % verde se: (despesa diminuiu) OU (receita aumentou)
      - Usar `RiArrowUpLine` e `RiArrowDownLine` do Remix Icon
      - Formato: "±X%" ou "±X.X%" se < 10%
      - Caso especial: se `previousValue === 0` e `value > 0`, mostrar "+100%"
    - Usar `text-red-600` para valores negativos de variação, `text-green-600` para positivos
  - [ ] 4.2 Criar `components/relatorios/category-report-table.tsx` ("use client"):
    - Props: `data: CategoryReportData`
    - Usar componente `Table` do shadcn/ui
    - Header fixo com scroll horizontal
    - Primeira coluna: ícone + nome da categoria + Badge (Despesa/Receita)
    - Colunas de meses: usar `formatPeriodLabel()` para headers
    - Última coluna: "Total" (soma de todos os meses)
    - Cada célula: usar `<CategoryCell />` com dados apropriados
    - Última linha: "Total Geral" com totais por mês
    - Célula inferior direita: total geral de tudo
    - Linha de totais com background diferenciado e sticky no bottom
    - Mostrar ícones das categorias usando `getIconComponent()` de `lib/utils/icons`
    - Empty state: quando `data.categories.length === 0`

- [ ] **5.0 Componente de Cards Mobile**
  - [ ] 5.1 Criar `components/relatorios/category-report-cards.tsx` ("use client"):
    - Props: `data: CategoryReportData`
    - Visível apenas em telas < 768px (usar `@media` ou hook `useMobile`)
    - Cada categoria renderizada como `Card` do shadcn/ui
    - Header do card: ícone + nome + Badge (tipo) + total da categoria
    - Body do card: `Accordion` com meses colapsados por padrão
    - Cada item do accordion: período + valor + indicador
    - Último card: "Totais Gerais" com totais por mês
    - Usar mesma lógica de cores e indicadores de `CategoryCell`
    - Scroll vertical suave
    - Empty state compartilhado com versão desktop

- [ ] **6.0 Funcionalidade de Exportação**
  - [ ] 6.1 Instalar dependências no `package.json`:
    - `"xlsx": "^0.18.5"` (Excel)
    - `"jspdf": "^2.5.1"` (PDF)
    - `"jspdf-autotable": "^3.8.2"` (Tabelas no PDF)
    - Executar `pnpm install`
  - [ ] 6.2 Criar `components/relatorios/category-report-export.tsx` ("use client"):
    - Props: `data: CategoryReportData`, `filters: FilterState`
    - Botão "Exportar" com `DropdownMenu` oferecendo 3 opções
    - **Função `exportToCSV()`**:
      - Gerar CSV com headers: "Categoria", períodos, "Total"
      - Incluir linha por categoria com valores
      - Incluir indicadores como texto "(↑12%)"
      - Linha final com totais
      - Nome do arquivo: `relatorio-categorias-[inicio]-[fim].csv`
      - Usar `Blob` + `URL.createObjectURL` + `<a>` para download
    - **Função `exportToExcel()`**:
      - Usar biblioteca `xlsx`
      - Criar worksheet com mesma estrutura do CSV
      - Aplicar formatação: bold nos headers, cores para despesas/receitas
      - Nome do arquivo: `relatorio-categorias-[inicio]-[fim].xlsx`
      - Usar `XLSX.writeFile()` para download
    - **Função `exportToPDF()`**:
      - Usar `jspdf` + `jspdf-autotable`
      - Cabeçalho: título "Relatório de Categorias" + período + data de geração
      - Tabela com auto-layout
      - Cores: vermelho para despesas, verde para receitas
      - Indicadores como texto
      - Nome do arquivo: `relatorio-categorias-[inicio]-[fim].pdf`
    - Toast de sucesso após exportação (`toast.success()`)
    - Toast de erro se falhar (`toast.error()`)
    - Loading state durante geração de arquivos grandes

- [ ] **7.0 Página Principal e Integração**
  - [ ] 7.1 Criar `components/relatorios/category-report-page.tsx` ("use client"):
    - Props: `initialData: CategoryReportData`, `categories: CategoryOption[]`, `initialFilters: FilterState`
    - State: `filters` (FilterState), `isLoading` (boolean)
    - Usar `useSearchParams` e `useRouter` do Next.js para sincronizar filtros com URL
    - Query params: `?inicio=YYYY-MM&fim=YYYY-MM&categorias=id1,id2`
    - Ao mudar filtros: atualizar URL e recarregar dados
    - Layout: 
      - Header com título "Relatório de Categorias por Período"
      - Subtítulo: "Acompanhe a evolução dos seus gastos e receitas"
      - `<CategoryReportFilters />` no topo
      - Botão `<CategoryReportExport />` alinhado à direita dos filtros
      - Desktop: `<CategoryReportTable />` (visível em >= 768px)
      - Mobile: `<CategoryReportCards />` (visível em < 768px)
    - Loading state: mostrar `Skeleton` do shadcn/ui durante aplicação de filtros
    - Empty states:
      - Sem categorias selecionadas: "Selecione pelo menos uma categoria"
      - Sem dados no período: "Nenhum lançamento encontrado no período selecionado"
    - Usar debounce de 300ms nos filtros para evitar requisições excessivas
  - [ ] 7.2 Criar `app/(dashboard)/relatorios/categorias/page.tsx` (server component):
    - Async function `Page({ searchParams })`
    - Extrair `inicio`, `fim`, `categorias` dos searchParams usando helper `getSingleParam`
    - Default: últimos 6 meses se params não fornecidos (usar `getCurrentPeriod` e calcular 6 meses atrás)
    - Chamar `getUserId()` para autenticação
    - Buscar lista de categorias para o filtro: `db.query.categorias.findMany()` filtradas por userId
    - Validar e parsear filtros usando `validateDateRange()`
    - Chamar `fetchCategoryReport(userId, filters)`
    - Renderizar `<CategoryReportPage />` passando data e categories
    - Tratar erros: redirect para error page se validação falhar
    - Layout: `<main className="flex flex-col gap-6 px-6">`

- [ ] **8.0 Integração com Dashboard**
  - [ ] 8.1 Modificar `components/dashboard/expenses-by-category-widget.tsx`:
    - Adicionar botão/link "Ver mais detalhes" no final do widget
    - Link deve apontar para `/relatorios/categorias?inicio=[6-meses-atras]&fim=[periodo-atual]`
    - Usar `Link` do Next.js
    - Ícone: `RiExternalLinkLine` ou `RiArrowRightLine`
    - Estilo: text-sm, text-primary, hover:underline
    - Posicionamento: após a lista de categorias, alinhado à direita

- [ ] **9.0 Testing, Validações e Refinamentos**
  - [ ] 9.1 Validações e edge cases:
    - Testar com 0 categorias (deve mostrar empty state)
    - Testar com 1 categoria
    - Testar com >50 categorias (verificar performance)
    - Testar período de 1 mês (sem indicadores)
    - Testar período de 24 meses (máximo)
    - Testar com categorias sem lançamentos (R$ 0,00)
    - Testar variação de 0 para valor > 0 (deve mostrar "+100%")
    - Testar variação de valor para 0 (deve mostrar "-100%")
    - Testar filtro com categoria não existente (ignorar)
  - [ ] 9.2 Responsividade:
    - Testar em mobile (< 768px): deve mostrar cards
    - Testar em tablet (768-1024px): deve mostrar tabela com scroll
    - Testar em desktop (>1024px): tabela completa
    - Verificar que filtros são acessíveis em todos os tamanhos
  - [ ] 9.3 Performance:
    - Verificar que query no banco tem índices adequados
    - Verificar tempo de carregamento para 12 meses + 30 categorias (< 2s)
    - Verificar que debounce funciona nos filtros
    - Verificar que exportação não trava UI em datasets grandes
  - [ ] 9.4 Acessibilidade:
    - Verificar labels em todos os inputs
    - Verificar navegação por teclado nos filtros
    - Verificar contraste de cores (WCAG AA)
    - Adicionar `aria-label` em botões de ícone
  - [ ] 9.5 Build e Deploy:
    - Executar `pnpm build` e verificar que não há erros
    - Verificar que todas as rotas são acessíveis
    - Testar em ambiente de produção (Docker)
    - Verificar logs do servidor para erros não tratados

---

## Implementation Checklist

### Pre-Development
- [ ] Revisar PRD completo em `.github/tasks/prd-relatorio-categorias.md`
- [ ] Confirmar que branch `feat/report-category` está atualizada
- [ ] Verificar que ambiente de desenvolvimento está rodando (`pnpm dev`)

### Development Order Recommendation
1. Começar por Tasks 1.0 e 2.0 (infraestrutura e backend)
2. Implementar Task 3.0 (filtros) para ter UI básica
3. Implementar Task 4.0 (tabela) como visualização principal
4. Implementar Task 7.0 (página principal) para integrar tudo
5. Implementar Task 5.0 (mobile) para responsividade
6. Implementar Task 6.0 (exportação) como feature adicional
7. Implementar Task 8.0 (dashboard) para integração
8. Finalizar com Task 9.0 (testes e refinamentos)

### Post-Development
- [ ] Executar todos os testes: `pnpm test`
- [ ] Build de produção: `pnpm build`
- [ ] Revisar código para seguir padrões do projeto
- [ ] Criar PR com descrição detalhada das mudanças
- [ ] Solicitar code review

---

**Status**: Ready for Implementation  
**Estimated Effort**: 2-3 dias (desenvolvedor júnior)  
**Priority**: Medium  
**Dependencies**: Nenhuma - feature independente
