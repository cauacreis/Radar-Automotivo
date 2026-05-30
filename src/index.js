import TelegramBot from 'node-telegram-bot-api';
import { config } from './config/index.js';
import { scrapeMercadoLivre } from './scraper/mlScraper.js';
import { analyzeCompatibilidade } from './scraper/groqAnalyzer.js';
import { sendTelegramAlert } from './notifier/telegramNotifier.js';

// ─────────────────────────────────────────────────────────────
// Validações Iniciais de Variáveis de Ambiente
// ─────────────────────────────────────────────────────────────
if (!config.telegram.botToken || !config.telegram.chatId) {
  console.error('❌ TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados no .env. Configure para rodar o bot.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Inicialização do Bot
// ─────────────────────────────────────────────────────────────
const bot = new TelegramBot(config.telegram.botToken, { polling: true });

console.log('='.repeat(60));
console.log('  🤖 RADAR AUTOMOTIVO — Telegram Bot Interativo Ativo');
console.log(`  📡 Aguardando mensagens no Chat ID autorizado: ${config.telegram.chatId}`);
console.log('='.repeat(60) + '\n');

// ─────────────────────────────────────────────────────────────
// Listener de Mensagens
// ─────────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const termo = msg.text?.trim();

  // 1. Segurança: validação do Chat ID
  if (String(chatId) !== String(config.telegram.chatId)) {
    console.warn(`⚠️ Tentativa de acesso não autorizada. Remetente ID: ${chatId}`);
    try {
      await bot.sendMessage(chatId, '❌ Acesso não autorizado. Este bot é privado.');
    } catch (err) {
      console.error(`Erro ao responder invasor: ${err.message}`);
    }
    return;
  }

  // Ignora mensagens vazias ou que comecem com barra (comandos) se não for /start
  if (!termo) return;

  if (termo.startsWith('/')) {
    if (termo === '/start') {
      await bot.sendMessage(
        chatId,
        '🚗 *Bem-vindo ao Radar Automotivo\\!* 🚗\n\nEnvie o termo que deseja pesquisar no Mercado Livre e farei a verificação com IA em tempo real\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
    return;
  }

  // 2. Fluxo Principal da busca
  console.log(`\n💬 Mensagem recebida: "${termo}"`);
  
  try {
    // Resposta imediata conforme especificado
    await bot.sendMessage(chatId, `🔍 Iniciando varredura para: ${termo}`);

    // Executa scraping
    const produtos = await scrapeMercadoLivre(termo);

    if (!produtos || produtos.length === 0) {
      await bot.sendMessage(chatId, `⚠️ Nenhum produto encontrado no Mercado Livre para: "${termo}".`);
      return;
    }

    await bot.sendMessage(chatId, `🧠 Varrendo descrições com IA. Processando ${produtos.length} anúncios...`);

    let encontradosCount = 0;

    for (let i = 0; i < produtos.length; i++) {
      const produto = produtos[i];
      console.log(`🔬 [${i + 1}/${produtos.length}] Analisando com Groq: ${produto.titulo.slice(0, 50)}...`);

      const analise = await analyzeCompatibilidade(produto, termo);

      const icone = analise.compativel ? '✅' : '❌';
      console.log(`   ${icone} Compatível: ${analise.compativel} | ${analise.motivo}\n`);

      if (analise.compativel) {
        encontradosCount++;
        const resultado = { ...produto, ...analise };
        await sendTelegramAlert(bot, chatId, resultado);
      }
    }

    // Resumo final enviado ao usuário
    await bot.sendMessage(
      chatId,
      `🏁 *Varredura concluída\\!*\n🎯 Itens compatíveis encontrados: *${encontradosCount}* de *${produtos.length}* analisados\\.`,
      { parse_mode: 'MarkdownV2' }
    );

  } catch (err) {
    console.error(`❌ Erro no pipeline para o termo "${termo}":`, err);
    try {
      await bot.sendMessage(chatId, `❌ Erro na varredura para "${termo}":\n\`${err.message}\``);
    } catch (sendErr) {
      console.error('Erro ao enviar mensagem de erro:', sendErr.message);
    }
  }
});
