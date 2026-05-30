import Groq from 'groq-sdk';
import { config } from '../config/index.js';

// ─────────────────────────────────────────────
// Inicializa o cliente Groq com a chave do .env
// ─────────────────────────────────────────────
if (!config.groqApiKey) {
  throw new Error(
    '❌ GROQ_API_KEY não encontrada. Crie um arquivo .env com a chave. Veja .env.example.'
  );
}

const groq = new Groq({ apiKey: config.groqApiKey });

/**
 * Aguarda um tempo antes de continuar — usado no retry de rate limit.
 * @param {number} ms
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Analisa a compatibilidade de um produto com o termo de busca usando Groq (llama-3.1-8b-instant).
 * Retorna um objeto com `compativel` (boolean) e `motivo` (string).
 *
 * @param {{ titulo: string, descricaoCompleta: string }} produto
 * @param {string} termoBusca
 * @returns {Promise<{ compativel: boolean, motivo: string }>}
 */
export const analyzeCompatibilidade = async (produto, termoBusca) => {
  const systemPrompt = `Você é um especialista em tecnologia e mecânica. O usuário está buscando especificamente por: "${termoBusca}". Analise a descrição deste anúncio e determine se ele é EXATAMENTE o que o usuário quer. Responda em JSON com "compativel" (boolean) e "motivo" (string).`;

  const userMessage = `
Título do anúncio: ${produto.titulo}

Descrição:
${produto.descricaoCompleta ?? 'Sem descrição disponível.'}
`.trim();

  const MAX_TENTATIVAS = 4;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage   },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 256,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const resultado = JSON.parse(raw);

      return {
        compativel: Boolean(resultado.compativel),
        motivo: String(resultado.motivo ?? 'Sem motivo retornado.'),
      };

    } catch (err) {
      // Rate limit (429) — backoff exponencial antes de tentar de novo
      const is429 = err.message?.includes('429') || err.status === 429;
      if (is429 && tentativa < MAX_TENTATIVAS) {
        const espera = tentativa * 8000; // 8s, 16s, 24s
        console.warn(`   ⏳ Rate limit Groq. Tentativa ${tentativa}/${MAX_TENTATIVAS}. Aguardando ${espera / 1000}s...`);
        await sleep(espera);
        continue;
      }

      if (err instanceof SyntaxError) {
        console.error(`   ⚠️  Groq retornou JSON inválido: ${err.message}`);
      } else {
        console.error(`   ⚠️  Erro no Groq: ${err.message}`);
      }

      return {
        compativel: false,
        motivo: `Erro na análise: ${err.message.slice(0, 80)}`,
      };
    }
  }
};
