import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');

  const sorted = posts
    .filter(p => p.data.pubDate)
    .sort((a, b) => new Date(b.data.pubDate) - new Date(a.data.pubDate));

  return rss({
    title: 'SmartOps IA — Blog',
    description: 'Lean Six Sigma, automação com IA e melhoria de processos para pequenas empresas.',
    site: context.site,
    items: sorted.map(post => ({
      title:       post.data.title,
      pubDate:     new Date(post.data.pubDate),
      description: post.data.description || post.data.excerpt || '',
      link:        `/blog/${post.slug}/`,
      categories:  post.data.tags || [],
      customData:  `<category>${post.data.category || ''}</category><excerpt><![CDATA[${post.data.excerpt || ''}]]></excerpt>`,
    })),
    customData: `<language>pt-BR</language>`,
  });
}
