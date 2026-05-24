#!/usr/bin/env node
/**
 * Automação de Blog SmartOps
 * Uso: node create-blog.cjs "Título do artigo"
 *
 * Requer: OPENAI_API_KEY no arquivo .env ou na variável de ambiente
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY || loadEnvKey();
const BLOG_DIR = path.join(__dirname, 'src', 'content', 'blog');

function loadEnvKey() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return '';
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^OPENAI_API_KEY\s*=\s*(.+)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: `Você é um redator especialista em SEO e conteúdo B2B para a SmartOps, empresa de tecnologia em Belo Horizonte (MG) que oferece: manutenção e formatação de computadores, upgrade para SSD, remoção de vírus, automação com IA, e consultoria Lean Six Sigma.

Escreva artigos de blog em português brasileiro com:
- Tom: direto, humano, sem academicismo, sem enrolação
- Tamanho: 900 a 1300 palavras
- Estrutura: título H1, seções H2/H3, exemplos práticos
- SEO: use a palavra-chave principal e variações naturalmente
- CTA final: mencione SmartOps, WhatsApp (31) 97203-9180 e smartops-ia.com.br
- Formato: Markdown puro, sem HTML
- NUNCA use termos como "mergulhar", "aprofundar", "vamos explorar juntos"
- Seja objetivo. Exemplos concretos valem mais que teoria.

Retorne APENAS o conteúdo markdown do artigo, começando direto do # Título.
Não inclua frontmatter, não inclua explicações fora do artigo.`
        },
        { role: 'user', content: prompt }
      ]
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.choices[0].message.content.trim());
        } catch (e) {
          reject(new Error('Resposta inválida da OpenAI: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateMeta(titulo, conteudo) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'Dado um título e conteúdo de artigo de blog, retorne APENAS um JSON com os campos: description (meta description SEO, máx 155 chars), excerpt (resumo curto para listagem, máx 120 chars), tags (array de 3 a 5 strings relevantes). Sem explicações, só o JSON.'
        },
        {
          role: 'user',
          content: `Título: ${titulo}\n\nConteúdo:\n${conteudo.slice(0, 1000)}`
        }
      ]
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const raw = json.choices[0].message.content.trim();
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          resolve(JSON.parse(cleaned));
        } catch (e) {
          resolve({ description: '', excerpt: '', tags: [] });
        }
      });
    });

    req.on('error', () => resolve({ description: '', excerpt: '', tags: [] }));
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const titulo = process.argv[2];

  if (!titulo) {
    console.error('\n❌ Uso: node create-blog.cjs "Título do artigo"\n');
    console.error('Exemplos:');
    console.error('  node create-blog.cjs "Remoção de vírus em BH"');
    console.error('  node create-blog.cjs "Chatbot para WhatsApp Business"');
    console.error('  node create-blog.cjs "Como saber se o HD está falhando"\n');
    process.exit(1);
  }

  if (!OPENAI_KEY) {
    console.error('\n❌ OPENAI_API_KEY não encontrada.');
    console.error('Adicione no arquivo .env:\n  OPENAI_API_KEY=sk-proj-...\n');
    process.exit(1);
  }

  const slug = toSlug(titulo);
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    console.error(`\n❌ Arquivo já existe: src/content/blog/${slug}.md`);
    console.error('Use um título diferente ou apague o arquivo existente.\n');
    process.exit(1);
  }

  console.log(`\n📝 Gerando artigo: "${titulo}"`);
  console.log('⏳ Aguarde...\n');

  const prompt = `Escreva um artigo completo de blog sobre: "${titulo}"

Público-alvo: pequenas e médias empresas ou consumidores finais em Belo Horizonte (MG) que estão procurando esse serviço.
Objetivo: aparecer no Google para buscas relacionadas ao tema e converter o leitor em contato via WhatsApp.`;

  let conteudo, meta;
  try {
    [conteudo, meta] = await Promise.all([
      callOpenAI(prompt),
      callOpenAI(prompt).then(c => generateMeta(titulo, c))
    ]);
    // Re-generate meta with the actual content
    meta = await generateMeta(titulo, conteudo);
  } catch (e) {
    console.error('❌ Erro ao chamar OpenAI:', e.message);
    process.exit(1);
  }

  const tagsYaml = (meta.tags || []).map(t => `  - ${t}`).join('\n');

  const frontmatter = `---
title: "${titulo}"
description: "${(meta.description || '').replace(/"/g, "'")}"
pubDate: "${today()}"
heroImage: "/blog-placeholder-1.jpg"
excerpt: "${(meta.excerpt || '').replace(/"/g, "'")}"
tags:
${tagsYaml}
---

`;

  fs.writeFileSync(filePath, frontmatter + conteudo, 'utf8');

  const words = conteudo.split(/\s+/).length;
  const tokens = Math.round((frontmatter + conteudo).length / 4);

  console.log(`✅ Artigo criado com sucesso!`);
  console.log(`📄 Arquivo: src/content/blog/${slug}.md`);
  console.log(`📊 ~${words} palavras | ~${tokens} tokens`);
  console.log(`\n🚀 Para publicar: faça o deploy normalmente (git push ou npm run build)\n`);
}

main();
