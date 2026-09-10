# SmartOps SEO — Site e Blog institucional

Site institucional da consultoria SmartOps IA (`smartops-ia.com.br`) e o blog dele, feitos em Astro. Publicado em Hostgator via FTP — **não é o mesmo projeto** do "SmartOps IA Sistema" (`Desktop/claude code/`, o motor multiagente).

Esta pasta também guarda, soltos na raiz, os workflows n8n do robô de WhatsApp e da captura de leads do site — ficaram aqui por conveniência, não fazem parte do build do Astro.

## Rodando o site

```bash
npm run dev       # localhost:4321
npm run build     # gera dist/
npm run preview   # confere o build antes de publicar
```

## Deploy (manual, via FTP pro Hostgator)

```bash
node deploy-ftp.cjs
```
Sobe `dist/` inteiro pra `/` (a **raiz** da conta FTP) no Hostgator — **NÃO** `/public_html`. Precisa de um `.env` na raiz com `FTP_HOST`, `FTP_USER`, `FTP_PASS` (usa `basic-ftp` + `dotenv`, ver `deploy-ftp.cjs`). Sempre rodar `npm run build` antes — o script não builda sozinho.

⚠️ **Pegadinha real, encontrada em 08/set/2026**: essa conta tem uma pasta `/public_html` separada que **não é** o document root do site — é o document root real da raiz (`/`) que serve `smartops-ia.com.br`. O script já apontava pra `/public_html` até essa data (bug histórico não percebido: o FTP "tinha sucesso" sem erro, mas o site no ar continuava servindo a versão antiga da raiz). Corrigido pra apontar pra `/`. **Depois de qualquer deploy, sempre confirmar de verdade** (`curl`/abrir o site) que o conteúdo mudou — não confiar só na mensagem "DEPLOY CONCLUÍDO" do script.

⚠️ **`.htaccess` da raiz tem uma regra do cPanel que não pode ser perdida**: o bloco `# php -- BEGIN cPanel-generated handler, do not edit` (define PHP como linguagem padrão pra essa conta) fica *só* no servidor, não existe no `public/.htaccess` do projeto (que só tem os redirects de posts de blog duplicados). Toda vez que o deploy sobrescrever o `.htaccess` da raiz, checar se esse bloco do cPanel continua lá (baixar e comparar) — se sumir, tem que ser adicionado de volta manualmente antes do bloco dos redirects.

Existe um `netlify.toml` na pasta, mas o deploy real é o FTP acima — o Netlify não é o destino atual.

## Blog

Posts em `src/content/blog/`. Scripts de manutenção em lote na raiz:
- `create-blog.cjs` — cria post novo
- `batch-blogs.cjs` — cria vários de uma vez
- `add-categories.cjs`, `update-behavior.cjs`, `update-situations.cjs`, `update-training.cjs` — ajustes em lote no conteúdo existente
- `scripts/seo-audit.cjs` — auditoria de SEO

`_archived-blog-posts/` guarda posts tirados do ar (não apagar sem checar antes).

**Regra de link building**: todo post novo (manual ou em lote) deve conter pelo menos um link interno pra página pilar da categoria (`/lean-six-sigma` ou `/automacao`) e um link pra `/diagnostico-gratuito` — não é automático (posts são Markdown estático), então é regra de redação a seguir na hora de escrever.

## IndexNow (aviso automático de indexação)

`scripts/submit-indexnow.cjs` lê `dist/sitemap-index.xml` + os sitemaps que ele referencia, extrai todas as URLs e avisa Bing/Yandex via protocolo IndexNow. Chamado automaticamente pelo `deploy-ftp.cjs` **depois** do upload FTP terminar com sucesso — nunca no `npm run build` local, porque `dist/` local nem sempre é o que está publicado (evita avisar o Bing sobre página que ainda não foi ao ar). A chave (`public/817ba491d86d0e4f3f3f03f5377f9b20.txt`) é fixa — não regenerar, ela precisa continuar batendo com o que já foi enviado ao Bing.

Google Indexing API não é usada aqui de propósito: é restrita a vaga de emprego e transmissão ao vivo, não se aplica a post de blog nem página de serviço.

## Workflows n8n guardados aqui (não fazem parte do site)

| Arquivo | O que é |
|---|---|
| `SMARTOPS - Agente WhatsApp IA v3.json` | única versão mantida do robô de WhatsApp (versões antigas apagadas em 04/set/2026) |
| `SMARTOPS - Captura de Leads v3.json` | única versão mantida da captura de leads do site (versões antigas apagadas em 04/set/2026) |

Ver também [[project_whatsapp_evolution_bot]] na memória — o robô de WhatsApp "oficial" em produção vive em `Desktop/claude code/whatsapp-evolution-bot`, não nesta pasta.

## Outros arquivos da raiz
- `briefing-claude-navegador-google-ads.md`, `campanha-google-ads-detalhada.md` — material da campanha do Google Ads (marketing, não código)
- `docs/tracking-audit.md` — auditoria de tracking/analytics do site
- Zips de builds antigas foram apagados em 04/set/2026 (só ocupavam espaço, sem uso)
