#!/usr/bin/env node
/**
 * gerar-artigo.mjs
 * Gera 1 artigo por dia para o blog da Manu.ia usando a API da Anthropic.
 * Uso em CI:  node scripts/gerar-artigo.mjs   (precisa de ANTHROPIC_API_KEY)
 * Teste local: ARTIGO_LOCAL=scripts/exemplo-artigo.json node scripts/gerar-artigo.mjs
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const SITE_URL = (process.env.SITE_URL || 'https://www.manuai.com.br').replace(/\/+$/, '');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ARTIGO_LOCAL = process.env.ARTIGO_LOCAL;

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'blog');
const POSTS_JSON = path.join(BLOG_DIR, 'posts.json');
const SITEMAP = path.join(ROOT, 'sitemap.xml');

const LOGO = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/logo_principal_dark-removebg.png';
const OG_IMAGE = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/icon_principal.png';
const FAVICON = 'https://raw.githubusercontent.com/thaylonv777/Manu__Ia_/main/icon_navegador.png';
const WHATSAPP = 'https://wa.me/5551993933653?text=Ol%C3%A1!%20Tenho%20interesse%20na%20Manu.ia.';

const KEYWORDS = [
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
];

function slugify(txt) {
  return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);
}
function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hojeISO() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
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

function escolherKeyword(posts) {
  const usadasRecentes = posts.slice(0, KEYWORDS.length - 1).map((p) => p.keyword);
  const disponiveis = KEYWORDS.filter((k) => !usadasRecentes.includes(k.kw));
  const pool = disponiveis.length ? disponiveis : KEYWORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function gerarArtigoViaAPI(alvo, titulosRecentes) {
  const systemPrompt =
`Voce e redator(a) de conteudo SEO da Manu.ia, escrevendo no padrao de uma boa
agencia: artigos assertivos, uteis e que geram valor real para o leitor.

== SOBRE A MANU.IA (base: site e Instagram da marca) ==
A Manu.ia e uma assistente de atendimento com inteligencia artificial que atua
no WhatsApp. Posicionamento da marca: "inteligencia no atendimento que converte,
para quem quer vender de verdade".
O que ela faz, de verdade:
- Atende leads no WhatsApp 24 horas por dia, respondendo na hora.
- Qualifica o lead: entende o que a pessoa procura antes do vendedor entrar.
- Faz follow-up automatico, sem depender de alguem lembrar.
- Entrega o lead aquecido para o time humano assumir no momento certo.
- Da visibilidade e gestao dos atendimentos para quem lidera o comercial.
Posicionamento honesto da marca (use como verdade central):
- A Manu NAO substitui o time de vendas. Ela libera o time do trabalho repetitivo
  e garante que nenhum lead fique sem resposta.
- O inimigo que a marca combate e o SILENCIO e a DEMORA para responder, que fazem
  o lead esfriar e fechar com o concorrente.

== REGRAS INEGOCIAVEIS (honestidade) ==
- NUNCA prometa resultado numerico ("aumente 300% das vendas", "dobre o
  faturamento"). Fale de mecanismo e beneficio, nao de milagre.
- NUNCA invente estatistica, estudo, percentual ou "pesquisa diz que".
- NUNCA invente funcionalidade que nao esta descrita acima.
- NUNCA cite preco, plano ou valores.
- NUNCA invente telefone, link ou outro canal. O unico CTA e o WhatsApp oficial,
  que ja e inserido pelo site (nao escreva numero de telefone no texto).
- Tom: claro, direto, profissional, sem jargao vazio e sem "no mundo de hoje".
- Use acentuacao correta do portugues do Brasil.

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
===CORPO===
(corpo do artigo em HTML semantico)

== REGRAS DO corpoHtml ==
- Use apenas: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>.
- NAO use <a>, estilos inline, classes, <h1>, <html>, <head> ou <body>.
- Entre 750 e 1000 palavras.
- NAO escreva uma chamada final do tipo "fale conosco" nem CTA no texto: o site
  ja insere um bloco de CTA com o WhatsApp depois do corpo.
- NAO inclua secao de "Fontes e referencias". Encerre com um paragrafo de
  conclusao objetivo.`;

  const userPrompt =
`PALAVRA-CHAVE ALVO: "${alvo.kw}"
ANGULO SUGERIDO: ${alvo.angulo}

Escreva o artigo otimizado para essa palavra-chave, seguindo todas as regras.
Evite repetir estes titulos ja publicados: ${titulosRecentes.join(' | ') || 'nenhum'}.
Responda apenas no formato com os marcadores.`;

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
    leitura: corte(raw, '===LEITURA===', '===CORPO==='),
    corpoHtml: corte(raw, '===CORPO===', null),
  };

  if (!artigo.titulo || !artigo.corpoHtml) {
    throw new Error('Resposta da IA veio sem titulo ou corpo. Resposta bruta:\n' + raw);
  }
  return artigo;
}

function renderArtigo(artigo, slug, dataISO) {
  const url = `${SITE_URL}/blog/${slug}`;
  const titulo = escapeHtml(artigo.titulo);
  const descricao = escapeHtml(artigo.descricao || '');
  const keywords = escapeHtml((artigo.keywords || []).join(', '));
  const leitura = escapeHtml(artigo.leitura || '');

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: artigo.titulo, description: artigo.descricao || '', image: OG_IMAGE,
    datePublished: dataISO, dateModified: dataISO,
    author: { '@type': 'Organization', name: 'Manu.ia' },
    publisher: { '@type': 'Organization', name: 'Manu.ia', logo: { '@type': 'ImageObject', url: LOGO } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="${FAVICON}">
<title>${titulo} | Blog Manu.ia</title>
<meta name="description" content="${descricao}">
<meta name="keywords" content="${keywords}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${descricao}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" href="${FAVICON}">
<title>Blog | Manu.ia</title>
<meta name="description" content="Conteudos sobre CRM com IA, atendimento automatizado e qualificacao de leads no WhatsApp.">
<link rel="canonical" href="${SITE_URL}/blog/">
<meta property="og:title" content="Blog | Manu.ia">
<meta property="og:description" content="Conteudos sobre CRM com IA, atendimento automatizado e qualificacao de leads no WhatsApp.">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:url" content="${SITE_URL}/blog/">
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
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  const artigos = posts.map((p) =>
`  <url>
    <loc>${SITE_URL}/blog/${p.slug}</loc>
    <lastmod>${p.data}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${home}
${artigos}
</urlset>
`;
}

async function main() {
  await mkdir(BLOG_DIR, { recursive: true });
  const posts = await lerPosts();
  const dataISO = hojeISO();

  const alvo = escolherKeyword(posts);
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

  let slug = slugify(artigo.titulo);
  if (await existe(path.join(BLOG_DIR, `${slug}.html`))) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  await writeFile(path.join(BLOG_DIR, `${slug}.html`), renderArtigo(artigo, slug, dataISO), 'utf8');
  console.log(`[ok] artigo criado: blog/${slug}.html`);

  posts.unshift({
    slug, titulo: artigo.titulo, descricao: artigo.descricao || '',
    data: dataISO, keyword: keywordUsada,
  });
  await writeFile(POSTS_JSON, JSON.stringify(posts, null, 2), 'utf8');
  await writeFile(path.join(BLOG_DIR, 'index.html'), renderIndice(posts), 'utf8');
  await writeFile(SITEMAP, renderSitemap(posts), 'utf8');
  console.log(`[ok] indice e sitemap atualizados. Total: ${posts.length}`);

  // Exporta o slug e o titulo para o workflow montar o link de preview
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitulo=${artigo.titulo}\n`, { flag: 'a' });
  }
}

main().catch((err) => { console.error('[falha]', err.message); process.exit(1); });
