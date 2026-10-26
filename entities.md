# Entidades

Modelo de persistência em `apps/api/prisma/schema.prisma`. Cada entidade abaixo corresponde a um `model` do Prisma. Os valores fechados ficam nas enumerações do final.

Todo `id` é a chave primária, um UUID gerado no banco. Ele identifica a linha sem depender de e-mail, número de fatura ou id externo de gateway, que podem mudar ou chegar duplicados.

Totais de dinheiro usam `Decimal(12, 4)`. Preço unitário e câmbio usam `Decimal(18, 8)`, porque preço por token não cabe em quatro casas. Quantidade usa `Decimal(18, 4)`, porque gigabyte armazenado não é inteiro.

## Customer

Empresa cliente que consome o produto e recebe a cobrança. É a âncora de assinatura, uso e fatura. Os dados fiscais ficam aqui para o PDF corporativo não depender de outro cadastro.

- **name.** Nome comercial usado no painel e na operação do dia a dia.
- **legalName.** Razão social impressa na fatura. Pode divergir do nome comercial.
- **email.** Destino de cobrança e contato único da conta. A unicidade impede dois clientes com o mesmo canal de fatura.
- **taxId.** Documento fiscal (CNPJ, VAT ou equivalente). Opcional porque nem todo ambiente de demonstração tem o dado, e obrigatório na prática para a fatura B2B quando existir.
- **billingAddress.** Endereço de cobrança em texto único, impresso no PDF. Opcional pelo mesmo motivo do documento fiscal.
- **currency.** Moeda em que este cliente é cobrado: `USD`, `BRL` ou `EUR`. É a moeda corrente da conta. A fatura copia esse valor ao abrir o período, então uma troca posterior não reescreve um ciclo já aberto.
- **createdAt.** Momento em que a conta entrou no sistema.
- **updatedAt.** Momento da última alteração cadastral. Atualizado pelo banco a cada escrita.

## SubscriptionPlan

Catálogo de um plano comercial. Guarda a mensalidade base em USD, moeda canônica do produto. O preço de cada métrica não fica aqui: um plano atende chamadas, tokens e armazenamento com preços diferentes, e esses preços mudam ao longo do tempo em `MetricPrice`.

- **name.** Nome do plano exibido no painel e copiado para a fatura no fechamento.
- **basePriceUsd.** Taxa fixa do período, em USD, independente do consumo. Entra na fatura como `baseFeeUsd` no momento do fechamento, para uma alteração posterior do plano não mudar o que já foi cobrado.
- **createdAt.** Momento em que o plano foi criado.
- **updatedAt.** Momento da última edição do plano, em geral do nome ou da taxa base.

## MetricPrice

Preço de uma métrica dentro de um plano, com vigência. Existe para que `API_CALLS`, `TOKENS` e `STORAGE_GB` tenham preços e franquias próprios, e para que uma mudança de tarifa não reprecifique consumo passado. No fechamento, a linha vigente é copiada para `InvoiceLine`.

- **planId.** Plano ao qual esta tarifa pertence.
- **metric.** O que está sendo tarifado: chamada de API, token ou gigabyte.
- **unitPriceUsd.** Preço de uma unidade, em USD, com oito casas decimais. É a escala necessária para preço por token.
- **includedQuantity.** Franquia incluída na taxa base antes de começar a cobrar. Zero significa que toda unidade é faturável.
- **effectiveFrom.** Início da vigência, inclusive. O fechamento escolhe a tarifa cujo intervalo cobre o período.
- **effectiveTo.** Fim da vigência, exclusivo na regra de negócio. Nulo significa que a tarifa ainda está vigente.
- **createdAt.** Momento em que esta versão de preço foi registrada. Não substitui a vigência: uma tarifa pode ser cadastrada hoje para valer no próximo ciclo.

O índice `(planId, metric, effectiveFrom)` serve a busca da tarifa vigente de um plano.

## Subscription

Vínculo de um cliente com um plano durante um intervalo. Substitui um `planId` direto no cliente, que apagaria o histórico quando o plano mudasse. A fatura aponta para a assinatura que estava valendo no período.

- **customerId.** Cliente titular da assinatura.
- **planId.** Plano contratado nesse intervalo.
- **startsAt.** Início em que este plano passa a valer para o cliente.
- **endsAt.** Fim do intervalo. Nulo significa que a assinatura ainda está corrente.
- **createdAt.** Momento em que o vínculo foi registrado.

O índice `(customerId, startsAt)` localiza o plano de um cliente numa data. O índice em `planId` apoia a consulta inversa, de um plano para quem o contratou.

