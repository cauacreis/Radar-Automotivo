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

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage   },
      ],
      response_format: { type: 'json_object' }, // força saída JSON
      temperature: 0.1,
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const resultado = JSON.parse(raw);

    // Garante que os campos existem com tipos corretos
    return {
      compativel: Boolean(resultado.compativel),
      motivo: String(resultado.motivo ?? 'Sem motivo retornado.'),
    };

  } catch (err) {
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
};
