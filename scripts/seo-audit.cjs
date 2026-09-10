#!/usr/bin/env node
// Auditoria SEO on-page dos posts do blog — title/description/link interno/categoria
// Uso: node scripts/seo-audit.cjs

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

function frontmatterField(content, field) {
  const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const rows = files.map(f => {
  const content = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
  const title = frontmatterField(content, 'title');
  const description = frontmatterField(content, 'description');
  const category = frontmatterField(content, 'category') || 'geral';
  const internalBlogLinks = (content.match(/\]\(\/blog\//g) || []).length;
  return {
    file: f,
    titleLen: title.length,
    descLen: description.length,
    category,
    internalBlogLinks,
    titleTooLong: title.length > 60,
    descTooLong: description.length > 155,
  };
});

const byCategory = {};
for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + 1;

const titleTooLong = rows.filter(r => r.titleTooLong);
const descTooLong = rows.filter(r => r.descTooLong);
const noInternalLinks = rows.filter(r => r.internalBlogLinks === 0);

console.log(`\n=== SEO AUDIT — ${rows.length} posts ===\n`);

console.log('Categoria:');
for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(20)} ${count}`);
}

console.log(`\nTitle tag > 60 chars (risco de truncar no Google): ${titleTooLong.length}/${rows.length}`);
console.log(`Meta description > 155 chars: ${descTooLong.length}/${rows.length}`);
console.log(`Posts SEM nenhum link interno pra outro post do blog: ${noInternalLinks.length}/${rows.length}`);

if (descTooLong.length > 0) {
  console.log('\nDescriptions longas:');
  descTooLong.forEach(r => console.log(`  ${r.descLen} chars — ${r.file}`));
}

console.log('\n');