## UsageLog

Um evento de consumo aceito pela API. É o registro bruto e auditável: a quantidade que o produtor declarou, quando ela aconteceu e a chave que impede contá-la duas vezes. Não guarda preço. O preço é resolvido no fechamento, a partir da tarifa vigente, e congelado na linha da fatura.

- **customerId.** Cliente a quem o consumo pertence.
- **invoiceId.** Fatura que absorveu o evento. Nulo enquanto o evento ainda não foi faturado. Preenchido no fechamento, dentro da mesma transação que gera as linhas. Um segundo fechamento só considera eventos com este campo nulo, então o mesmo uso não entra em duas faturas.
- **metric.** Tipo do evento. Tem de ser uma métrica que o plano saiba tarifar.
- **quantity.** Quantidade consumida na unidade da métrica. Decimal para admitir fração de gigabyte.
- **idempotencyKey.** Chave enviada pelo produtor. Única junto com `customerId`: o mesmo produtor pode repetir a chave para outro cliente, mas não para o mesmo. Uma reentrega de rede esbarra nessa restrição e não gera outra linha.
- **recordedAt.** Quando o produtor diz que o uso aconteceu. É o relógio usado para cair dentro de `periodStart` e `periodEnd`.
- **receivedAt.** Quando a API aceitou o evento. Difere de `recordedAt` quando o evento chega atrasado. O atraso fica visível, e o fechamento decide se ainda dá tempo de incluí-lo.

O índice `(customerId, recordedAt)` atende a soma de um cliente num período. O índice em `invoiceId` atende a lista de eventos de uma fatura.

## UsageDailyRollup

Soma diária de consumo por cliente e métrica. Existe porque o painel não deve varrer milhões de `UsageLog` para desenhar um gráfico. A ingestão incrementa esta linha na mesma operação que grava o evento, e só quando o evento é novo. Uma reentrega barrada pela chave de idempotência não soma de novo.

- **customerId.** Cliente da agregação.
- **metric.** Métrica agregada. Chamadas, tokens e gigabytes não se misturam na mesma linha.
- **day.** Dia civil ao qual o `recordedAt` foi reduzido. É uma data, sem horário.
- **quantity.** Total do dia para aquele cliente e métrica.
- **updatedAt.** Última vez em que a soma do dia foi incrementada.

A unicidade de `(customerId, metric, day)` garante uma única linha por combinação. O índice `(customerId, day)` atende a série temporal do painel.

## Invoice

Documento de cobrança de um período. Nasce em `METERING`, quando o ciclo abre, só com cliente, assinatura, moeda e datas. Valores, número, imposto, câmbio e PDF permanecem nulos até o fechamento. Assim a linha existe para reservar o período sem inventar totais.

A moeda, o câmbio e o imposto ficam fotografados aqui. Uma cotação nova ou uma mudança de alíquota não altera uma fatura já fechada.

- **number.** Número legível da fatura, único, atribuído quando ela é emitida. Nulo durante `METERING`. Vários nulos são permitidos pela unicidade do PostgreSQL.
- **customerId.** Cliente cobrado.
- **subscriptionId.** Assinatura, e portanto o plano, que valia neste período.
- **status.** Estado atual do documento: medição, fechamento, emitida, paga, em atraso ou anulada. O histórico de como se chegou aqui está em `InvoiceStatusHistory`.
- **periodStart.** Início do ciclo, inclusive. Único por cliente: duas faturas não podem abrir o mesmo período para a mesma conta.
- **periodEnd.** Fim do ciclo. Os eventos com `recordedAt` neste intervalo, ainda sem `invoiceId`, são os candidatos ao fechamento.
- **currency.** Moeda local da cobrança, copiada do cliente na abertura do período.
- **planName.** Nome do plano no instante do fechamento. Protege o PDF se o plano for renomeado depois.
- **baseFeeUsd.** Taxa base em USD aplicada neste ciclo, copiada do plano no fechamento.
- **usageSubtotalUsd.** Soma das linhas de consumo em USD, já descontada a franquia de cada métrica.
- **subtotalUsd.** `baseFeeUsd` mais `usageSubtotalUsd`, antes do imposto.
- **taxJurisdiction.** Jurisdição usada no cálculo do imposto. Guarda a origem da alíquota quando a API fiscal responder, ou o motivo do fallback quando não responder.
- **taxRate.** Alíquota aplicada, com seis casas. Nula até o fechamento.
- **taxAmountUsd.** Imposto em USD.
- **taxAmountLocal.** Imposto já convertido para a moeda da fatura. Os dois valores ficam guardados para a auditoria não precisar refazer a conta.
- **exchangeRate.** Cotação de 1 USD para a moeda da fatura. Oito casas, pelo mesmo motivo do preço unitário.
- **exchangeRateQuotedAt.** Horário da cotação usada. Sem isso, o número do câmbio não tem contexto de auditoria.
- **exchangeRateSource.** Provedor ou regra que forneceu a cotação, inclusive quando a fonte foi o valor de fallback.
- **exchangeRateFallback.** Verdadeiro quando a cotação não veio da API externa e o fechamento usou o valor de reserva. Deixa explícito que o total nasceu de uma degradação, não de uma cotação ao vivo.
- **totalLocal.** Valor devido na moeda do cliente, já com imposto. É o valor que o pagamento deve quitar.
- **pdfStorageUrl.** Endereço do PDF no armazenamento de objetos, preenchido quando a geração assíncrona termina.
- **pdfHash.** Hash do PDF gerado. O cliente corporativo confere o arquivo contra este valor. Só existe depois que o documento foi produzido.
- **issuedAt.** Momento em que a fatura saiu de `CLOSING` para `INVOICED`.
- **dueAt.** Vencimento. A rotina de atraso compara esta data com o relógio para ir a `PAST_DUE`.
- **paidAt.** Momento em que um pagamento bem-sucedido quitou a fatura.
- **createdAt.** Abertura da linha, em geral no início de `METERING`.
- **updatedAt.** Última escrita na fatura, seja fechamento, PDF ou mudança de estado.

