---
title: "Teste — Blog funcionando com Astro 6"
description: "Artigo de teste para validar que o blog dinâmico, markdown e SEO estão funcionando corretamente."
pubDate: "2025-05-19"
author: "SmartOps SEO"
tags: ["Teste", "Astro", "SEO"]
---

## Funcionou! 🚀

Se você está vendo esta página, significa que:

- **Content Collections** do Astro 6 estão ativas
- **Markdown** está sendo renderizado corretamente
- **Rotas dinâmicas** `/blog/[...slug]` estão funcionando
- **Layout SEO** com meta tags está aplicado

## Verifique o SEO

Abra o DevTools (`F12`) → aba **Elements** → dentro de `<head>`:

- `<title>` com o título do artigo
- `<meta name="description">`
- `<meta property="og:title">` e `og:image`
- `<link rel="canonical">`
- `<script type="application/ld+json">` com Schema.org

## Próximo passo

Conectar o **n8n** para criar esses arquivos `.md` automaticamente via GitHub API. 🤖
