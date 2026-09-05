# APP

## Visão geral

Opensheets é uma aplicação web de gestão financeira pessoal, self-hosted e centrada em controle manual. A proposta do sistema é concentrar contas, cartões, lançamentos, orçamentos, relatórios e análises em um único lugar, com interface em português e foco em organização financeira contínua.

Diferente de produtos baseados em Open Finance, o app não depende de sincronização bancária automática. O uso parte do princípio de que o usuário registra, importa e revisa suas movimentações para manter uma visão confiável do próprio dinheiro. Em troca, o sistema oferece controle total sobre os dados, flexibilidade para modelar categorias e pagadores, além de recursos de análise mensal, acompanhamento de faturas, importação assistida e insights gerados por IA.

## O que o aplicativo faz

O app cobre o ciclo principal da gestão financeira pessoal:

- centraliza contas, cartões e saldos
- registra receitas, despesas e transferências
- organiza lançamentos por categoria, pagador, conta, cartão, forma de pagamento e período
- acompanha faturas, boletos, parcelamentos e recorrências
- compara gastos ao orçamento mensal
- mostra indicadores, alertas e relatórios por período
- permite importação de extratos e lotes de lançamentos
- oferece análises históricas e insights automáticos

Na prática, o Opensheets funciona como um painel financeiro pessoal onde o usuário pode tanto operar o dia a dia quanto consultar contexto analítico do mês e do histórico recente.

## Princípios do produto

Algumas características estruturam a experiência do sistema:

- É um sistema self-hosted. Os dados ficam sob controle do próprio usuário.
- O preenchimento é manual ou semiassistido por importação. Não há automação bancária nativa.
- O período financeiro é um conceito central. Grande parte das telas trabalha com seleção mensal no formato `YYYY-MM`.
- O app trata finanças pessoais com granularidade. Não trabalha só com saldos; ele detalha condição de pagamento, liquidação, vencimento, parcelamento, recorrência, divisão entre pagadores e contexto de cada lançamento.

## Módulos principais

### Dashboard

O dashboard é a visão consolidada da situação financeira do período selecionado. Ele reúne widgets com recortes diferentes da mesma base de lançamentos e contas, permitindo interpretar o mês sem precisar navegar por vários cadastros.

Entre os blocos disponíveis, o sistema mostra:

- saldo consolidado das contas
- resumo das faturas do período
- controle de boletos em aberto ou liquidados
- status de pagamento entre valores confirmados e pendentes
- evolução de receita, despesa e balanço
- lançamentos recentes
- gastos por categoria
- receitas por categoria
- compras por categoria
- maiores gastos do mês
- despesas recorrentes
- despesas parceladas em aberto
- principais estabelecimentos
- métodos e condições de pagamento mais usados

Além do resumo visual, o dashboard também expõe uma análise específica de parcelamentos, com página dedicada para acompanhar grupos de parcelas pendentes e impacto futuro em faturas.

### Lançamentos

Lançamentos são o núcleo operacional do app. É nessa área que receitas, despesas e transferências são registradas, filtradas, revisadas e corrigidas.

Cada lançamento pode conter informações como:

- nome ou descrição
- valor
- data da compra
- tipo de transação
- forma de pagamento
- condição de pagamento
- conta ou cartão associado
- categoria
- pagador
- observação
- vencimento, no caso de boleto
- status de realização ou liquidação

O módulo suporta cenários além do lançamento simples:

- transações à vista
- parcelamentos com controle da parcela atual e total
- recorrências mensais
- boletos com acompanhamento de vencimento e pagamento
- divisão entre pagadores
- antecipação de parcelas
- edição ou exclusão em massa de uma série, com escopo apenas no item atual, nos próximos ou em toda a série
- cadastro em lote de várias transações de uma vez compartilhando campos fixos

O app também mantém filtros ricos por tipo, condição, forma de pagamento, categoria, pagador, conta/cartão e busca textual, o que permite usar a tela como um extrato operacional detalhado do período.

### Contas

O módulo de contas organiza o patrimônio financeiro operacional do usuário. Nele é possível cadastrar contas com nome, tipo, saldo inicial, status, logo e observações, além de decidir se determinada conta entra ou não no saldo consolidado.

