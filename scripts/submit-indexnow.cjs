// submit-indexnow.cjs — avisa Bing/Yandex (protocolo IndexNow) das URLs do
// sitemap gerado em dist/. Chamado pelo deploy-ftp.cjs depois que o upload
// FTP terminar com sucesso — NÃO no build local (dist/ nem sempre é o que
// está publicado; rodar isso a cada "npm run build" de teste ficaria
// avisando os motores de busca sobre páginas que ainda não foram ao ar).
'use strict';
const fs = require('fs');
const path = require('path');

const HOST = 'smartops-ia.com.br';
const INDEXNOW_KEY = '817ba491d86d0e4f3f3f03f5377f9b20';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MAX_URLS_PER_REQUEST = 10000; // limite do protocolo IndexNow

function extractLocs(xml) {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
  return matches.map((m) => m.replace(/<\/?loc>/g, ''));
}

function collectSitemapUrls() {
  const indexPath = path.join(DIST_DIR, 'sitemap-index.xml');
  if (!fs.existsSync(indexPath)) {
    throw new Error('sitemap-index.xml não encontrado em dist/ — rode "npm run build" antes.');
  }
  const indexXml = fs.readFileSync(indexPath, 'utf-8');
  const chunkUrls = extractLocs(indexXml); // aponta pros arquivos reais (sitemap-0.xml, sitemap-1.xml...)

  const pageUrls = [];
  for (const chunkUrl of chunkUrls) {
    const fileName = chunkUrl.split('/').pop();
    const chunkPath = path.join(DIST_DIR, fileName);
    if (!fs.existsSync(chunkPath)) continue;
    pageUrls.push(...extractLocs(fs.readFileSync(chunkPath, 'utf-8')));
  }
  return pageUrls;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function submitIndexNow(urls) {
  if (!urls.length) {
    console.warn('⚠️  IndexNow: nenhuma URL encontrada no sitemap — nada foi avisado.');
    return;
  }
  for (const batch of chunkArray(urls, MAX_URLS_PER_REQUEST)) {
    const payload = { host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList: batch };
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (res.status === 200 || res.status === 202) {
        console.log(`✅ IndexNow: ${batch.length} URLs notificadas ao Bing/Yandex (status ${res.status}).`);
      } else {
        const text = await res.text().catch(() => '');
        console.error(`⚠️  IndexNow recusou o aviso (status ${res.status}). ${text}`.trim());
      }
    } catch (err) {
      console.error('❌ IndexNow: falha ao notificar —', err.message);
    }
  }
}

async function run() {
  try {
    await submitIndexNow(collectSitemapUrls());
  } catch (err) {
    console.error('❌ IndexNow: erro ao preparar o aviso —', err.message);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, submitIndexNow, collectSitemapUrls };
