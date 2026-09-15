// Versão completa do llms.txt (ver public/llms.txt pro índice resumido) —
// todo o conteúdo do site em Markdown puro, sem HTML/header/footer/script,
// pra crawlers de IA (GPTBot, ClaudeBot, PerplexityBot etc.) lerem sem
// precisar processar a página renderizada. Gerado em build-time.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const sorted = [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const intro = `# SmartOps IA — Conteúdo completo

Consultoria de Lean Six Sigma e automação com Inteligência Artificial para pequenas e médias empresas em Belo Horizonte, Nova Pampulha e Morro Alto (MG). Fundada por Breno Luiz, Black Belt em Lean Six Sigma.

Ver também: https://smartops-ia.com.br/llms.txt (índice resumido de páginas)

---
`;

  const body = sorted
    .map((post) => {
      const { title, description, pubDate, category, tags } = post.data;
      const url = `https://smartops-ia.com.br/blog/${post.id.replace(/\.mdx?$/, '')}/`;
      return `# ${title}

URL: ${url}
Data: ${pubDate.toISOString().slice(0, 10)}
Categoria: ${category}
Tags: ${tags.join(', ')}

${description}

${post.body ?? ''}
`;
    })
    .join('\n---\n\n');

  return new Response(intro + '\n' + body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