O índice `(status, dueAt)` atende a lista operacional, em particular a fila de faturas vencidas. O índice em `subscriptionId` liga o documento de volta ao plano contratado.

## InvoiceLine

Uma linha do extrato de consumo congelada no fechamento. É a tabela que o PDF imprime. Quantidade e preço não são recalculados a partir do plano atual: se a tarifa mudar no dia seguinte, a linha continua explicando o valor cobrado.

- **invoiceId.** Fatura dona da linha.
- **metric.** Métrica desta linha. Uma fatura tem uma linha por métrica consumida no período.
- **description.** Texto impresso no PDF, por exemplo "API calls". Independente do nome interno da enumeração.
- **quantity.** Total consumido no período, somado dos `UsageLog` absorvidos.
- **includedQuantity.** Franquia copiada da `MetricPrice` vigente. Fica na linha para o extrato mostrar quanto entrou na taxa base.
- **billableQuantity.** Quantidade que efetivamente gera cobrança, depois de descontar a franquia. Não pode ser negativa.
- **unitPriceUsd.** Preço unitário copiado da tarifa vigente, em USD e com oito casas.
- **amountUsd.** `billableQuantity` vezes `unitPriceUsd`, em USD com quatro casas. É a parcela desta métrica dentro de `usageSubtotalUsd`.
- **sortOrder.** Ordem de impressão no PDF e no painel. Evita depender da ordem física das linhas.

## InvoiceStatusHistory

Histórico append-only das transições da fatura. A coluna `status` em `Invoice` só guarda o estado atual. Este registro responde quando a cobrança mudou, de onde para onde, por quê e por ação de quem. Uma correção não apaga a linha anterior.

- **invoiceId.** Fatura cuja transição está sendo registrada.
- **fromStatus.** Estado anterior. Nulo na criação, quando a fatura entra direto em `METERING`.
- **toStatus.** Estado novo depois da transição.
- **reason.** Motivo legível, como fechamento do ciclo, confirmação de pagamento, vencimento ou anulação.
- **actor.** Quem provocou a mudança. Pode ser o id de um operador ou `system` enquanto não existe tabela de usuário.
- **createdAt.** Momento da transição. O índice `(invoiceId, createdAt)` devolve a linha do tempo da fatura em ordem.

## Payment

Uma tentativa ou confirmação de pagamento contra uma fatura, no provedor. Existe separado do webhook porque o webhook é a mensagem recebida, e o pagamento é o fato financeiro. Dois webhooks diferentes podem confirmar o mesmo pagamento. O valor e a moeda ficam aqui, não só na fatura, para uma falha ou um reembolso terem o próprio registro.

