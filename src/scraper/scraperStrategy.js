import { scrapeMercadoLivre } from './mlScraper.js';
import { scrapeAmazon } from './amazonScraper.js';

/**
 * Design Pattern: Strategy
 *
 * Analisa o texto da mensagem do Telegram e decide qual scraper
 * executar com base no prefixo informado pelo usuário:
 *
 *   "AMAZON: rtx 3060"      → scrapeAmazon("rtx 3060")
 *   "ML: amortecedor hilux" → scrapeMercadoLivre("amortecedor hilux")
 *   "amortecedor hilux"     → scrapeMercadoLivre("amortecedor hilux") [default]
 *
 * @param {string} mensagem - Texto bruto recebido pelo bot do Telegram
 * @returns {Promise<{ produtos: Array, plataforma: string, termo: string }>}
 */
export const executeScraping = async (mensagem) => {
  const texto = mensagem.trim();

  // ── Prefixo AMAZON: ────────────────────────────────────────────────────
  if (/^amazon:/i.test(texto)) {
    const termo = texto.replace(/^amazon:\s*/i, '').trim();
    if (!termo) throw new Error('Informe um termo de busca após "AMAZON:".');

    const produtos = await scrapeAmazon(termo);
    return { produtos, plataforma: 'Amazon', termo };
  }

  // ── Prefixo ML: ────────────────────────────────────────────────────────
  if (/^ml:/i.test(texto)) {
    const termo = texto.replace(/^ml:\s*/i, '').trim();
    if (!termo) throw new Error('Informe um termo de busca após "ML:".');

    const produtos = await scrapeMercadoLivre(termo);
    return { produtos, plataforma: 'Mercado Livre', termo };
  }

  // ── Sem prefixo → padrão Mercado Livre ────────────────────────────────
  const produtos = await scrapeMercadoLivre(texto);
  return { produtos, plataforma: 'Mercado Livre', termo: texto };
};
