import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/index.js';

// Ativa o plugin Stealth — oculta sinais de automação do navegador
puppeteerExtra.use(StealthPlugin());

// ─────────────────────────────────────────────
// Seletores para descrição nas páginas de produto
// ─────────────────────────────────────────────
const DESCRICAO_SELETORES = [
  '.ui-pdp-description__content',
  'p.ui-pdp-description__content',
  '.item-description__text',
  '[class*="description__content"]',
  '[class*="pdp-description"]',
];

/**
 * Navega até a página de um produto e extrai a descrição completa.
 * Tem timeout próprio para não travar o fluxo em caso de página lenta.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} link
 * @param {string} titulo - Para logging
 * @returns {Promise<string>}
 */
async function extrairDescricao(page, link, titulo) {
  const PAGE_TIMEOUT = 20_000; // 20s por produto

  try {
    // Navega para a página do produto
    await page.goto(link, {
      waitUntil: 'load',
      timeout: PAGE_TIMEOUT,
    });

    // Aguarda página estabilizar
    await new Promise(r => setTimeout(r, 2500));

    // Tenta aguardar o seletor de descrição (sem lançar erro se não achar)
    await page.waitForSelector(DESCRICAO_SELETORES[0], {
      timeout: 6000,
    }).catch(() => null);

    // Tenta cada seletor até achar o texto
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
    // Timeout ou erro de navegação — não trava o fluxo
    if (err.message.includes('timeout') || err.name === 'TimeoutError') {
      console.log(`   ⏱️  Timeout ao carregar página do produto`);
      return 'Timeout ao carregar descrição.';
    }
    console.log(`   ❌ Erro: ${err.message.slice(0, 80)}`);
    return `Erro ao carregar: ${err.message.slice(0, 80)}`;
  }
}

/**
 * Scraper completo do Mercado Livre:
 * 1. Busca os N primeiros produtos na página de resultados
 * 2. Navega em cada link e extrai a descrição completa
 *
 * @param {string} [query] - Termo de busca. Usa o padrão da config se omitido.
 * @returns {Promise<Array<{titulo, preco, link, descricaoCompleta}>>}
 */
export async function mlScraper(query = config.scraper.searchQuery) {
  const { headless, timeout, maxResults } = config.scraper;

  console.log(`\n🔍 Iniciando busca: "${query}"`);
  console.log('🚀 Abrindo navegador (modo stealth)...\n');

  const browser = await puppeteerExtra.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  // Uma única aba reutilizada para todas as páginas
  const page = await browser.newPage();

  try {
    // ── Etapa 1: Página de busca ──────────────────────────────────────────
    const slug = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const searchUrl = `https://lista.mercadolivre.com.br/${slug}`;
    console.log(`📡 Página de busca: ${searchUrl}\n`);

    await page.goto(searchUrl, { waitUntil: 'load', timeout });

    // Aguarda página estabilizar completamente
    await new Promise(r => setTimeout(r, 4000));

    // Detecta container de resultados
    const containers = ['ol.ui-search-layout', '.ui-search-layout', '.ui-search-results'];
    let containerSelector = null;
    for (const sel of containers) {
      if (await page.$(sel)) { containerSelector = sel; break; }
    }

    // Garante que o container está estável antes de avaliar
    if (containerSelector) {
      await page.waitForSelector(containerSelector, { timeout: 10000 }).catch(() => null);
    }

    if (!containerSelector) {
      throw new Error('Container de resultados não encontrado na página de busca.');
    }

    // Extrai titulo, preco e link dos primeiros N produtos
    const produtos = await page.evaluate((max, container) => {
      const itemSels = [`${container} li.ui-search-layout__item`, `${container} li`];
      let itens = [];
      for (const sel of itemSels) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { itens = [...found]; break; }
      }

      const resultado = [];
      for (let i = 0; i < Math.min(itens.length, max); i++) {
        const item = itens[i];

        const tituloEl =
          item.querySelector('.poly-component__title') ||
          item.querySelector('.ui-search-item__title') ||
          item.querySelector('h2');
        const titulo = tituloEl?.innerText?.trim() ?? 'N/A';

        const inteiro  = item.querySelector('.andes-money-amount__fraction');
        const centavos = item.querySelector('.andes-money-amount__cents');
        const preco = inteiro
          ? `R$ ${inteiro.innerText}${centavos ? ',' + centavos.innerText : ''}`
          : 'Preço não disponível';

        // Pega a URL limpa sem parâmetros de tracking
        const linkEl =
          item.querySelector('a.poly-component__title') ||
          item.querySelector('a[href*="MLB"]') ||
          item.querySelector('a');
        const linkRaw = linkEl?.href ?? 'N/A';
        const link = linkRaw !== 'N/A' ? linkRaw.split('#')[0] : 'N/A';

        if (titulo !== 'N/A') resultado.push({ titulo, preco, link });
      }
      return resultado;
    }, maxResults, containerSelector);

    if (produtos.length === 0) throw new Error('Nenhum produto encontrado na busca.');

    console.log(`✅ ${produtos.length} produto(s) encontrado(s). Iniciando extração profunda...\n`);

    // ── Etapa 2: Extração profunda — navega em cada produto ───────────────
    for (let i = 0; i < produtos.length; i++) {
      const produto = produtos[i];
      console.log(`📄 [${i + 1}/${produtos.length}] ${produto.titulo.slice(0, 55)}...`);

      if (produto.link === 'N/A') {
        produto.descricaoCompleta = 'Link inválido — não foi possível extrair descrição.';
        continue;
      }

      produto.descricaoCompleta = await extrairDescricao(page, produto.link, produto.titulo);

      // Pausa entre requisições para evitar rate-limiting
      if (i < produtos.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    console.log('\n✅ Extração profunda concluída!\n');
    return produtos;

  } finally {
    await browser.close();
    console.log('🔒 Navegador fechado.\n');
  }
}