- **invoiceId.** Fatura que este pagamento busca quitar.
- **provider.** Nome do gateway, por exemplo `stripe_mock`. Texto livre para um provedor novo não exigir migração de enumeração.
- **externalPaymentId.** Identificador do pagamento no gateway. Único junto com `provider`: o mesmo id em outro gateway é outro pagamento, e a repetição no mesmo gateway não cria outra linha.
- **status.** Situação deste pagamento: pendente, bem-sucedido, falho ou reembolsado. Uma fatura pode ter uma tentativa falha e outra bem-sucedida.
- **amount.** Valor movimentado, na moeda abaixo. Deve corresponder a `totalLocal` quando quita a fatura por inteiro.
- **currency.** Moeda do valor movimentado. Deve ser a moeda da fatura.
- **failureReason.** Motivo devolvido pelo gateway quando o status é `FAILED`. Nulo nos demais casos.
- **paidAt.** Momento em que o gateway confirmou a quitação. Nulo enquanto pendente ou falho.
- **createdAt.** Momento em que o pagamento foi registrado no sistema.
- **updatedAt.** Última mudança de status, em geral de pendente para sucesso, falha ou reembolso.

## PaymentWebhookLog

Caixa de entrada dos webhooks de pagamento. Cada entrega do gateway vira uma linha antes de alterar fatura ou pagamento. A unicidade de `(provider, externalEventId)` faz a segunda entrega concorrente falhar com conflito: a primeira segue, a repetida responde que já foi processada.

`invoiceId` é opcional porque o evento pode chegar antes de ser associado a uma fatura, ou pode não corresponder a nenhuma. O log continua existindo para auditoria.

- **provider.** Gateway que enviou o evento. Faz parte da chave de idempotência.
- **externalEventId.** Id do evento no gateway. Faz parte da chave de idempotência. Não é o id do pagamento: um pagamento pode gerar vários eventos.
- **invoiceId.** Fatura reconhecida no payload. Nulo enquanto o evento não casa com uma fatura.
- **paymentId.** Pagamento criado ou atualizado a partir deste evento. Nulo quando o evento foi ignorado ou ainda não foi aplicado.
- **status.** O que a API fez com a entrega: recebida, processada, ignorada ou falha. Permite reprocessar uma falha sem confundir com uma entrega nova.
- **rawPayload.** Corpo original do webhook. A auditoria reconstitui a decisão sem depender do gateway ainda ter o evento.
- **signatureHash.** Hash da assinatura HMAC conferida na entrada. Prova qual assinatura foi aceita, sem guardar o segredo.
- **errorMessage.** Detalhe quando o status fica `FAILED`. Nulo quando a entrega foi processada ou ignorada de propósito.
- **receivedAt.** Momento em que a API recebeu a entrega.
- **processedAt.** Momento em que a API terminou de tratá-la. Nulo enquanto o status é `RECEIVED`.

## Enumerações

### Currency

Moeda de cobrança do cliente, da fatura e do pagamento.

- **USD.** Moeda canônica dos preços de plano e das linhas.
- **BRL.** Cobrança local em real.
- **EUR.** Cobrança local em euro.

### Metric

Dimensão de consumo que o produtor envia e que o plano tarifa.

- **API_CALLS.** Número de chamadas de API.
- **TOKENS.** Tokens processados.
- **STORAGE_GB.** Gigabytes armazenados. A quantidade desta métrica é fracionária.

### InvoiceStatus

Ciclo de vida do documento de cobrança.

- **METERING.** Período aberto. A fatura reserva o intervalo e ainda não tem totais.
- **CLOSING.** Fechamento em andamento dentro da transação. Se o processo cair, o estado mostra que o ciclo não voltou a aceitar medição nem chegou a ser emitido.
- **INVOICED.** Fatura emitida, com valores congelados, número e vencimento. Aguardando pagamento.
- **PAID.** Quitada por um pagamento `SUCCEEDED`.
- **PAST_DUE.** Emitida e não paga depois de `dueAt`.
- **VOID.** Anulada. O documento deixa de ser cobrável e o histórico conserva o caminho até a anulação.

### PaymentStatus

Situação de um pagamento no gateway, independente do estado da fatura.

- **PENDING.** Registrado, ainda sem confirmação.
- **SUCCEEDED.** Confirmado. Quita a fatura quando cobre o total.
- **FAILED.** Recusado ou falho. A fatura permanece cobrável.
- **REFUNDED.** Valor devolvido depois de um sucesso. O fato fica no pagamento, sem apagar a confirmação anterior do histórico da fatura.

### WebhookProcessingStatus

O que a API fez com uma entrega de webhook.

- **RECEIVED.** Persistida e ainda não aplicada.
- **PROCESSED.** Aplicada a um pagamento e, quando couber, à fatura.
- **IGNORED.** Entrega válida que não altera cobrança, como um tipo de evento que o fluxo não usa.
- **FAILED.** A entrega não pôde ser aplicada. `errorMessage` guarda a causa e o evento pode ser reprocessado.
