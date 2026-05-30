import { config } from '../config/index.js';

// ─────────────────────────────────────────────────────────────
// Valida as credenciais do Telegram na inicialização do módulo
// ─────────────────────────────────────────────────────────────
const { botToken, chatId } = config.telegram;

if (!botToken || !chatId) {
  console.warn(
    '⚠️  [Telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados. ' +
    'Notificações desativadas. Adicione as variáveis no .env.'
  );
}

const TELEGRAM_API = `https://api.telegram.org/bot${botToken}/sendMessage`;

/**
 * Escapa caracteres especiais para o modo MarkdownV2 do Telegram.
 * Caracteres que precisam de escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
 *
 * @param {string} text
 * @returns {string}
 */
function escapeMd(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Monta a mensagem formatada em MarkdownV2 para o Telegram.
 *
 * @param {{ titulo, preco, motivo, link }} peca
 * @returns {string}
 */
function buildMessage(peca) {
  // Linhas fixas com emojis não precisam de escape
  // Conteúdo dinâmico (titulo, preco, motivo) precisam
  return [
    '🚨 *PEÇA COMPATÍVEL ENCONTRADA\\!* 🚨',
    '',
    `📦 *Produto:* ${escapeMd(peca.titulo)}`,
    `💵 *Preço:* ${escapeMd(peca.preco)}`,
    `🔧 *Motivo da IA:* ${escapeMd(peca.motivo)}`,
    '',
    `🔗 [Link do Anúncio](${peca.link})`,
  ].join('\n');
}

/**
 * Envia um alerta para o Telegram quando uma peça compatível é encontrada.
 *
 * @param {{ titulo: string, preco: string, motivo: string, link: string }} peca
 * @returns {Promise<void>}
 */
export async function sendTelegramAlert(peca) {
  // Se as credenciais não estiverem configuradas, loga e sai silenciosamente
  if (!botToken || !chatId) {
    console.log('   📵 Telegram não configurado — notificação ignorada.');
    return;
  }

  const text = buildMessage(peca);

  try {
    const response = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false, // mostra preview do link no celular
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      // Loga o erro da API do Telegram sem travar o fluxo
      console.error(`   ⚠️  [Telegram] Erro na API: ${data.description}`);
      return;
    }

    console.log(`   📱 Alerta Telegram enviado! (message_id: ${data.result.message_id})`);

  } catch (err) {
    // Erros de rede não travam o pipeline principal
    console.error(`   ⚠️  [Telegram] Falha na requisição: ${err.message}`);
  }
}
