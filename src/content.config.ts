import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    author: z.string().default('Breno Luiz'),
    tags: z.array(z.string()).default([]),
    canonical: z.string().optional(),
    excerpt: z.string().optional(),
    category: z.enum(['lean-six-sigma', 'automacao', 'melhoria-continua', 'manutencao', 'geral']).default('geral'),
  }),
});

export const collections = { blog };
