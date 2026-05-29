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

const SYSTEM_PROMPT = `Você é um mecânico sênior da Toyota. Analise a descrição deste anúncio. Responda em formato JSON com dois campos: "compativelHilux2006" (boolean) e "motivo" (string curta explicando por que serve ou por que é falsa/spam).`;

/**
 * Analisa uma peça automotiva com o modelo llama-3.1-8b-instant via Groq.
 * Retorna um objeto com `compativelHilux2006` (boolean) e `motivo` (string).
 *
 * @param {{ titulo: string, descricaoCompleta: string }} produto
 * @returns {Promise<{ compativelHilux2006: boolean, motivo: string }>}
 */
export async function analisarPeca(produto) {
  const userMessage = `
Título do anúncio: ${produto.titulo}

Descrição:
${produto.descricaoCompleta ?? 'Sem descrição disponível.'}
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage   },
      ],
      response_format: { type: 'json_object' }, // força saída JSON
      temperature: 0.1, // baixa temperatura = respostas mais precisas e consistentes
      max_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const resultado = JSON.parse(raw);

    // Garante que os campos existem com tipos corretos
    return {
      compativelHilux2006: Boolean(resultado.compativelHilux2006),
      motivo: String(resultado.motivo ?? 'Sem motivo retornado.'),
    };

  } catch (err) {
    // Erros de rede, parsing ou API — não travam o fluxo
    if (err instanceof SyntaxError) {
      console.error(`   ⚠️  Groq retornou JSON inválido: ${err.message}`);
    } else {
      console.error(`   ⚠️  Erro no Groq: ${err.message}`);
    }

    return {
      compativelHilux2006: false,
      motivo: `Erro na análise: ${err.message.slice(0, 80)}`,
    };
  }
}
