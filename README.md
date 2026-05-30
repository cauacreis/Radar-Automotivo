# 📡 Radar Automotivo (Assistente Pessoal de Compras com IA)

O **Radar Automotivo** evoluiu de um simples web scraper estruturado de autopeças para um **assistente pessoal de compras interativo e em tempo real no Telegram**, baseado em **Inversão de Controle (IoC)** e **Filtro Semântico por LLM**. 

O sistema permite que o usuário envie qualquer termo de pesquisa (seja uma autopeça específica, um componente de hardware ou um eletrônico) diretamente por um chat privado no Telegram. O assistente inicia uma varredura paralela, extrai descrições brutas dos produtos no marketplace e usa Inteligência Artificial avançada para determinar de forma determinística e contextual se o produto anunciado corresponde exatamente à intenção de compra do usuário, enviando alertas em tempo real.

---

## 🏗️ Arquitetura e Tecnologias

O ecossistema é construído sob uma arquitetura modular orientada a eventos e orientada a dados em **Node.js (ES Modules)**, utilizando as seguintes tecnologias:

*   **Runtime & Módulos**: Node.js v18+ usando ECMAScript Modules (ESM) para legibilidade e modernidade.
*   **Interface e Inversão de Controle**: `node-telegram-bot-api` operando em modo **Long Polling** para escuta contínua de mensagens.
*   **Web Scraping & Evasão de Proteções**: `puppeteer` combinado com `puppeteer-extra` e `puppeteer-extra-plugin-stealth` para renderização da SPA do Mercado Livre sem detecção de automação (evasão de anti-bots, captchas e rate limits).
*   **Brain & Julgamento Semântico**: API do **Groq** usando o SDK oficial e o modelo `llama-3.1-8b-instant` para análise contextual com latência ultra-baixa.
*   **Configurações**: `dotenv` para gerenciamento de chaves privadas e tokens de ambiente seguro.

```
                  +----------------------------------+
                  |       Telegram Chat Privado      |
                  +-----------------+----------------+
                                    | (1) Envia termo de busca
                                    v
                  +-----------------+----------------+
                  |         index.js (Bot)           |
                  +-----------------+----------------+
                                    | (2) Inicializa busca
                                    v
                  +-----------------+----------------+
                  |         mlScraper.js             | <--- Puppeteer Stealth
                  +-----------------+----------------+
                                    | (3) Extrai anúncios + descrições
                                    v
                  +-----------------+----------------+
                  |       groqAnalyzer.js            | <--- Groq SDK (Llama 3.1)
                  +-----------------+----------------+
                                    | (4) Avalia compatibilidade (JSON)
                                    v
                  +-----------------+----------------+
                  |      telegramNotifier.js         |
                  +-----------------+----------------+
                                    | (5) Envia alertas formatados em MarkdownV2
                                    v
                  +-----------------+----------------+
                  |           Celular                |
                  +----------------------------------+
```

---

## 🧠 Inteligência Artificial como Filtro

A maioria dos scrapers tradicionais sofre com "falsos positivos" por depender apenas de filtros sintáticos de palavras-chave. No **Radar Automotivo**, o scraping é apenas a primeira etapa de aquisição dos dados textuais brutos. 

1.  **Ingestão de Dados Brutos**: O Puppeteer acessa individualmente a página de cada anúncio e extrai toda a descrição textual fornecida pelo vendedor.
2.  **Injeção Dinâmica de Contexto**: O termo de busca do usuário (ex: *"amortecedor traseiro hilux 2006"*) é injetado no prompt de sistema do Groq.
3.  **Avaliação Contextual**: A LLM avalia a descrição sob a ótica de um especialista de domínio (como um mecânico experiente da Toyota ou um técnico em hardware de PCs). Ela julga se a peça anunciada serve especificamente para o termo especificado, filtrando produtos incompatíveis que aparecem nos resultados de busca do marketplace devido a tags de spam ou compatibilidades genéricas viciadas (ex: *"serve de 2005 a 2015"* mas que exclui o ano 2006 por limitações técnicas).
4.  **Saída Determinística**: O Groq é configurado em modo `json_object`, garantindo que o modelo retorne uma estrutura estrita:
    ```json
    {
      "compativel": true,
      "motivo": "O anúncio confirma a aplicação para Hilux Pick-up Cabine Dupla 2006."
    }
    ```

---

## 🚀 Como Rodar Localmente

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/cauacreis/Radar-Automotivo.git
cd Radar-Automotivo
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com base no arquivo `.env.example`:
```ini
# Groq AI API Key (Obtenha em console.groq.com)
GROQ_API_KEY=gsk_sua_chave_groq_aqui

# Telegram Bot (Obtenha com o @BotFather no Telegram)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyZ

# Seu Chat ID privado (Obtenha enviando mensagem pro seu Bot e acessando api.telegram.org/bot<TOKEN>/getUpdates)
TELEGRAM_CHAT_ID=987654321
```

### 3. Executar o Assistente
Inicie o processo do bot:
```bash
npm start
```

O bot começará o monitoramento ativo. Vá para o chat do seu bot no Telegram e envie qualquer termo de pesquisa para iniciar as varreduras!
