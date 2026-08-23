# Painel de Controle Cripto — AAVE

Uma ferramenta **estática e local** para acompanhar suas operações de **compra e venda de AAVE**, calcular o **lucro realizado**, o **preço médio**, o **valor de mercado** e o **saldo** da sua posição — direto no navegador, **sem login e sem servidor**.

No futuro existe um planejamento de cadastro de outras moedas ou outros ativos para expandir a ferramenta.

---

## 🎯 Objetivo

Registrar as operações (compras e vendas) e poder ver, de forma clara, quanto efetivamente foi investido no ativo, quanto tem hoje e quanto já realizou de lucro — usando um método de cálculo de custo consistente e uma cotação real do AAVE atualizada automaticamente (buscada na API CoinGecko de 10 em 10 minutos - além de opção para atualizar manualmente).

## ⚙️ Como funciona

### Operações

Cada operação tem: **id**, **data** (`dateTransaction`), **tipo** (compra/venda), **valor em R$** e **quantidade em AAVE**. Você adiciona/edita pelo modal "Adicionar Nova Operação"/"Editar Operação" e remove pela ação **✕** no histórico (com confirmação).

### Método de cálculo (o coração do sistema)

O motor ([`js/portfolio.js`](js/portfolio.js)) usa **identificação específica de lotes**: ao vender, consome primeiro os lotes de **menor preço unitário** para apurar o custo base. A partir disso, calcula:

- **Total AAVE** — moedas ainda em carteira
- **Preço Médio Atual** — custo médio das moedas em carteira
- **Valor de Mercado Atual** — moedas que possui x cotação atual (CoinGecko API)
- **Lucro Realizado Total** — resultado apurado nas vendas
- **Saldo Total Realizado** — `Lucro Realizado − Total Investido`

> As operações são sempre processadas em **ordem cronológica** (por data), garantindo o casamento correto compra → venda, mesmo ao lançar operações com data retroativa.

### Cotação automática

O preço do AAVE em BRL é buscado na **API pública da CoinGecko** (`/simple/price?ids=aave&vs_currencies=brl`) **ao abrir** e **a cada 10 minutos**, além de um botão de atualização manual. O último preço conhecido fica salvo com **data/hora**, então o painel continua funcionando **mesmo offline** (usando o último valor).

## 🔐 Sem login, 100% no seu navegador

Não há cadastro, conta ou back-end. Basta **abrir o site** — todo o processamento e armazenamento acontece localmente na máquina do usuário.

## 💾 Persistência (LocalStorage)

Os dados ficam no **LocalStorage** do navegador, nas chaves:

| Chave           | Conteúdo                                                      |
| --------------- | ------------------------------------------------------------- |
| `transactions`  | Lista de operações `{ id, dateTransaction, type, brl, aave }` |
| `lastPrice`     | Último preço conhecido `{ price, updatedAt }`                 |
| `systemConfigs` | Preferências: estado do menu e contador de IDs                |

## 🗄️ Backup e Restauração

Pelo menu lateral:

- **Fazer Backup** — exporta **todo** o LocalStorage para um arquivo `backup_criptstock_AAMMDD_HHmm.json` (nome com data/hora). O conteúdo é JSON legível, por exemplo:

  ```json
  {
    "transactions": [
      {
        "id": 1,
        "dateTransaction": "2026-08-21",
        "type": "buy",
        "brl": 1000,
        "aave": 0.42599
      }
    ],
    "lastPrice": { "price": 634.86, "updatedAt": "2026-08-22T02:42:38.887Z" },
    "systemConfigs": { "menuExpanded": true, "nextTransactionId": 2 }
  }
  ```

- **Restaurar Backup** — importa um arquivo e recompõe o LocalStorage (comporta-se como um _restore_ de banco de dados).

## 📂 Estrutura do projeto

```
index.html          # marcação da interface
styles.css          # tema e layout (paleta via variáveis CSS em :root)
js/portfolio.js     # motor de cálculo (identificação específica de lotes)
js/config.js        # systemConfigs (menu, contador de IDs)
js/storage.js       # LocalStorage: carregar/salvar, migração, backup/restore
js/price.js         # busca de cotação (CoinGecko) + persistência do preço
js/app.js           # interface: dashboard, modal, menu, eventos
```

## ▶️ Como usar

Basta acessar o site no navegador. Não precisa instalar nada nem subir servidor.

## 🗺️ Próximos passos (roadmap)

> **Lembrete:** a versão atual acompanha **apenas o AAVE**. No futuro pretendemos evoluir para:
>
> - **Multi-moedas** — acompanhar vários criptoativos ao mesmo tempo.
> - **Outras classes de ativos** — estamos estudando estender o mesmo conceito para **Ações**, **FIIs** e **Títulos do Tesouro**.

## ⚠️ Aviso

Esta ferramenta foi feita para estudos e não constitui recomendação de investimento ou consultoria.
