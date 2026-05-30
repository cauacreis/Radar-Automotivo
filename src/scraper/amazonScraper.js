import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/index.js';

// Ativa o plugin Stealth — oculta sinais de automação do navegador
puppeteerExtra.use(StealthPlugin());

// ─────────────────────────────────────────────
// Seletores para descrição nas páginas de produto
// ─────────────────────────────────────────────
const DESCRICAO_SELETORES = [
  '#feature-bullets ul',
  '#feature-bullets',
  '#productDescription p',
  '#productDescription',
  '#aplus-feature-div',
  '[data-feature-name="featurebullets"]',
];

// Seletores de título na página de resultados
const TITULO_SELETORES = [
  'h2 a span',
  'h2 span.a-text-normal',
  'h2 span',
];

// Seletores de preço na página de resultados
const PRECO_SELETORES = [
  '.a-price .a-offscreen',
  '.a-price-whole',
  '.a-price span:first-child',
];

/**
 * Delay aleatório entre min e max ms — evita padrão de timing detectável.
 */
const delay = (min, max) =>
  new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));

/**
 * Navega até a página de um produto da Amazon e extrai a descrição completa.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} link
 * @param {string} titulo - Para logging
 * @returns {Promise<string>}
 */
async function extrairDescricaoAmazon(page, link, titulo) {
  const PAGE_TIMEOUT = 30_000; // 30s — Amazon pode ser lenta

  try {
    await page.goto(link, {
      waitUntil: 'load',
      timeout: PAGE_TIMEOUT,
    });

    // Delay maior para deixar scripts da Amazon renderizarem
    await delay(3000, 5000);

    // Tenta aguardar o seletor principal sem travar se não aparecer
    await page.waitForSelector(DESCRICAO_SELETORES[0], { timeout: 8000 }).catch(() => null);

    const descricao = await page.evaluate((seletores) => {
      for (const sel of seletores) {
        const el = document.querySelector(sel);
        const texto = el?.innerText?.trim();
        if (texto && texto.length > 10) return texto;
      }
      return null;
    }, DESCRICAO_SELETORES);

    if (descricao) {
      console.log(`   ✅ Descrição extraída (${descricao.length} chars)`);
      return descricao;
    }

    console.log(`   ⚠️  Descrição não encontrada na página`);
    return 'Descrição não disponível neste anúncio.';

  } catch (err) {
    if (err.message.includes('timeout') || err.name === 'TimeoutError') {
      console.log(`   ⏱️  Timeout ao carregar página do produto`);
      return 'Timeout ao carregar descrição.';
    }
    console.log(`   ❌ Erro: ${err.message.slice(0, 80)}`);
    return `Erro ao carregar: ${err.message.slice(0, 80)}`;
  }
}

/**
 * Scraper da Amazon Brasil:
 * 1. Busca os N primeiros produtos na página de resultados
 * 2. Navega em cada link e extrai a descrição completa
 *
 * @param {string} termoBusca - Termo de busca dinâmico
 * @returns {Promise<Array<{titulo, preco, link, descricaoCompleta}>>}
 */
export const scrapeAmazon = async (termoBusca) => {
  const { headless, maxResults } = config.scraper;
  const timeout = 30_000;

  console.log(`\n🔍 [Amazon] Iniciando busca: "${termoBusca}"`);
  console.log('🚀 Abrindo navegador (modo stealth)...\n');

  const browser = await puppeteerExtra.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();

  // Headers realistas de navegador humano
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });

  try {
    // ── Etapa 1: Página de busca ──────────────────────────────────────────
    const slug = encodeURIComponent(termoBusca);
    const searchUrl = `https://www.amazon.com.br/s?k=${slug}&language=pt_BR`;
    console.log(`📡 Página de busca: ${searchUrl}\n`);

    await page.goto(searchUrl, { waitUntil: 'load', timeout });

    // Delay maior para a Amazon renderizar produtos
    await delay(4000, 6000);

    // Espera container de resultados
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 }).catch(() => null);

    // Extrai titulo, preco e link dos primeiros N produtos
    const produtos = await page.evaluate((max, tituloSels, precoSels) => {
      const items = [...document.querySelectorAll('[data-component-type="s-search-result"]')];

      const resultado = [];
      for (let i = 0; i < Math.min(items.length, max); i++) {
        const item = items[i];

        // Título
        let titulo = 'N/A';
        for (const sel of tituloSels) {
          const el = item.querySelector(sel);
          const texto = el?.innerText?.trim();
          if (texto && texto.length > 3) { titulo = texto; break; }
        }

        // Preço — .a-offscreen guarda o preço formatado (ex: "R$ 2.399,00")
        let preco = 'Preço não disponível';
        for (const sel of precoSels) {
          const el = item.querySelector(sel);
          const texto = el?.textContent?.trim() || el?.innerText?.trim();
          if (texto && texto.length > 1) { preco = texto; break; }
        }

        // Link — pega da tag <a> dentro do h2
        const linkEl = item.querySelector('h2 a') || item.querySelector('a[href*="/dp/"]');
        const linkRaw = linkEl?.href ?? 'N/A';
        // Remove parâmetros de tracking
        const link = linkRaw !== 'N/A'
          ? 'https://www.amazon.com.br' + (new URL(linkRaw).pathname)
          : 'N/A';

        if (titulo !== 'N/A') resultado.push({ titulo, preco, link });
      }
      return resultado;
    }, maxResults, TITULO_SELETORES, PRECO_SELETORES);

    if (produtos.length === 0) throw new Error('Nenhum produto encontrado na busca da Amazon.');

    console.log(`✅ ${produtos.length} produto(s) encontrado(s). Iniciando extração profunda...\n`);

    // ── Etapa 2: Extração profunda ───────────────────────────────────────
    for (let i = 0; i < produtos.length; i++) {
      const produto = produtos[i];
      console.log(`📄 [${i + 1}/${produtos.length}] ${produto.titulo.slice(0, 55)}...`);

      if (produto.link === 'N/A') {
        produto.descricaoCompleta = 'Link inválido — não foi possível extrair descrição.';
        continue;
      }

      produto.descricaoCompleta = await extrairDescricaoAmazon(page, produto.link, produto.titulo);

      // Pausa longa entre requisições (Amazon é mais sensível a rate-limiting)
      if (i < produtos.length - 1) {
        const pausaMs = Math.floor(Math.random() * 2000) + 3000; // 3 a 5s
        console.log(`   ⏸️  Aguardando ${(pausaMs / 1000).toFixed(1)}s antes do próximo...`);
        await delay(3000, 5000);
      }
    }

    console.log('\n✅ Extração profunda concluída!\n');
    return produtos;

  } finally {
    await browser.close();
    console.log('🔒 Navegador fechado.\n');
  }
};
