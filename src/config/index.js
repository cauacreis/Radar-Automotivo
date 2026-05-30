import 'dotenv/config';

export const config = {
  // Groq AI
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId:   process.env.TELEGRAM_CHAT_ID   || '',
  },

  // Scraper
  scraper: {
    headless: 'new',
    timeout: 30000,
    searchQuery: 'Amortecedor dianteiro Hilux 2006',
    baseUrl: 'https://lista.mercadolivre.com.br',
    maxResults: 5,
  },
};
