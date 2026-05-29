import { mlScraper } from './scraper/mlScraper.js';

async function main() {
  console.log('='.repeat(60));
  console.log('       🚗  RADAR AUTOMOTIVO — Web Scraper v1.0');
  console.log('='.repeat(60));

  try {
    const produtos = await mlScraper();

    if (!produtos || produtos.length === 0) {
      console.warn('⚠️  Nenhum produto encontrado. Verifique os seletores.');
      return;
    }

    console.log('📊 Resultados extraídos:\n');
    console.table(produtos);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Scraping finalizado — ${produtos.length} produto(s) encontrado(s).`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro durante o scraping:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