Cada conta pode ter um extrato próprio com:

- saldo inicial do período
- saldo atual
- total de entradas
- total de saídas
- histórico dos lançamentos liquidados daquela conta

O sistema também registra transferências entre contas. Em vez de apenas ajustar saldos, ele cria os dois lados da movimentação, vinculados por um identificador comum, preservando rastreabilidade financeira.

### Importação OFX em contas

No extrato de cada conta ativa, o app oferece importação de arquivos OFX. Esse fluxo foi pensado para reduzir digitação manual sem perder revisão humana.

Durante a importação, o sistema:

- faz o parse do arquivo OFX
- converte as movimentações para o formato interno de lançamentos
- detecta possíveis duplicidades no banco
- sugere categorias com base em histórico
- pode usar IA para sugerir categorização, quando o recurso está habilitado
- permite revisar, editar e selecionar as transações antes da confirmação

Isso transforma o OFX em uma importação assistida, e não em uma ingestão cega de dados.

### Cartões e faturas

O módulo de cartões permite cadastrar cartões vinculados a contas, com dados como bandeira, vencimento, fechamento, limite, logo, status e observações.

Cada cartão tem uma página de fatura por período, onde o sistema consolida:

- total da fatura
- status de pagamento
- data de pagamento, quando houver
- limite configurado e uso associado
- lista de lançamentos daquele cartão no período

Essa estrutura torna o cartão um objeto financeiro de primeira classe dentro do app, e não apenas uma forma de pagamento genérica. O usuário consegue acompanhar gastos correntes, faturas históricas e impacto de parcelamentos futuros.

### Orçamentos

O sistema permite definir orçamentos mensais por categoria. O orçamento é vinculado a um período e a uma categoria específica, evitando duplicidade da mesma combinação.

Com isso, o app consegue comparar o valor planejado com o valor efetivamente gasto e transformar o orçamento em referência prática para análise do mês, não apenas em cadastro estático.

### Metas financeiras e reserva de emergência

Para um app de finanças pessoais ser realmente completo, ele não deve apenas registrar o que aconteceu, mas também ajudar o usuário a construir segurança financeira. Por isso, o sistema pode incluir um módulo de metas financeiras e reserva de emergência.

Nesse contexto, o usuário consegue:

- criar metas com nome, valor alvo, prazo, prioridade e contribuição mensal sugerida
- acompanhar objetivos como reserva de emergência, viagem, troca de carro, reforma ou quitação de dívida
- vincular metas a contas específicas ou ao saldo consolidado
- medir a reserva em meses de custo de vida, e não apenas em valor absoluto
- receber alertas quando o padrão de gastos comprometer a formação da reserva

Esse recurso ajuda o app a sair da lógica puramente operacional e entrar na lógica de planejamento financeiro pessoal.

### Fluxo de caixa pessoal e previsão de saldo

Além de olhar para o mês atual, o usuário precisa enxergar o que vai acontecer nos próximos dias e semanas. Um módulo de projeção de saldo permite antecipar aperto financeiro antes que ele vire atraso, rotativo ou cheque especial.

O sistema pode projetar:

- saldo diário previsto por conta
- impacto futuro de faturas, boletos, recorrências e parcelas já cadastradas
- entradas esperadas como salário, adiantamento, renda extra ou reembolsos
- dias com maior risco de saldo negativo
- cenários alternativos ao adiar, antecipar ou redistribuir pagamentos

Essa previsão transforma o aplicativo em uma ferramenta de prevenção de dívida, e não apenas de registro histórico.

### Gestão de dívidas e renegociação

Uma aplicação de finanças pessoais voltada para controle real da vida financeira precisa tratar dívidas como um módulo próprio. Não basta enxergar despesas passadas; é preciso acompanhar juros, acordos e estratégias de saída.

O módulo de dívidas pode contemplar:

- cadastro de dívidas de cartão rotativo, cheque especial, empréstimos, financiamentos e acordos informais
- registro de taxa de juros, CET, valor original, saldo atual, parcela, vencimento e credor
- comparação entre estratégias de quitação, como bola de neve e avalanche
- simulação de antecipação de parcelas e economia potencial de juros
- alertas para dívidas com custo muito alto ou atraso recorrente
- plano de ação para renegociação com acompanhamento da evolução do saldo devedor

