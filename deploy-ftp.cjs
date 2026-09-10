// deploy-ftp.cjs — Deploy dist/ para Hostgator via FTP
require('dotenv').config();
const ftp  = require('basic-ftp');
const path = require('path');
const { run: submitIndexNow } = require('./scripts/submit-indexnow.cjs');

const CONFIG = {
  host:     process.env.FTP_HOST,
  user:     process.env.FTP_USER,
  password: process.env.FTP_PASS,
  secure:   false,
  port:     21,
};

const LOCAL_DIR  = path.join(__dirname, 'dist');
// A raiz da conta FTP ("/") é o document root real de smartops-ia.com.br —
// "/public_html" é uma pasta separada, não servida publicamente (confirmado
// em 08/set/2026: o deploy pra /public_html "funcionava" sem erro, mas o
// site no ar continuava servindo a versão antiga da raiz). Corrigido aqui.
const REMOTE_DIR = '/';

async function deploy() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    console.log('🔌 Conectando ao Hostgator...');
    await client.access(CONFIG);
    console.log('✅ Conectado!\n');
    console.log(`📤 Uploading dist/ → ${REMOTE_DIR}`);
    console.log('⏳ Pode levar alguns minutos (123 posts)...\n');

    await client.ensureDir(REMOTE_DIR);
    await client.uploadFromDir(LOCAL_DIR, REMOTE_DIR);

    console.log('\n✅ DEPLOY CONCLUÍDO!');
    console.log('🌐 https://smartops-ia.com.br/blog\n');

    console.log('📡 Avisando Bing/Yandex (IndexNow) sobre as URLs publicadas...');
    await submitIndexNow();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
