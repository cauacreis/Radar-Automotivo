import { mlScraper } from './scraper/mlScraper.js';
import { analisarPeca } from './scraper/groqAnalyzer.js';

async function main() {
  console.log('='.repeat(60));
  console.log('    🚗  RADAR AUTOMOTIVO — Scraper + IA  v2.0');
  console.log('='.repeat(60));

  // ── 1. Scraping: busca + extração profunda ─────────────────────────────
  const produtos = await mlScraper();

  if (!produtos?.length) {
    console.warn('⚠️  Nenhum produto encontrado. Encerrando.');
    return;
  }

  // ── 2. Análise semântica com Groq ──────────────────────────────────────
  console.log('🧠 Analisando compatibilidade com IA (Groq / llama-3.1-8b-instant)...\n');

  const resultados = [];

  for (let i = 0; i < produtos.length; i++) {
    const produto = produtos[i];
    console.log(`🔬 [${i + 1}/${produtos.length}] Analisando: ${produto.titulo.slice(0, 50)}...`);

    const analise = await analisarPeca(produto);

    const icone = analise.compativelHilux2006 ? '✅' : '❌';
    console.log(`   ${icone} Compatível: ${analise.compativelHilux2006} | ${analise.motivo}\n`);

    resultados.push({ ...produto, ...analise });
  }

  // ── 3. Exibe apenas as peças compatíveis ───────────────────────────────
  const compativeis = resultados.filter(r => r.compativelHilux2006);

  console.log('='.repeat(60));
  console.log(`\n📊 ${compativeis.length} peça(s) COMPATÍVEL(IS) com Hilux 2006:\n`);

  if (compativeis.length === 0) {
    console.warn('⚠️  Nenhuma peça compatível encontrada nos resultados.');
  } else {
    // Tabela formatada — colunas relevantes apenas
    console.table(
      compativeis.map((p, idx) => ({
        '#': idx + 1,
        'Título': p.titulo.slice(0, 45) + (p.titulo.length > 45 ? '…' : ''),
        'Preço': p.preco,
        'Motivo IA': p.motivo.slice(0, 60) + (p.motivo.length > 60 ? '…' : ''),
        'Link': p.link.split('/').slice(3, 5).join('/'), // versão curta do link
      }))
    );

    // Log dos links completos separado
    console.log('\n🔗 Links completos:\n');
    compativeis.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.titulo.slice(0, 45)}`);
      console.log(`      ${p.link}\n`);
    });
  }

  // Exibe também as rejeitadas para transparência
  const rejeitadas = resultados.filter(r => !r.compativelHilux2006);
  if (rejeitadas.length > 0) {
    console.log(`\n❌ ${rejeitadas.length} peça(s) rejeitada(s) pela IA:\n`);
    rejeitadas.forEach(p => {
      console.log(`  • ${p.titulo.slice(0, 50)}`);
      console.log(`    Motivo: ${p.motivo}\n`);
    });
  }

  console.log('='.repeat(60));
  console.log(`✅ Análise concluída — ${resultados.length} peças analisadas, ${compativeis.length} compatíveis.`);
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
