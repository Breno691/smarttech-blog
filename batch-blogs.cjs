const { execSync } = require('child_process');

const BLOGS = [
  "Lean Six Sigma vs consultoria tradicional: qual faz mais sentido para empresa pequena",
  "Vale a pena contratar consultoria de processos para pequena empresa",
  "Automação vs contratação: quando é melhor automatizar do que contratar",
  "Lean vs Six Sigma: qual a diferença e qual aplicar primeiro",
  "Processo manual vs processo documentado: o que muda na prática",
  "Consultoria presencial vs consultoria online: o que funciona melhor para melhoria de processos",
  "Treinamento de equipe vs melhoria de processo: por onde começar",
  "Quando não adianta automatizar: os sinais que o processo precisa ser melhorado antes",
  "Chatbot vs atendente humano: quando cada um faz sentido no WhatsApp",
  "Planilha vs sistema: quando a planilha ainda é a melhor opção para pequena empresa",
  "Contratar gerente vs organizar processo: qual resolve o problema de crescimento",
  "Certificação Lean Six Sigma vale a pena para quem tem empresa pequena",
  "Melhoria contínua vs projeto pontual: qual gera mais resultado a longo prazo",
  "Indicadores financeiros vs indicadores de processo: qual acompanhar primeiro",
  "Fazer internamente vs terceirizar a melhoria de processos: o que faz mais sentido",
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`\n🚀 Gerando ${BLOGS.length} artigos...\n`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < BLOGS.length; i++) {
    const titulo = BLOGS[i];
    console.log(`[${i + 1}/${BLOGS.length}] "${titulo}"`);
    try {
      execSync(`node create-blog.cjs "${titulo}"`, {
        cwd: __dirname,
        stdio: 'pipe',
        timeout: 90000
      });
      ok++;
      console.log(`  ✅ Criado\n`);
    } catch (e) {
      fail++;
      const msg = e.stderr?.toString() || e.message;
      console.log(`  ❌ Erro: ${msg.split('\n')[0]}\n`);
    }
    if (i < BLOGS.length - 1) await sleep(1500);
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✅ ${ok} criados  |  ❌ ${fail} com erro`);
  console.log(`📁 src/content/blog/`);
  console.log(`🚀 Faça o deploy para publicar\n`);
}

main();