Esse ponto é central para usuários que não querem apenas organizar o orçamento, mas efetivamente sair do ciclo de endividamento.

### Planejamento anual e despesas sazonais

Na vida financeira brasileira, muitas despesas importantes não aparecem todo mês, mas pesam bastante quando chegam. O app pode incorporar uma camada de planejamento anual para distribuir essas obrigações ao longo do tempo.

Entre os eventos sazonais mais relevantes, o sistema pode ajudar a preparar:

- IPVA
- IPTU
- material escolar
- matrícula e rematrícula
- seguros anuais
- assinaturas anuais
- manutenção do carro
- presentes e viagens de fim de ano

Com isso, o usuário deixa de ser surpreendido por gastos previsíveis que só parecem inesperados porque não estavam reservados no orçamento mensal.

### Planejamento para renda variável

Nem todo usuário vive apenas de salário fixo. Em contexto brasileiro, é comum combinar salário, comissão, freela, renda autônoma, décimo terceiro, férias, restituição de imposto e entradas pontuais ao longo do ano.

O app pode oferecer suporte a esse cenário ao permitir:

- separar receitas fixas e variáveis
- marcar entradas extraordinárias para não inflar artificialmente o padrão de consumo
- criar regras conservadoras de orçamento com base em renda média ou piso de segurança
- acompanhar meses fortes e fracos de geração de renda
- sugerir formação de colchão para sazonalidade da renda

Isso torna o sistema mais útil para autônomos, profissionais liberais e famílias com fluxo financeiro menos estável.

### Calendário financeiro

O calendário oferece uma leitura temporal dos lançamentos do período. Em vez de analisar só tabelas e cartões, o usuário consegue enxergar os eventos financeiros distribuídos no mês e abrir detalhes diretamente pelos dias.

Essa visualização é especialmente útil para observar concentração de gastos, vencimentos e comportamento financeiro ao longo do calendário mensal.

### Categorias

As categorias organizam o plano de classificação financeira do usuário. O app permite criar, editar e remover categorias com nome, tipo e ícone, mantendo separação entre categorias de receita e despesa.

Elas são usadas em praticamente todos os fluxos analíticos do sistema:

- classificação de lançamentos
- orçamento mensal
- gráficos do dashboard
- relatórios por período
- histórico de evolução

Há também uma visão de histórico de categorias que acompanha o desempenho das categorias ao longo de vários meses, ajudando a identificar tendências de crescimento, queda e estabilidade.

### Pagadores

Pagadores representam pessoas ou entidades associadas aos lançamentos. Esse conceito vai além de um simples contato: ele ajuda a separar o que é despesa própria, compartilhada, de terceiros ou vinculada a alguém específico.

O módulo permite:

- cadastrar pagadores com nome, e-mail, avatar, status e observações
- marcar pagadores para envio automático de notificações por e-mail
- associar lançamentos a um pagador
- analisar gastos e receitas por pagador
- visualizar participação por meio de pagamento
- acompanhar uso por cartão
- ver estatísticas específicas de boletos
- consultar histórico mensal de receitas e despesas

Na página individual de cada pagador, o sistema consolida perfil, resumo mensal, histórico, uso de cartões, boletos e lista de lançamentos relacionados.

### Compartilhamento de pagadores

Pagadores também podem ser compartilhados entre usuários por código. Esse recurso cria uma camada de colaboração leve dentro da aplicação.

O fluxo funciona assim:

- o proprietário do pagador recebe um código de compartilhamento
- outra pessoa pode adicionar esse pagador usando o código
- o acesso compartilhado é somente leitura
- o proprietário pode regenerar o código ou remover compartilhamentos existentes

Isso permite compartilhar uma visão financeira associada a um pagador sem entregar permissão de edição irrestrita.

### Notificações automáticas para pagadores

Quando configurado com e-mail e envio automático habilitado, um pagador pode receber notificações automáticas por e-mail quando lançamentos em seu nome são criados ou removidos. O corpo do e-mail resume data, descrição, forma de pagamento, condição e valor.

