const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, 'src', 'content', 'blog');

const RULES = [
  {
    category: 'lean-six-sigma',
    keywords: ['lean', 'six-sigma', 'six sigma', 'dmaic', 'pdca', 'kaizen', 'desperdicio', 'desperdicios',
      '7-desperdicios', 'gargalo', 'retrabalho', 'mapeamento-de-fluxo', 'value-stream', 'melhoria-continua',
      'melhoria continua', 'indicador', 'reuniao-de-melhoria', 'checklist-de-processo', 'padrao-de-atendimento',
      'rotina-de-melhoria', 'ciclo-pdca', 'fluxo-de-valor', 'processo-padronizado', 'processo-manual',
      'consultoria-lean', 'consultoria lean', 'certificacao-lean', 'lean-vs', 'six-sigma-vale',
      'melhoria-continua-vs', 'projeto-pontual', 'fazer-internamente', 'terceirizar-a-melhoria',
      'treinamento-de-equipe', 'consultoria-presencial', 'consultoria-online', 'vale-a-pena-contratar-consultoria',
      'indicadores-financeiros', 'indicadores-simples', 'contratar-gerente', 'priorizar-qual-processo',
    ],
  },
  {
    category: 'automacao',
    keywords: ['automacao', 'automação', 'ia-para', 'inteligencia-artificial', 'chatbot', 'whatsapp',
      'n8n', 'automatizar', 'processo-padronizado-mais-automacao', 'ia-nao-resolve',
      'lean-six-sigma-e-automacao', 'lean-six-sigma-para-quem-quer-automatizar',
      'mapear-um-processo-antes-de-automatizar', 'automacao-que-falhou', 'automacao-vs',
      'atendimento-automatico', 'o-que-automatizar', 'quanto-tempo-sua-equipe-perde',
      'como-usar-ia', 'como-pequenas-empresas-estao-usando-ia', 'como-automatizar',
    ],
  },
  {
    category: 'manutencao',
    keywords: ['manutencao', 'formatacao', 'ssd', 'virus', 'computador', 'notebook', 'hd',
      'windows', 'hardware', 'tela-azul', 'lentidao', 'manutenção'],
  },
];

function getCategory(filename) {
  const slug = filename.toLowerCase().replace('.md', '');
  for (const rule of RULES) {
    if (rule.keywords.some(kw => slug.includes(kw))) {
      return rule.category;
    }
  }
  return 'melhoria-continua';
}

const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('\ncategory:')) {
    skipped++;
    continue;
  }

  const category = getCategory(file);

  content = content.replace(
    /^(---\n[\s\S]*?)(tags:[\s\S]*?---)/m,
    (match, before, rest) => {
      return before + rest.replace('---', `category: ${category}\n---`);
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
  updated++;
}

console.log(`✅ ${updated} artigos categorizados`);
console.log(`⏭️  ${skipped} já tinham categoria`);
