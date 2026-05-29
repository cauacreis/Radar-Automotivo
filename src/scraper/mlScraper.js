import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/index.js';
import { writeFileSync } from 'fs';

// Ativa o plugin Stealth — oculta sinais de automação do navegador
puppeteerExtra.use(StealthPlugin());

/**
 * Realiza scraping no Mercado Livre usando Puppeteer com modo stealth.
 * @param {string} [query] - Termo de busca. Usa o padrão da config se omitido.
 * @returns {Promise<Array<{titulo: string, preco: string, link: string}>>}
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

  const page = await browser.newPage();

  try {
    // Monta o slug de busca no formato do lista.mercadolivre.com.br
    const slug = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const searchUrl = `https://lista.mercadolivre.com.br/${slug}`;
    console.log(`📡 Acessando: ${searchUrl}\n`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout,
    });

    await new Promise(r => setTimeout(r, 3000));

    // DEBUG: screenshot e URL atual
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: false });
    writeFileSync('debug-page.html', await page.content(), 'utf-8');
    console.log(`📸 Screenshot salva | URL: ${page.url()}\n`);

    // Detecta container de resultados
    const containers = [
      'ol.ui-search-layout',
      '.ui-search-layout',
      '.ui-search-results',
    ];

    let containerSelector = null;
    for (const sel of containers) {
      if (await page.$(sel)) {
        containerSelector = sel;
        console.log(`✅ Container: "${sel}"\n`);
        break;
      }
    }

    if (!containerSelector) {
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300));
      console.error('❌ Container não encontrado. Conteúdo da página:\n', bodyText);
      throw new Error('Container de resultados não encontrado — verifique debug-screenshot.png');
    }

    // Extrai dados dos produtos
    const produtos = await page.evaluate((max, container) => {
      const itemSels = [
        `${container} li.ui-search-layout__item`,
        `${container} li`,
      ];

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

        const inteiro = item.querySelector('.andes-money-amount__fraction');
        const centavos = item.querySelector('.andes-money-amount__cents');
        const preco = inteiro
          ? `R$ ${inteiro.innerText}${centavos ? ',' + centavos.innerText : ''}`
          : 'Preço não disponível';

        const linkEl =
          item.querySelector('a.poly-component__title') ||
          item.querySelector('a[href*="MLB"]') ||
          item.querySelector('a');
        const link = linkEl?.href ?? 'N/A';

        if (titulo !== 'N/A') resultado.push({ titulo, preco, link });
      }

      return resultado;
    }, maxResults, containerSelector);

    if (produtos.length === 0) {
      throw new Error('0 produtos extraídos — verifique debug-screenshot.png');
    }

    console.log(`✅ ${produtos.length} produto(s) extraído(s) com sucesso!\n`);
    return produtos;

  } finally {
    await browser.close();
    console.log('🔒 Navegador fechado.\n');
  }
}
