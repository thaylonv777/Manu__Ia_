# Página /conversa — demo ao vivo da Manu

## O que tem aqui

```
conversa.html                                  -> a página em si (vai na RAIZ do repositório)
api/manu-demo.js                               -> a serverless function (vai na pasta api/ da raiz)
materiais/apresentacao-portal-primeiro-imovel.pdf  -> PDF placeholder que o agente "envia"
```

## Como instalar

1. Copie os 3 itens acima para a raiz do repositório `Manu__Ia_`, mantendo
   a mesma estrutura de pastas (crie a pasta `api/` e `materiais/` se não existirem).

2. No painel da **Vercel** (não é o GitHub Secret do blog — é outro lugar):
   `Project Settings > Environment Variables`
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: sua chave da Anthropic (mesma do blog ou uma nova, tanto faz)
   - Marque Production, Preview e Development

3. Dê commit e push. A Vercel builda sozinha. A página fica em:
   `https://www.manuai.com.br/conversa`
   (funciona por causa do `cleanUrls: true` que já existe no seu `vercel.json`)

## Testar antes de divulgar

Abra `/conversa`, mande "oi" e siga a conversa até o fim (cidade, tipo de
imóvel, renda, filhos, carteira assinada, entrada). No final, peça o material
antes de terminar de responder tudo — ela vai te enrolar educadamente e só
soltar o PDF depois que a qualificação estiver completa. É esse o
comportamento esperado, do jeito que o agente real faz.

## Trocar o PDF pelo de verdade

Quando tiver o PDF real do Portal do Primeiro Imóvel:
1. Suba o arquivo em `materiais/` com o nome que preferir.
2. Em `api/manu-demo.js`, ache o objeto `PDF_MAP` e troque a `url` pelo
   caminho do novo arquivo (e o `name` se quiser mudar o texto exibido).

## Se quiser atualizar as regras do agente depois

O prompt completo mora na constante `SYSTEM_PROMPT`, no topo de
`api/manu-demo.js`. É só editar o texto — não precisa mexer em mais nada.
Lembre de manter o agente real (na Helena) e este arquivo sincronizados
manualmente; um não atualiza o outro sozinho.

## Sobre custo

Cada mensagem trocada chama a API da Anthropic (modelo `claude-sonnet-4-6`).
É pago por uso, mas o custo por conversa de demonstração é bem baixo
(poucos centavos de dólar mesmo numa conversa longa). Não usa WhatsApp,
não usa a Helena, não gera custo de template.
