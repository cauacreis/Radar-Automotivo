import TelegramBot from 'node-telegram-bot-api';
import { config } from './config/index.js';
import { executeScraping } from './scraper/scraperStrategy.js';
import { analyzeCompatibilidade } from './scraper/groqAnalyzer.js';
import { sendTelegramAlert } from './notifier/telegramNotifier.js';

// ─────────────────────────────────────────────────────────────
// Validações Iniciais de Variáveis de Ambiente
// ─────────────────────────────────────────────────────────────
if (!config.telegram.botToken || !config.telegram.chatId) {
  console.error('❌ TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados no .env.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Inicialização do Bot
// ─────────────────────────────────────────────────────────────
const bot = new TelegramBot(config.telegram.botToken, { polling: true });

console.log('='.repeat(60));
console.log('  🤖 RADAR AUTOMOTIVO — Telegram Bot Interativo Ativo');
console.log(`  📡 Chat ID autorizado: ${config.telegram.chatId}`);
console.log('  💡 Dica: Use "AMAZON: <termo>" ou "ML: <termo>"');
console.log('='.repeat(60) + '\n');

// ─────────────────────────────────────────────────────────────
// Fila simples para serializar buscas (evita concorrência e
// estouro do rate limit do Groq quando mensagens chegam rápidas)
// ─────────────────────────────────────────────────────────────
let filaDeBusca = Promise.resolve();

const enqueue = (fn) => {
  filaDeBusca = filaDeBusca.then(fn).catch(() => {});
};

// ─────────────────────────────────────────────────────────────
// Listener de Mensagens
// ─────────────────────────────────────────────────────────────
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text?.trim();

  // 1. Segurança: validação do Chat ID — fora da fila para resposta imediata
  if (String(chatId) !== String(config.telegram.chatId)) {
    console.warn(`⚠️ Tentativa de acesso não autorizada. ID: ${chatId}`);
    bot.sendMessage(chatId, '❌ Acesso não autorizado. Este bot é privado.').catch(() => {});
    return;
  }

  // Ignora mensagens vazias
  if (!texto) return;

  // Comando /start — também fora da fila (resposta rápida)
  if (texto.startsWith('/')) {
    if (texto === '/start') {
      bot.sendMessage(
        chatId,
        '🚗 *Bem\\-vindo ao Radar Automotivo\\!* 🚗\n\n' +
        'Envie qualquer termo de busca e farei a verificação com IA\\.\n\n' +
        '*Como usar:*\n' +
        '• `ML: amortecedor hilux 2006` — busca no Mercado Livre\n' +
        '• `AMAZON: rtx 3060 12gb` — busca na Amazon\n' +
        '• Sem prefixo → padrão Mercado Livre',
        { parse_mode: 'MarkdownV2' }
      ).catch(() => {});
    }
    return;
  }

  // 2. Identifica plataforma antecipadamente para feedback imediato
  let plataformaPrevia = 'Mercado Livre';
  let termoPreview = texto;
  if (/^amazon:/i.test(texto)) {
    plataformaPrevia = 'Amazon';
    termoPreview = texto.replace(/^amazon:\s*/i, '').trim();
  } else if (/^ml:/i.test(texto)) {
    plataformaPrevia = 'Mercado Livre';
    termoPreview = texto.replace(/^ml:\s*/i, '').trim();
  }

  console.log(`\n💬 Mensagem recebida: "${texto}"`);

  // Feedback imediato antes de entrar na fila
  bot.sendMessage(
    chatId,
    `🔍 Iniciando varredura na *${plataformaPrevia}* para: ${termoPreview}`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // Enfileira a busca para evitar concorrência e rate limit do Groq
  enqueue(async () => {
    try {
      // Executa o Strategy — decide o scraper correto
      const { produtos, plataforma, termo } = await executeScraping(texto);

      if (!produtos || produtos.length === 0) {
        await bot.sendMessage(
          chatId,
          `⚠️ Nenhum produto encontrado na ${plataforma} para: "${termo}".`
        );
        return;
      }

      await bot.sendMessage(
        chatId,
        `🧠 Varrendo descrições com IA\\. Analisando *${produtos.length}* anúncios\\.`,
        { parse_mode: 'MarkdownV2' }
      );

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

      // Resumo final
      await bot.sendMessage(
        chatId,
        `🏁 *Varredura concluída\\!*\n` +
        `📦 Plataforma: *${plataforma}*\n` +
        `🎯 Compatíveis: *${encontradosCount}* de *${produtos.length}* analisados\\.`,
        { parse_mode: 'MarkdownV2' }
      );

    } catch (err) {
      console.error(`❌ Erro no pipeline para "${texto}":`, err.message);
      try {
        await bot.sendMessage(
          chatId,
          `❌ Erro na varredura para "${termoPreview}":\n\`${err.message}\``
        );
      } catch (sendErr) {
        console.error('Erro ao enviar mensagem de erro:', sendErr.message);
      }
    }
  });
});
