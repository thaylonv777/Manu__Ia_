#!/usr/bin/env node
/**
 * gerar-artigo.mjs (v2 - SEO fix)
 * --------------------------------------------------------------
 * MUDANCAS CRITICAS vs v1:
 *   1. BUG FIX: se o slug ja existe, PULA em vez de criar duplicata
 *      (era isso que gerava -egg0, -yk52, etc)
 *   2. Anti-canibalizacao: se a keyword ja foi usada nos ultimos
 *      MIN_DIAS_ENTRE_KEYWORD dias, pula
 *   3. Lista de KEYWORDS expandida (14 -> 40+ long-tail)
 *   4. Bloco "Artigos relacionados" adicionado ao fim de cada post
 *      (internal linking automatico baseado em posts.json existente)
 *   5. Schema.org enriquecido: Article + BreadcrumbList, com
 *      wordCount, inLanguage, articleSection
 *   6. Se todas as keywords foram usadas nos ultimos N dias,
 *      script encerra graciosamente (nao gera nada)
 *
 * Uso em CI:  node scripts/gerar-artigo.mjs   (precisa de ANTHROPIC_API_KEY)
 * Teste local sem API:
 *   ARTIGO_LOCAL=scripts/exemplo-artigo.json node scripts/gerar-artigo.mjs
 * --------------------------------------------------------------
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

// ---------- Configuracao ----------
const SITE_URL = (process.env.SITE_URL || 'https://www.manuai.com.br').replace(/\/+$/, '');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ARTIGO_LOCAL = process.env.ARTIGO_LOCAL;

// Anti-canibalizacao: nao repetir a mesma keyword em menos de X dias
const MIN_DIAS_ENTRE_KEYWORD = parseInt(process.env.MIN_DIAS_ENTRE_KEYWORD || '30', 10);

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'blog');
const POSTS_JSON = path.join(BLOG_DIR, 'posts.json');
const SITEMAP = path.join(ROOT, 'sitemap.xml');

const LOGO = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/logo_principal_dark-removebg.png';
const OG_IMAGE = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/icon_principal.png';
const FAVICON = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/icon_navegador.png';
const WHATSAPP = 'https://wa.me/5551993933653?text=Ol%C3%A1!%20Tenho%20interesse%20na%20Manu.ia.';

const IMAGENS = [
  { arq: 'plataforma-completa', desc: 'visao geral da plataforma Manu.ia (uso geral)' },
  { arq: 'central-de-atendimento', desc: 'central de atendimento unificado / caixa de conversas' },
  { arq: 'crm', desc: 'CRM, funil de vendas, cards e gestao de leads' },
  { arq: 'chatbot', desc: 'chatbot e automacoes de fluxo sem codigo' },
  { arq: 'disparo-de-campanha-api-oficial', desc: 'disparo de campanha em massa via WhatsApp API oficial' },
  { arq: 'rastreabilidade-de-campanha', desc: 'relatorios e rastreamento de campanhas' },
  { arq: 'agente-inteligentes', desc: 'agentes de IA e supervisor de IA atendendo' },
];
const IMAGENS_VALIDAS = IMAGENS.map((i) => i.arq);

// ---------- Palavras-chave alvo (expandida: 40+ long-tail) ----------
const KEYWORDS = [
  // === Keywords originais (mantidas) ===
  { kw: 'crm para whatsapp', angulo: 'o que e, para que serve e quando faz sentido para um time de vendas' },
  { kw: 'crm whatsapp', angulo: 'como centralizar conversas e nao perder o historico do cliente' },
  { kw: 'crm com ia', angulo: 'o que muda quando o crm tem inteligencia artificial no atendimento' },
  { kw: 'chatbot com ia para whatsapp', angulo: 'diferenca entre chatbot de regra e agente de ia que conversa de verdade' },
  { kw: 'crm integrado com whatsapp', angulo: 'por que integrar o atendimento ao crm em vez de planilha' },
  { kw: 'whatsapp automatizado', angulo: 'o que da para automatizar no atendimento sem robotizar o cliente' },
  { kw: 'automacao de atendimento whatsapp', angulo: 'fluxo de atendimento automatico do primeiro oi ate o lead qualificado' },
  { kw: 'melhor crm whatsapp', angulo: 'criterios para escolher um crm de whatsapp (sem ranking de marcas)' },
  { kw: 'agente de ia no whatsapp', angulo: 'o que um agente de ia faz no atendimento e o que ele nao faz' },
  { kw: 'ia para qualificacao de leads', angulo: 'como a ia separa curioso de comprador antes do vendedor entrar' },
  { kw: 'automacao de atendimento com ia', angulo: 'atendimento 24h sem perder o tom humano' },
  { kw: 'crm vendas whatsapp', angulo: 'como o crm ajuda o time de vendas a fechar mais pelo whatsapp' },
  { kw: 'crm atendimento whatsapp', angulo: 'organizar atendimento e gestao das conversas em um lugar so' },
  { kw: 'atendimento automatizado no whatsapp', angulo: 'o custo do silencio e da demora para responder um lead' },

  // === Novas keywords long-tail (baixa concorrencia, alta intencao) ===
  { kw: 'follow up automatico whatsapp', angulo: 'como manter o lead aquecido sem depender da memoria do vendedor' },
  { kw: 'qualificacao de leads whatsapp', angulo: 'processo para entregar so lead pronto pro vendedor humano' },
  { kw: 'atendimento 24 horas whatsapp', angulo: 'como cobrir madrugada e fim de semana sem contratar plantao' },
  { kw: 'whatsapp api oficial', angulo: 'diferenca entre whatsapp business normal e api oficial da meta' },
  { kw: 'multiatendimento whatsapp', angulo: 'como varios atendentes usarem um so numero sem confusao' },
  { kw: 'disparo em massa whatsapp', angulo: 'como fazer campanhas sem tomar ban da meta' },
  { kw: 'chatbot whatsapp para empresas', angulo: 'quando faz sentido implementar chatbot no comercial' },
  { kw: 'automacao de vendas whatsapp', angulo: 'onde a automacao entra no funil de vendas sem substituir o vendedor' },
  { kw: 'agente de ia para vendas', angulo: 'como um agente de ia atua no pre-venda e handoff pro humano' },
  { kw: 'gestao de atendimento whatsapp', angulo: 'metricas e visibilidade que gestor precisa ter do atendimento' },
  { kw: 'central de atendimento whatsapp', angulo: 'como estruturar central de atendimento no whatsapp com filas e distribuicao' },
  { kw: 'crm para pequenas empresas whatsapp', angulo: 'crm de whatsapp para pequeno negocio: quando vale a pena' },
  { kw: 'ia no atendimento ao cliente', angulo: 'onde a ia melhora o atendimento e onde ela ainda nao substitui humano' },
  { kw: 'tempo de resposta whatsapp', angulo: 'impacto do tempo de resposta na taxa de conversao de leads' },
  { kw: 'lead frio whatsapp', angulo: 'por que o lead esfria e como reaquecer com follow-up automatico' },
  { kw: 'funil de vendas whatsapp', angulo: 'como estruturar funil de vendas dentro do whatsapp' },
  { kw: 'integracao whatsapp crm', angulo: 'o que ganhar quando o whatsapp e o crm falam a mesma lingua' },
  { kw: 'nao perder lead whatsapp', angulo: 'principais razoes pelas quais leads se perdem no whatsapp e como evitar' },
  { kw: 'vendas pelo whatsapp', angulo: 'boas praticas para vender pelo whatsapp com processo estruturado' },
  { kw: 'crm com whatsapp integrado', angulo: 'diferenca entre crm generico e crm nativo do whatsapp' },
  { kw: 'ia conversacional whatsapp', angulo: 'o que e ia conversacional aplicada ao whatsapp e o que ela consegue fazer' },
  { kw: 'sequencia de mensagens whatsapp', angulo: 'como montar cadencia de follow-up sem parecer spam' },
  { kw: 'atendimento comercial whatsapp', angulo: 'padrao de atendimento comercial que converte no whatsapp' },
  { kw: 'painel de atendimento whatsapp', angulo: 'o que um bom painel de atendimento no whatsapp deve mostrar' },
  { kw: 'automatizar primeiro atendimento whatsapp', angulo: 'como o primeiro atendimento automatizado quebra o silencio inicial' },
  { kw: 'agente de ia treinado para o negocio', angulo: 'diferenca entre chatbot generico e agente de ia com base de conhecimento' },
  { kw: 'transferencia de atendimento whatsapp', angulo: 'como transferir atendimento entre humano e ia sem perder o contexto' },
  { kw: 'historico de conversa whatsapp', angulo: 'por que preservar o historico completo muda a qualidade do atendimento' },
  { kw: 'carteirizacao whatsapp', angulo: 'vincular contatos a responsaveis especificos e o impacto na relacao' },
  { kw: 'supervisor de ia atendimento', angulo: 'o que um supervisor de ia faz e como ele orquestra outros agentes' },
];

// ---------- Utilidades ----------
function slugify(txt) {
  return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);
}
function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hojeISO() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // BRT
  return d.toISOString().slice(0, 10);
}
function diasEntre(iso1, iso2) {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return Math.abs((d2 - d1) / 86400000);
}
function dataExtenso(iso) {
  const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${meses[m - 1]} de ${y}`;
}
async function existe(p) { try { await access(p, constants.F_OK); return true; } catch { return false; } }
async function lerPosts() {
  if (!(await existe(POSTS_JSON))) return [];
  try { return JSON.parse(await readFile(POSTS_JSON, 'utf8')); } catch { return []; }
}
function contarPalavras(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim().split(' ').length;
}

// ---------- Anti-canibalizacao ----------
// Filtra keywords ainda "seguras" (nao usadas nos ultimos MIN_DIAS_ENTRE_KEYWORD dias)
function escolherKeyword(posts) {
  const hoje = hojeISO();
  const usadasRecentes = new Set(
    posts
      .filter((p) => diasEntre(p.data, hoje) < MIN_DIAS_ENTRE_KEYWORD)
      .map((p) => p.keyword)
  );
  const disponiveis = KEYWORDS.filter((k) => !usadasRecentes.has(k.kw));
  if (disponiveis.length === 0) return null; // TODAS foram usadas recentemente
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

// ---------- Artigos relacionados (internal linking) ----------
// Escolhe ate 3 posts existentes que compartilhem palavras com a keyword atual
function escolherRelacionados(posts, keywordAlvo, slugAtual, max = 3) {
  const palavrasAlvo = new Set(
    keywordAlvo.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  );
  const scored = posts
    .filter((p) => p.slug !== slugAtual)
    .map((p) => {
      const palavrasPost = new Set((p.keyword || '').toLowerCase().split(/\s+/));
      let score = 0;
      palavrasAlvo.forEach((w) => { if (palavrasPost.has(w)) score++; });
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.p.data) - new Date(a.p.data))
    .slice(0, max)
    .map((x) => x.p);
  return scored;
}

// ---------- Geracao via API ----------
async function gerarArtigoViaAPI(alvo, titulosRecentes) {
  const systemPrompt =
`Voce e redator(a) de conteudo SEO da Manu.ia, escrevendo no padrao de uma boa
agencia: artigos assertivos, uteis e que geram valor real para o leitor.

== SOBRE A MANU.IA (fatos reais do produto; use SO o que esta aqui) ==
A Manu.ia e uma plataforma de CRM e atendimento inteligente via WhatsApp que
unifica, automatiza e escala o atendimento de empresas, combinando agentes de
inteligencia artificial, CRM integrado e atendimento humano num so ambiente,
sem perder a humanizacao. Posicionamento: "inteligencia no atendimento que
converte, para quem quer vender de verdade".

Problemas que a Manu.ia resolve:
- Demora no primeiro atendimento e perda do lead por isso.
- Leads perdidos por falta de follow-up.
- Atendimento sem padrao e sem qualidade consistente.
- Dificuldade de qualificar o lead antes de passar pro time comercial.
- Falta de visibilidade do funil de vendas.
- Equipe sobrecarregada com tarefas repetitivas.
- Varios numeros/aparelhos descentralizados, sem historico unificado.

Funcoes e habilidades REAIS (cite com precisao, nunca invente outras):
- Atendimento unificado: um unico numero de WhatsApp para toda a equipe;
  conversas de WhatsApp, Instagram e Messenger centralizadas, com historico
  completo, distribuicao de atendimentos, filas e controle em tempo real.
- Agentes de IA: atendem, qualificam e respondem duvidas 24h; cada agente e
  configurado com regras, habilidades e base de conhecimento do negocio (nao e
  chatbot generico); varios agentes podem atuar na mesma conversa.
- Supervisor de IA: orquestrador que monitora a conversa em tempo real, entende
  a intencao e aciona o agente certo para cada situacao.
- CRM integrado ao WhatsApp: funis personalizados, campos customizados, cards de
  CRM e historico, tudo dentro da conversa.
- Qualificacao automatica: o agente coleta informacoes, preenche os campos do CRM
  e entrega o lead qualificado ao vendedor humano.
- Follow-up automatico e sequencias/cadencias: mensagens automaticas para quem
  nao respondeu, para nutrir e reaquecer contatos.
- Disparo de campanhas em massa via WhatsApp API oficial, com relatorios.
- Chatbot e automacoes sem codigo (fluxos visuais, logicas condicionais).
- Transferencia inteligente sem perder o contexto.
- Carteirizacao: vinculacao de contatos a responsaveis especificos.
- Integracoes via API, Make e N8N (ex: Facebook Lead Ads, CRMs externos).
- WhatsApp API oficial da Meta: seguranca, estabilidade e sem risco de banimento.

Diferenciais: numero centralizado com multiplos atendentes (sem varios chips);
agente de IA treinado para o negocio especifico; CRM e atendimento no mesmo
ambiente; follow-up automatico; qualificacao antes do humano; 24/7; API oficial.

O que a Manu.ia NAO e (posicionamento honesto, use como verdade central):
- NAO substitui o relacionamento humano: ela potencializa. A IA cuida do primeiro
  atendimento, da qualificacao e do follow-up; o fechamento, a negociacao e o
  relacionamento aprofundado continuam com o time humano.
- O inimigo que a marca combate e o SILENCIO e a DEMORA para responder, que fazem
  o lead esfriar e fechar com o concorrente.

IMPORTANTE: relacione o tema do artigo a UMA ou DUAS funcoes especificas acima
quando fizer sentido (ex: supervisor de IA, CRM no WhatsApp, carteirizacao,
follow-up automatico), de forma natural e sem parecer anuncio. Nao force todas e sempre em todo artigo frise o nome Manu, ex: Com a Manu você terá um fluxo completo de automação.
Reforce a marca nos titulos e artigos, na primeira pessoa, não simplesmente como um CRM GENÉRICO. 

== REGRAS INEGOCIAVEIS (honestidade) ==
- NUNCA prometa resultado numerico ("aumente 300% das vendas", "dobre o
  faturamento"). Fale de mecanismo e beneficio, nao de milagre.
- NUNCA invente estatistica, estudo, percentual ou "pesquisa diz que".
- NUNCA invente funcionalidade que nao esta descrita acima.
- NUNCA cite preco, plano ou valores.
- NUNCA invente telefone, link ou outro canal. O unico CTA e o WhatsApp oficial,
  que ja e inserido pelo site (nao escreva numero de telefone no texto).
- Tom: claro, direto, profissional, sem jargao vazio e sem "no mundo de hoje".

== SEO (obrigatorio, nivel profissional) ==
- O artigo e construido em torno da PALAVRA-CHAVE ALVO informada pelo usuario.
- Use a palavra-chave alvo: no titulo, na meta description, na primeira frase do
  primeiro paragrafo, em pelo menos um <h2> e mais 2 a 3 vezes ao longo do texto,
  de forma natural (sem encher linguica / keyword stuffing).
- Use variacoes e termos relacionados (semantica) ao longo do texto.
- Estrutura escaneavel: paragrafos curtos, <h2> e <h3> claros.

== FORMATO DE RESPOSTA (siga EXATAMENTE) ==
Responda usando EXATAMENTE estes marcadores, nesta ordem, sem nada antes nem
depois, sem blocos de markdown e SEM JSON:
===TITULO===
(titulo de 50-65 caracteres, contendo a palavra-chave alvo)
===DESCRICAO===
(meta description de 120-155 caracteres, contendo a palavra-chave)
===KEYWORDS===
(palavra-chave alvo, depois 4 a 6 termos relacionados, separados por virgula)
===LEITURA===
(ex: 5 min)
===IMAGEM===
(escolha UM nome exato da lista de imagens abaixo que melhor combine com o tema
do artigo, ou deixe VAZIO se nenhuma combinar bem. Escreva so o nome, sem .png)
Imagens disponiveis:
${IMAGENS.map((i) => `- ${i.arq}: ${i.desc}`).join('\n')}
===CORPO===
(corpo do artigo em HTML semantico)

== REGRAS DO corpoHtml ==
- Use apenas: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>.
- NAO use <a>, estilos inline, classes, <h1>, <html>, <head> ou <body>.
- Entre 900 e 1200 palavras.
- NAO escreva uma chamada final do tipo "fale conosco" nem CTA no texto: o site
  ja insere um bloco de CTA com o WhatsApp depois do corpo.
- NAO inclua secao de "Fontes e referencias". Encerre com um paragrafo de
  conclusao objetivo.`;

  const userPrompt =
`PALAVRA-CHAVE ALVO: "${alvo.kw}"
ANGULO SUGERIDO: ${alvo.angulo}

Escreva o artigo otimizado para essa palavra-chave, seguindo todas as regras.
Evite repetir estes titulos ja publicados: ${titulosRecentes.join(' | ') || 'nenhum'}.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!resp.ok) throw new Error(`API respondeu ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const raw = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

  const corte = (txt, ini, fim) => {
    const a = txt.indexOf(ini);
    if (a === -1) return '';
    const start = a + ini.length;
    const b = fim ? txt.indexOf(fim, start) : -1;
    return (b === -1 ? txt.slice(start) : txt.slice(start, b)).trim();
  };

  const artigo = {
    titulo: corte(raw, '===TITULO===', '===DESCRICAO==='),
    descricao: corte(raw, '===DESCRICAO===', '===KEYWORDS==='),
    keywords: corte(raw, '===KEYWORDS===', '===LEITURA===').split(',').map((s) => s.trim()).filter(Boolean),
    leitura: corte(raw, '===LEITURA===', '===IMAGEM==='),
    imagem: corte(raw, '===IMAGEM===', '===CORPO==='),
    corpoHtml: corte(raw, '===CORPO===', null),
  };

  const imgLimpa = (artigo.imagem || '').replace(/\.png$/i, '').trim();
  artigo.imagem = IMAGENS_VALIDAS.includes(imgLimpa) ? imgLimpa : '';

  if (!artigo.titulo || !artigo.corpoHtml) {
    throw new Error('Resposta da IA veio sem titulo ou corpo. Resposta bruta:\n' + raw);
  }
  return artigo;
}

// ---------- Render do artigo (com internal linking + schema enriquecido) ----------
function renderArtigo(artigo, slug, dataISO, relacionados) {
  const url = `${SITE_URL}/blog/${slug}`;
  const heroImg = artigo.imagem ? `${SITE_URL}/${artigo.imagem}.png` : '';
  const ogImg = heroImg || OG_IMAGE;
  const titulo = escapeHtml(artigo.titulo);
  const descricao = escapeHtml(artigo.descricao);
  const keywords = escapeHtml((artigo.keywords || []).join(', '));
  const leitura = escapeHtml(artigo.leitura || '');
  const wordCount = contarPalavras(artigo.corpoHtml);

  // Schema.org: Article + BreadcrumbList
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: artigo.titulo,
    description: artigo.descricao,
    image: ogImg,
    datePublished: dataISO,
    dateModified: dataISO,
    inLanguage: 'pt-BR',
    wordCount: wordCount,
    keywords: (artigo.keywords || []).join(', '),
    articleSection: 'CRM e Atendimento WhatsApp',
    author: { '@type': 'Organization', name: 'Manu.ia', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Manu.ia',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
      { '@type': 'ListItem', position: 3, name: artigo.titulo, item: url },
    ],
  };

  const relacionadosHtml = relacionados.length ? `
    <aside class="related">
      <h2>Continue lendo</h2>
      <div class="related-grid">
${relacionados.map((r) => `        <a class="related-card" href="/blog/${escapeHtml(r.slug)}">
          <span class="related-eyebrow">Artigo</span>
          <h3>${escapeHtml(r.titulo)}</h3>
          <span class="related-arrow">Ler artigo →</span>
        </a>`).join('\n')}
      </div>
    </aside>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="${FAVICON}">
<title>${titulo} | Blog Manu.ia</title>
<meta name="description" content="${descricao}">
<meta name="keywords" content="${keywords}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${descricao}">
<meta property="og:image" content="${ogImg}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Manu.ia">
<meta property="og:locale" content="pt_BR">
<meta property="article:published_time" content="${dataISO}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titulo}">
<meta name="twitter:description" content="${descricao}">
<meta name="twitter:image" content="${ogImg}">
<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', -apple-system, sans-serif; background: #0D0818; color: #fff; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
:root { --bg: #0D0818; --magenta: #D060FF; --magenta-deep: #8A05BE; --grid: rgba(150,80,255,0.04); }
a { color: inherit; }
.grid-bg { background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 60px 60px; }
.gradient-text { background: linear-gradient(135deg, #D060FF 0%, #8A05BE 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding: 18px 0; transition: all 0.3s; }
header.scrolled { background: rgba(13,8,24,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); }
.header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.nav-back { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; display: inline-flex; align-items: center; gap: 6px; }
.nav-back:hover { color: #fff; }
.article-wrap { position: relative; max-width: 720px; margin: 0 auto; padding: 140px 24px 80px; }
.article-bg { position: fixed; inset: 0; opacity: 0.5; z-index: -1; }
.article-orb { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 700px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(208,96,255,0.16) 0%, transparent 65%); filter: blur(50px); z-index: -1; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; color: var(--magenta); margin-bottom: 20px; }
.eyebrow-dot { width: 6px; height: 6px; background: var(--magenta); border-radius: 50%; }
.article-title { font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; margin-bottom: 20px; }
.article-meta { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; color: rgba(255,255,255,0.5); font-size: 13px; padding-bottom: 32px; margin-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.prose { font-size: 1.1rem; line-height: 1.85; color: rgba(255,255,255,0.82); }
.prose h2 { font-size: 1.6rem; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; color: #fff; margin: 2.4em 0 0.7em; padding-left: 16px; border-left: 3px solid var(--magenta); }
.prose h3 { font-size: 1.25rem; font-weight: 600; color: #fff; margin: 1.8em 0 0.5em; }
.prose p { margin: 0 0 1.3em; }
.prose ul, .prose ol { margin: 0 0 1.4em; padding-left: 1.4em; }
.prose li { margin-bottom: 0.6em; }
.prose li::marker { color: var(--magenta); }
.prose strong { color: #fff; font-weight: 600; }
.article-cta { margin: 56px 0 0; padding: 36px; border-radius: 20px; background: rgba(208,96,255,0.06); backdrop-filter: blur(20px); border: 1px solid rgba(208,96,255,0.18); text-align: center; }
.article-cta h3 { font-size: 1.4rem; font-weight: 700; margin-bottom: 12px; }
.article-cta p { color: rgba(255,255,255,0.6); margin-bottom: 24px; line-height: 1.55; }
.btn-primary { background: linear-gradient(135deg, #D060FF 0%, #8A05BE 100%); color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; transition: opacity 0.2s; box-shadow: 0 0 60px rgba(208,96,255,0.18); }
.btn-primary:hover { opacity: 0.9; }
.related { margin-top: 72px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.08); }
.related h2 { font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 24px; }
.related-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.related-card { display: block; padding: 20px 22px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); text-decoration: none; transition: border-color 0.3s, transform 0.3s; }
.related-card:hover { border-color: rgba(208,96,255,0.35); transform: translateY(-2px); }
.related-eyebrow { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; color: var(--magenta); margin-bottom: 8px; }
.related-card h3 { font-size: 1rem; font-weight: 600; line-height: 1.35; color: #fff; margin-bottom: 10px; }
.related-arrow { font-size: 13px; color: rgba(255,255,255,0.55); }
footer { padding: 40px 24px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 80px; }
.footer-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.footer-copy { font-size: 11px; color: rgba(255,255,255,0.4); }
.whatsapp-float { position: fixed; bottom: 24px; right: 24px; z-index: 40; padding: 12px 20px; border-radius: 9999px; background: linear-gradient(135deg, #D060FF 0%, #8A05BE 100%); box-shadow: 0 10px 30px rgba(208,96,255,0.3); display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: #fff; text-decoration: none; transition: transform 0.2s; }
.whatsapp-float:hover { transform: scale(1.05); }
.icon-svg { width: 22px; height: 22px; stroke: #fff; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
</style>
</head>
<body>
<div class="article-bg grid-bg"></div>
<div class="article-orb"></div>
<header id="header">
  <div class="header-inner">
    <a href="/" class="logo"><img src="${LOGO}" alt="Manu.ia" style="height:30px;width:auto;"></a>
    <a href="/blog/" class="nav-back">
      <svg class="icon-svg" style="width:16px;height:16px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Voltar ao blog
    </a>
  </div>
</header>
<main class="article-wrap">
  <article>
    <span class="eyebrow"><span class="eyebrow-dot"></span>Blog Manu.ia</span>
    <h1 class="article-title">${titulo}</h1>
    <div class="article-meta">
      <span>${dataExtenso(dataISO)}</span>
      ${leitura ? `<span>&middot; ${leitura} de leitura</span>` : ''}
    </div>
    ${heroImg ? `<img src="${heroImg}" alt="${titulo}" style="width:100%;height:auto;border-radius:16px;border:1px solid rgba(255,255,255,0.08);margin-bottom:40px;display:block;">` : ''}
    <div class="prose">
${artigo.corpoHtml}
    </div>
    <div class="article-cta">
      <h3>Cansado de perder lead por <span class="gradient-text">demora no WhatsApp?</span></h3>
      <p>A Manu.ia atende 24h, qualifica e faz o follow-up. Seu time assume o lead ja aquecido.</p>
      <a href="${WHATSAPP}" target="_blank" rel="noopener" class="btn-primary">
        <svg class="icon-svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Falar com a Manu agora
      </a>
    </div>
${relacionadosHtml}
  </article>
</main>
<footer>
  <div class="footer-inner">
    <a href="/" class="logo"><img src="${LOGO}" alt="Manu.ia" style="height:26px;width:auto;"></a>
    <p class="footer-copy">&copy; ${dataISO.slice(0,4)} Manu.ia &middot; Produto desenvolvido pela Assessoria Atrio</p>
  </div>
</footer>
<a href="${WHATSAPP}" target="_blank" rel="noopener" class="whatsapp-float">
  <svg class="icon-svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  WhatsApp
</a>
<script>
window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40);
});
</script>
</body>
</html>`;
}

// ---------- Render do indice ----------
function renderIndice(posts) {
  const cards = posts.map((p) => `
      <a class="post-card" href="/blog/${escapeHtml(p.slug)}">
        <span class="post-date">${escapeHtml(dataExtenso(p.data))}</span>
        <h2 class="post-title">${escapeHtml(p.titulo)}</h2>
        <p class="post-desc">${escapeHtml(p.descricao || '')}</p>
        <span class="post-link">Ler artigo
          <svg class="icon-svg" style="width:16px;height:16px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
      </a>`).join('\n');

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog Manu.ia',
    description: 'Conteudos sobre CRM com IA, atendimento automatizado e qualificacao de leads no WhatsApp.',
    url: `${SITE_URL}/blog/`,
    inLanguage: 'pt-BR',
    publisher: {
      '@type': 'Organization',
      name: 'Manu.ia',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: LOGO },
    },
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="${FAVICON}">
<title>Blog Manu.ia | CRM com IA, atendimento e vendas no WhatsApp</title>
<meta name="description" content="Conteudos praticos sobre CRM com IA, atendimento automatizado no WhatsApp, qualificacao de leads e como nao perder oportunidades comerciais.">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${SITE_URL}/blog/">
<meta property="og:type" content="website">
<meta property="og:title" content="Blog Manu.ia | CRM com IA e vendas no WhatsApp">
<meta property="og:description" content="Conteudos praticos sobre CRM com IA, atendimento automatizado no WhatsApp e qualificacao de leads.">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:url" content="${SITE_URL}/blog/">
<meta property="og:site_name" content="Manu.ia">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Blog Manu.ia | CRM com IA e vendas no WhatsApp">
<meta name="twitter:description" content="Conteudos praticos sobre CRM com IA, atendimento automatizado no WhatsApp e qualificacao de leads.">
<meta name="twitter:image" content="${OG_IMAGE}">
<script type="application/ld+json">${JSON.stringify(blogSchema)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', -apple-system, sans-serif; background: #0D0818; color: #fff; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
:root { --magenta: #D060FF; --magenta-deep: #8A05BE; --grid: rgba(150,80,255,0.04); }
.grid-bg { background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 60px 60px; position: fixed; inset: 0; opacity: 0.5; z-index: -1; }
.orb { position: fixed; top: -200px; left: 50%; transform: translateX(-50%); width: 700px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(208,96,255,0.16) 0%, transparent 65%); filter: blur(50px); z-index: -1; }
.gradient-text { background: linear-gradient(135deg, #D060FF 0%, #8A05BE 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; padding: 18px 0; transition: all 0.3s; }
header.scrolled { background: rgba(13,8,24,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); }
.header-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
.nav-back { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: color 0.2s; }
.nav-back:hover { color: #fff; }
.icon-svg { stroke: #fff; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 150px 24px 80px; }
.blog-head { max-width: 700px; margin-bottom: 64px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 600; color: var(--magenta); margin-bottom: 18px; }
.eyebrow-dot { width: 6px; height: 6px; background: var(--magenta); border-radius: 50%; }
.blog-head h1 { font-size: clamp(2.2rem, 5vw, 3.4rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 18px; }
.blog-head p { font-size: 1.125rem; color: rgba(255,255,255,0.6); line-height: 1.6; }
.posts-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 720px) { .posts-grid { grid-template-columns: repeat(2, 1fr); } }
.post-card { display: flex; flex-direction: column; padding: 32px; border-radius: 18px; text-decoration: none; color: #fff; background: rgba(255,255,255,0.03); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.08); transition: border-color 0.3s, transform 0.3s; }
.post-card:hover { border-color: rgba(208,96,255,0.35); transform: translateY(-4px); }
.post-date { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.45); margin-bottom: 14px; }
.post-title { font-size: 1.35rem; font-weight: 600; line-height: 1.25; margin-bottom: 12px; }
.post-desc { color: rgba(255,255,255,0.6); line-height: 1.55; font-size: 0.95rem; flex-grow: 1; margin-bottom: 20px; }
.post-link { display: inline-flex; align-items: center; gap: 6px; color: var(--magenta); font-weight: 600; font-size: 14px; }
.empty { color: rgba(255,255,255,0.5); font-size: 1rem; }
footer { padding: 40px 24px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 60px; }
.footer-inner { max-width: 1100px; margin: 0 auto; text-align: center; }
.footer-copy { font-size: 11px; color: rgba(255,255,255,0.4); }
</style>
</head>
<body>
<div class="grid-bg"></div>
<div class="orb"></div>
<header id="header">
  <div class="header-inner">
    <a href="/" class="logo"><img src="${LOGO}" alt="Manu.ia" style="height:30px;width:auto;"></a>
    <a href="/" class="nav-back">
      <svg class="icon-svg" style="width:16px;height:16px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Voltar ao site
    </a>
  </div>
</header>
<main class="wrap">
  <div class="blog-head">
    <span class="eyebrow"><span class="eyebrow-dot"></span>Blog</span>
    <h1>CRM com IA e <span class="gradient-text">vendas no WhatsApp</span></h1>
    <p>Conteudos praticos sobre atendimento automatizado, qualificacao de leads e como nao perder oportunidades comerciais.</p>
  </div>
  <div class="posts-grid">
${cards || '    <p class="empty">Nenhum artigo publicado ainda. Volte em breve.</p>'}
  </div>
</main>
<footer>
  <div class="footer-inner">
    <p class="footer-copy">&copy; ${new Date().getFullYear()} Manu.ia &middot; Produto desenvolvido pela Assessoria Atrio</p>
  </div>
</footer>
</body>
</html>`;
}

// ---------- Sitemap ----------
function renderSitemap(posts) {
  const home =
`  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${hojeISO()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/blog/</loc>
    <lastmod>${hojeISO()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  const artigos = posts.map((p) =>
`  <url>
    <loc>${SITE_URL}/blog/${p.slug}</loc>
    <lastmod>${p.data}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${home}
${artigos}
</urlset>
`;
}

// ---------- Principal ----------
async function main() {
  await mkdir(BLOG_DIR, { recursive: true });
  const posts = await lerPosts();
  const dataISO = hojeISO();

  const alvo = escolherKeyword(posts);

  // === ANTI-CANIBALIZACAO: se todas keywords foram usadas recentemente, PARA ===
  if (!alvo) {
    console.log(`[skip] Todas as ${KEYWORDS.length} keywords foram usadas nos ultimos ${MIN_DIAS_ENTRE_KEYWORD} dias.`);
    console.log('[skip] Adicione novas keywords a KEYWORDS[] ou reduza MIN_DIAS_ENTRE_KEYWORD.');
    process.exit(0);
  }

  let artigo, keywordUsada;
  if (ARTIGO_LOCAL) {
    console.log(`[seed] usando artigo local: ${ARTIGO_LOCAL}`);
    artigo = JSON.parse(await readFile(path.join(ROOT, ARTIGO_LOCAL), 'utf8'));
    keywordUsada = artigo.keywords?.[0] || alvo.kw;
  } else {
    console.log(`[keyword] alvo do dia: "${alvo.kw}"`);
    artigo = await gerarArtigoViaAPI(alvo, posts.slice(0, 6).map((p) => p.titulo));
    keywordUsada = alvo.kw;
  }

  const slug = slugify(artigo.titulo);

  // === BUG FIX: se o slug ja existe, PULA em vez de criar duplicata ===
  if (await existe(path.join(BLOG_DIR, `${slug}.html`))) {
    console.log(`[skip] slug "${slug}" ja existe no disco. Nao criando duplicata.`);
    console.log('[skip] Isso e proposital: evita canibalizacao SEO.');
    console.log('[skip] Rode o script novamente para gerar outro artigo com titulo diferente.');
    process.exit(0);
  }

  // Escolhe artigos relacionados dos posts existentes (internal linking)
  const relacionados = escolherRelacionados(posts, keywordUsada, slug, 3);
  if (relacionados.length) {
    console.log(`[internal] ${relacionados.length} artigos relacionados linkados: ${relacionados.map(r => r.slug).join(', ')}`);
  }

  await writeFile(path.join(BLOG_DIR, `${slug}.html`), renderArtigo(artigo, slug, dataISO, relacionados), 'utf8');
  console.log(`[ok] artigo criado: blog/${slug}.html`);

  posts.unshift({
    slug, titulo: artigo.titulo, descricao: artigo.descricao || '',
    data: dataISO, keyword: keywordUsada,
  });
  await writeFile(POSTS_JSON, JSON.stringify(posts, null, 2), 'utf8');
  await writeFile(path.join(BLOG_DIR, 'index.html'), renderIndice(posts), 'utf8');
  await writeFile(SITEMAP, renderSitemap(posts), 'utf8');
  console.log(`[ok] indice e sitemap atualizados. Total: ${posts.length}`);

  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitulo=${artigo.titulo}\n`, { flag: 'a' });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
