# Automacao de blog da Manu.ia

Sistema que gera **1 artigo por dia** para o blog usando a API da Anthropic,
cria a pagina HTML na identidade visual do site, atualiza o indice e o sitemap,
e **abre um Pull Request** para voce revisar antes de publicar.

## O que tem aqui

```
blog/
  index.html        -> indice do blog (gerado automaticamente)
  posts.json        -> lista de artigos (fonte da verdade)
  *.html            -> uma pagina por artigo
scripts/
  gerar-artigo.mjs  -> script de geracao (Node, sem dependencias)
  exemplo-artigo.json -> artigo de teste (para rodar sem gastar API)
.github/workflows/
  artigo-diario.yml -> agendamento diario + abertura de PR
sitemap.xml         -> atualizado a cada artigo
```

## Configuracao (uma vez so)

1. **Copie estes arquivos para a raiz do repositorio** `thaylonv777/Manu__Ia_`,
   mantendo a estrutura de pastas acima.

2. **Adicione a chave da API** em:
   `Settings -> Secrets and variables -> Actions -> New repository secret`
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: sua chave da Anthropic (`sk-ant-...`)

3. **Libere o Actions a abrir PRs** em:
   `Settings -> Actions -> General -> Workflow permissions`
   - Marque **Read and write permissions**
   - Marque **Allow GitHub Actions to create and approve pull requests**

4. **(Recomendado) Coloque um link para o blog** no menu do `index.html`,
   para o Google e os visitantes acharem. Dentro de `<nav>`, adicione:
   ```html
   <a href="/blog/">Blog</a>
   ```

## Como funciona o dia a dia

- Todo dia as **09:00 (horario de Brasilia)** o workflow roda sozinho.
- Ele gera o artigo e abre um **Pull Request** chamado
  "Novo artigo do blog para revisao".
- Voce abre o PR, le o artigo, e:
  - **Aprova e faz merge** -> o artigo entra no ar (deploy automatico).
  - **Fecha sem merge** -> o artigo e descartado.

## Rodar na hora (sem esperar o horario)

No GitHub: aba **Actions -> Artigo diario (Manu.ia) -> Run workflow**.

## Testar localmente sem gastar API

```bash
ARTIGO_LOCAL=scripts/exemplo-artigo.json node scripts/gerar-artigo.mjs
```

Isso gera um artigo de exemplo e monta o indice/sitemap, sem chamar a API.

## Onde controlar o conteudo (tudo em scripts/gerar-artigo.mjs)

- **`KEYWORDS`** -> lista de palavras-chave alvo (1 artigo = 1 keyword).
  Ja vem com as keywords filtradas por volume/intencao (sem concorrentes,
  sem "gratis"). O script cicla a lista para nao repetir. Adicione/remova
  termos aqui.
- **`systemPrompt`** -> a "voz da marca" e as regras de redacao. Ja traz:
  - o posicionamento da Manu.ia (site + Instagram);
  - regras anti-promessa (nao mente, nao inventa dado, nao cita preco);
  - regras de SEO profissional (uso da keyword no titulo, meta, H2 etc.);
  - exigencia da secao "Fontes e referencias".
- O **CTA** (botao "Falar com a Manu agora") aponta para o WhatsApp oficial,
  o mesmo numero do site, definido na constante `WHATSAPP`. A IA e proibida
  de escrever outro numero no texto.

Para editar: no GitHub abra `scripts/gerar-artigo.mjs` -> lapis (Edit) ->
ajuste o texto -> Commit. Vale na proxima execucao, sem deploy.

## Ajustes uteis

- **Horario:** mude a linha `cron: '0 12 * * *'` no `.yml`.
  Lembre: e UTC. `12` UTC = `9h` BRT.
- **Frequencia (ex: 3x por semana):** use `cron: '0 12 * * 1,3,5'`
  (segunda, quarta e sexta).
- **Dominio:** confirme o `SITE_URL` no `.yml`. Hoje esta
  `https://www.manuai.com.br`. Se o site no ar for outro (ex:
  manu.com.br), ajuste ali para os links e o sitemap ficarem corretos.
- **Modelo:** por padrao usa `claude-sonnet-4-6`. Para trocar, defina
  `ANTHROPIC_MODEL` no `.yml`.

## Observacao sobre SEO

Publicar com revisao (o fluxo de PR) protege a qualidade. Evite aprovar no
automatico sem ler: conteudo raso ou repetitivo em volume pode prejudicar o
dominio em vez de ajudar.