Esse recurso é útil para contextos em que outra pessoa precisa ser avisada sobre movimentações registradas em seu nome, sem depender de contato manual fora do sistema.

### Relatórios

O módulo de relatórios oferece uma visão comparativa por categoria ao longo de múltiplos meses. Em vez de mostrar apenas o total de um mês, ele organiza a evolução por período, permitindo ver tendência, variação percentual e total acumulado.

O relatório de categorias suporta:

- filtros por intervalo de períodos
- filtros por categorias específicas
- leitura responsiva em tabela ou cards
- totalização por mês e total geral
- indicação visual de aumento ou queda entre períodos
- exportação em CSV, Excel e PDF

Esse módulo é útil para análise gerencial do comportamento financeiro, especialmente quando o objetivo é comparar meses e não apenas consultar lançamentos isolados.

### Anotações e tarefas

O app inclui uma área de anotações para registrar contexto financeiro fora da estrutura rígida dos lançamentos. É possível criar notas livres e também itens do tipo tarefa, mantendo lembretes, decisões, pendências ou observações importantes dentro do mesmo ambiente financeiro.

Isso ajuda a unir operação financeira e contexto de acompanhamento em um só sistema.

### Insights com IA

O módulo de insights gera análises automáticas sobre o mês a partir dos dados financeiros registrados. A aplicação agrega receitas, despesas, categorias, orçamentos, cartões, contas, ticket médio, comportamento por dia da semana, métodos de pagamento e sinais de recorrência para produzir uma leitura interpretativa do período.

Os insights são organizados em quatro grupos:

- comportamentos observados
- gatilhos de consumo
- recomendações práticas
- melhorias sugeridas

O usuário pode escolher o modelo de IA, gerar a análise para o período e salvar ou remover insights persistidos no banco. Isso transforma o histórico financeiro em uma camada de interpretação, não apenas de visualização.

### Assistente financeiro com IA generativa

Além dos insights estáticos, o app pode evoluir para um assistente financeiro conversacional, treinado para responder em linguagem natural com base exclusivamente nos dados do usuário e em regras transparentes de cálculo.

Na prática, esse assistente pode:

- responder perguntas como "onde estou exagerando neste mês?", "quanto preciso cortar para fechar no azul?" e "qual dívida devo atacar primeiro?"
- resumir a situação financeira da semana, do mês ou do trimestre em linguagem simples
- gerar planos de ação personalizados para sair do rotativo, organizar uma reserva ou reequilibrar categorias críticas
- explicar aumentos de gasto com base em comparação histórica e sazonalidade
- sugerir categorias para lançamentos importados com justificativa textual, não apenas com um rótulo automático
- detectar padrões de consumo impulsivo, concentração de gastos e sinais de estresse financeiro
- simular cenários em linguagem natural, como redução de gastos, antecipação de dívida ou ajuste de orçamento
- gerar checklists financeiros mensais, semanais e anuais adaptados ao perfil do usuário

Para ser realmente útil, a IA deve operar com algumas premissas de qualidade:

- explicar de onde tirou cada conclusão
- deixar claro quando uma resposta é estimativa
- nunca alterar dados sem confirmação explícita do usuário
- evitar recomendações genéricas desconectadas da realidade financeira registrada

Com isso, a IA deixa de ser apenas um gerador de texto e passa a funcionar como um copiloto financeiro pessoal.

### Educação financeira personalizada

Uma boa camada de IA generativa também pode atuar como educador financeiro contextual. Em vez de oferecer conteúdo genérico, ela pode transformar os próprios dados do usuário em aprendizado prático.

Isso inclui:

- explicar conceitos como juros compostos, rotativo, reserva de emergência e custo efetivo total com exemplos tirados da vida financeira da pessoa
- traduzir relatórios e indicadores em linguagem acessível
- sugerir hábitos graduais de melhoria em vez de mudanças irreais
- adaptar o nível de profundidade para usuários iniciantes ou avançados

Esse tipo de recurso aproxima o app de uma consultoria financeira pessoal contínua, mas baseada em dados concretos e rotina real.

