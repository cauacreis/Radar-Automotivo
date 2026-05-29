import 'dotenv/config';

export const config = {
  // Groq AI
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Scraper
  scraper: {
    headless: 'new',
    timeout: 30000,
    searchQuery: 'Amortecedor dianteiro Hilux 2006',
    baseUrl: 'https://lista.mercadolivre.com.br',
    maxResults: 5,
  },
};
