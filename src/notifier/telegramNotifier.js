// ─────────────────────────────────────────────────────────────
// Auxiliares de Formatação e Escape
// ─────────────────────────────────────────────────────────────

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
 * @param {object} bot - Instância do node-telegram-bot-api
 * @param {string|number} chatId - ID do chat destino
 * @param {{ titulo: string, preco: string, motivo: string, link: string }} peca
 * @returns {Promise<void>}
 */
export async function sendTelegramAlert(bot, chatId, peca) {
  const text = buildMessage(peca);

  try {
    const message = await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false, // mostra preview do link no celular
    });

    console.log(`   📱 Alerta Telegram enviado! (message_id: ${message.message_id})`);

  } catch (err) {
    console.error(`   ⚠️  [Telegram] Falha no envio da mensagem: ${err.message}`);
  }
}