### Contexto brasileiro da vida financeira pessoal

Para funcionar muito bem no Brasil, o sistema precisa refletir práticas locais de pagamento, cobrança e organização financeira doméstica.

Alguns cenários especialmente relevantes são:

- uso intenso de Pix como entrada, saída, transferência e divisão de despesas
- boletos com vencimento, atraso, juros e multa
- compras parceladas sem juros, que afetam meses futuros mesmo quando parecem leves no presente
- cartão de crédito como principal meio de consumo recorrente
- despesas fixas domésticas como aluguel, condomínio, mercado, farmácia, escola, transporte e assinatura digital
- entradas sazonais como décimo terceiro, férias, restituição de IR e renda extra eventual
- necessidade de guardar comprovantes, observações e contexto para revisão posterior

Essa aderência ao cotidiano financeiro brasileiro aumenta a utilidade prática do produto e evita que ele pareça importado de uma realidade diferente da do usuário.

### Importação CSV e Excel

Além da importação OFX nas contas, o sistema possui um fluxo de importação de lançamentos por CSV, com suporte a conversão de planilhas Excel para CSV no cliente.

Esse fluxo inclui:

- upload do arquivo
- mapeamento de colunas
- revisão e edição das linhas importadas
- detecção de duplicidade
- sugestão de categorias por histórico
- sugestão de categorias por IA, quando habilitada
- confirmação em lote com validações e controle de taxa de importação

Esse recurso é especialmente útil para migrar lançamentos de planilhas antigas ou importar dados de exportações de outros sistemas.

## Recursos transversais da experiência

Além dos módulos principais, o app tem alguns recursos de uso diário que melhoram a experiência geral:

- seletor mensal centralizado para navegar entre períodos
- notificações no cabeçalho para faturas atrasadas, faturas próximas do vencimento e boletos pendentes
- alertas preventivos para risco de saldo negativo, excesso de uso do cartão e orçamento comprometido
- lembretes de revisão semanal e fechamento financeiro do mês
- indicadores de saúde financeira, como taxa de poupança, peso das despesas fixas, uso do limite e cobertura da reserva
- modo de planejamento com cenários para testar decisões antes de executá-las
- modo privacidade para ocultar valores monetários na interface e persistir essa preferência localmente
- alternância de tema claro/escuro
- calculadora embutida, acessível pelo cabeçalho e em formulários de lançamento
- interface responsiva com navegação lateral por áreas do sistema

## Autenticação e acesso

O app possui autenticação própria, com suporte a login por provedores OAuth e autenticação por e-mail. As áreas internas são protegidas, e o dashboard só fica disponível para usuários autenticados.

Na área de ajustes, o usuário pode administrar a própria conta, incluindo atualização de nome, e-mail, senha e exclusão da conta.

## O que o sistema não pretende fazer

Para entender corretamente o escopo do Opensheets, também é importante registrar o que ele não tenta ser:

- não é uma plataforma de Open Finance
- não sincroniza automaticamente com bancos por padrão
- não substitui disciplina de registro e revisão financeira
- não promete enriquecimento rápido nem soluções mágicas para dívida
- não deve tomar decisões financeiras críticas pelo usuário sem transparência e confirmação
- não se limita a dashboard; ele depende de base bem organizada para entregar análise útil

## Resumo funcional

Em termos práticos, o Opensheets é um sistema de finanças pessoais que combina operação diária, organização estrutural, planejamento financeiro e análise mensal. Ele serve para registrar movimentações, controlar contas e cartões, acompanhar orçamentos, metas, reserva de emergência e dívidas, importar extratos e planilhas, compartilhar contextos específicos com outras pessoas, receber alertas de vencimento e produzir leitura analítica dos dados, inclusive com apoio de IA.

É um app voltado para quem prefere controle, visibilidade e propriedade dos próprios dados, mesmo que isso exija registro manual e revisão recorrente. No cenário ideal, ele funciona como um sistema de organização financeira pessoal, prevenção de endividamento e apoio contínuo à tomada de decisão, respeitando a realidade brasileira e usando IA generativa como suporte prático, não como enfeite.
