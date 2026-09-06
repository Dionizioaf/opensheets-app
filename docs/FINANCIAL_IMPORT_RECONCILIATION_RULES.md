# Regras de importação e reconciliação financeira

Este documento registra regras operacionais para futuras importações de extratos bancários e faturas de cartão.

## Fonte de verdade

- Tratar o arquivo original do banco como a fonte de verdade.
- Não usar a quantidade ou o saldo atual do banco de dados como referência para decidir o que importar.
- Preservar o arquivo original e registrar qual arquivo originou cada lançamento.

## Identificação e duplicidade

- A identidade de uma transação deve considerar, nesta ordem de preferência:
  1. identificador estável do banco, como FITID;
  2. conta, data, valor e descrição normalizada;
  3. outros campos bancários disponíveis, quando houver colisão.
- Normalizar descrições antes da comparação: diferenças de espaços, barras, pontuação e acentuação não devem criar uma nova transação.
- Nunca importar novamente um lançamento apenas porque o texto veio com formatação diferente.
- Comparar os arquivos com o banco como conjuntos multisets: a quantidade de ocorrências também importa. Quatro transações idênticas em valor e descrição devem continuar sendo quatro transações.
- Antes de remover duplicatas, gerar uma prévia com os IDs, datas, valores e descrições afetados.

## Reconciliação de saldo

Para cada conta e período, validar sempre:

```text
saldo inicial + soma das movimentações = saldo final do extrato
```

- Saldo inicial deve ser registrado separadamente das movimentações do mês.
- Se o usuário informar o saldo inicial ou final, tratar o valor informado como requisito de validação.
- Não considerar o saldo inicial como uma movimentação bancária do extrato.
- Validar a quantidade de transações, a soma dos valores e a data do primeiro/último lançamento.

## Conta corrente versus cartão

- Não misturar data da compra, período da fatura, data de vencimento e data de pagamento.
- Para cartão, o período da fatura determina em qual fatura o lançamento aparece; a data da compra pode ser de outro mês.
- O pagamento da fatura na conta corrente é uma movimentação da conta e não deve duplicar as compras individuais do cartão.

## Fluxo obrigatório de importação

1. Ler e validar o arquivo original.
2. Converter datas e valores sem perder centavos ou sinal.
3. Construir a identidade normalizada de cada transação.
4. Comparar origem e banco atual: novos, já existentes, duplicados e ausentes.
5. Mostrar uma prévia antes de qualquer alteração destrutiva.
6. Importar apenas os lançamentos realmente ausentes.
7. Remover apenas duplicatas comprovadas, preservando uma ocorrência válida.
8. Executar a reconciliação de saldo.
9. Atualizar/recarregar a tela do período afetado e confirmar que o valor exibido coincide com o cálculo.
10. Registrar o resultado: arquivo, quantidade importada, quantidade removida, soma da movimentação e saldo final.

## Proteções contra erros

- Uma gravação bem-sucedida no banco não é prova de que a tela está correta; sempre verificar a consulta usada pela tela.
- Se a integração oficial de finanças estiver indisponível, qualquer alteração direta no banco deve ocorrer em transação, com validação antes e depois.
- Não apagar registros com base apenas em uma diferença de saldo. Primeiro localizar as transações que explicam a diferença.
- Diferenças de saldo devem ser explicadas por uma lista concreta de transações ausentes, duplicadas ou com valor/data incorretos.

## Regras de categorização

As regras determinísticas do proprietário devem ser aplicadas antes da
sugestão por histórico ou fuzzy match. A descrição deve ser normalizada para
ignorar maiúsculas/minúsculas, acentos e espaços repetidos.

| Descrição normalizada contém | Categoria no app | Observação |
| --- | --- | --- |
| `TRANSF AMANDA` | Saúde | — |
| `DAEV` | Energia e água | DAEV é água; representa Casa na classificação informada |
| `CPFL` | Energia e água | CPFL é energia; representa Casa na classificação informada |
| `CLARO` | Telecomunicação; estorno positivo → Outras receitas | — |
| `ITAU BLACK` | Pagamentos | Pagamento da fatura do cartão |
| `DEV PIX PAGALEVE` ou `PIX QRS PAGALEVE` | Outras despesas; devolução positiva → Outras receitas | Outros |
| `CREDITO CONSIGNADO` ou `CRED CONSIGNAD` | Outras despesas | A categoria Empréstimo ainda não existe no cadastro atual |
| `PIX TRANSF ANDRE` | Alimentação | Transferências de baixo valor |
| `PIX QRS MUNICIPIO` | Moradia | IPTU; representa Casa na classificação informada |
| `VIVO FIXO NAC` | Telecomunicação | Rossini Telecom |
| `DROGARIA SAO PAULO SA` | Conveniência | Somente quando for despesa e o valor absoluto for menor que R$ 150 |

Os nomes acima são os nomes canônicos existentes no cadastro. Portanto, `Casa`,
`Telecom`, `Food` e `Outros` são normalizados respectivamente para as
categorias existentes `Energia e água`/`Moradia`, `Telecomunicação`,
`Alimentação` e `Outras despesas`, conforme a regra específica.

Quando uma regra determinística não puder ser resolvida para uma categoria
existente, o lançamento não deve receber uma categoria aproximada sem revisão
do usuário. Novas categorias devem ser criadas explicitamente antes de aplicar
a regra.

## Checklist de conclusão

- [ ] Arquivo original identificado e preservado.
- [ ] Datas, sinais e centavos validados.
- [ ] Duplicidade verificada por identidade normalizada.
- [ ] Quantidade origem = quantidade reconciliada.
- [ ] Soma origem = soma reconciliada.
- [ ] Saldo inicial confirmado.
- [ ] Saldo final confirmado.
- [ ] Conta corrente e cartão tratados em períodos corretos.
- [ ] Tela recarregada e valor exibido conferido.
- [ ] Resultado registrado para auditoria.
