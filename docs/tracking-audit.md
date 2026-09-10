# SmartOps IA — Documentação de Tracking
**Auditoria realizada em:** 2026-05-29
**Auditor:** Meta Ads Tracking Specialist

---

## Stack de Tracking

| Sistema | ID / Config | Status |
|---|---|---|
| Google Tag Manager | GTM-MQ69PTC9 | ✅ Ativo em todas as páginas |
| Google Analytics 4 | G-9GFH1BS308 | ✅ Ativo (direto + via GTM) |
| Meta Pixel | `PUBLIC_META_PIXEL_ID` (env) | ⚠️ **Requer Pixel ID no .env** |
| Meta Conversions API | `META_CAPI_ACCESS_TOKEN` (env) | 🔧 Implementado via n8n |

---

## ⚠️ AÇÃO NECESSÁRIA — Pixel ID

O Meta Pixel só carrega quando `PUBLIC_META_PIXEL_ID` está definido no `.env`.

**Para ativar o Pixel:**
```bash
# Edite o arquivo .env na raiz do projeto
PUBLIC_META_PIXEL_ID=SEU_PIXEL_ID_AQUI   # ex: 1234567890123456
```

**Onde obter o Pixel ID:**
1. Acesse [business.facebook.com/events_manager2](https://business.facebook.com/events_manager2)
2. Selecione seu Pixel → Configurações → ID do Pixel

---

## ⚠️ AÇÃO NECESSÁRIA — CAPI Token

```bash
# Adicione ao .env
META_CAPI_ACCESS_TOKEN=SEU_TOKEN_AQUI
```

**Onde obter:**
1. Events Manager → Configurações → Conversions API
2. "Gerar token de acesso" → copie o token
3. No n8n: Settings → Environment Variables → `META_CAPI_TOKEN`

---

## Arquitetura de Eventos

```
Usuário
  │
  ├── PageView (browser) ──────────────────────────────→ Meta Pixel (PageView + event_id)
  │                                                              ↓
  ├── Clique WhatsApp [data-event="clique_whatsapp"]  → fbq('track','Contact')
  │                                                   → fbq('trackCustom','WhatsAppClick')
  │                                                   → dataLayer.push({event:'clique_whatsapp'})
  │
  ├── Clique CTA [data-event="clique_cta"]            → fbq('track','Lead')
  │                                                   → dataLayer.push({event:'clique_cta'})
  │
  ├── Clique Diagnóstico [data-event="schedule_diagnostico"] → fbq('track','Schedule')
  │                                                          → fbq('track','Lead')
  │                                                          → dataLayer.push(...)
  │
  ├── Scroll 90%                                      → fbq('track','ViewContent',{scroll_depth:90})
  │                                                   → dataLayer.push({event:'scroll_90'})
  │
  └── Submit Formulário (index.astro)
        ├── Submit:   fbq('track','Contact', {}, {eventID:'lead_XYZ'})   ← event_id para CAPI
        └── Sucesso:  fbq('track','Lead', {content_name:servico}, {eventID:'lead_XYZ'})
                          │
                          └── Webhook n8n → CAPI Lead (event_id:'lead_XYZ') ← deduplicação
```

---

## Mapa de Páginas × Tracking

| Página | GTM | GA4 | MetaPixel | EventTracking | Eventos especiais |
|---|---|---|---|---|---|
| `/` (Home) | ✅ | ✅ | ✅ | ✅ | form Lead/Contact + dedup event_id |
| `/diagnostico-gratuito` | ✅ | ✅ | ✅ | ✅ | schedule_diagnostico (4 CTAs) |
| `/lean-six-sigma` | ✅ | ✅ | ✅ | ✅ | clique_whatsapp, clique_cta |
| `/automacao` | ✅ | ✅ | ✅ | ✅ | clique_whatsapp, clique_cta |
| `/manutencao` | ✅ | ✅ | ✅ | ✅ | clique_whatsapp, clique_cta |
| `/sobre` | ✅ | ✅ | ✅ | ❌ | apenas PageView |
| `/blog` | ✅ | ✅ | ✅ | ✅ | scroll_90, clique_cta |
| `/blog/[slug]` | ✅ | ✅ | ✅ | ✅ | scroll_90 |

---

## Eventos Meta Pixel — Referência

| Evento | Trigger | Tipo | Parâmetros |
|---|---|---|---|
| `PageView` | Toda página | Standard | `eventID` (para dedup CAPI) |
| `Contact` | Submit formulário (início) | Standard | `eventID: leadEventId` |
| `Lead` | Formulário enviado com sucesso | Standard | `content_name, eventID` |
| `Schedule` | Clique em CTA diagnóstico | Standard | — |
| `ViewContent` | Scroll 90% | Standard | `scroll_depth: 90` |
| `WhatsAppClick` | Clique no WhatsApp | Custom | `event_location` |
| `DiagnosticoClick` | Clique em CTA diagnóstico | Custom | `event_location` |
| `PhoneClick` | Clique no telefone | Custom | `event_location` |

---

## Deduplicação Browser × CAPI

Para evitar contagem dupla quando CAPI estiver ativo:

**Browser (MetaPixel.astro):**
```javascript
fbq('track', 'Lead', { content_name: servico }, { eventID: 'lead_1748475600_abc123' });
```

**CAPI (n8n Code Node):**
```javascript
{
  event_name: 'Lead',
  event_id: 'lead_1748475600_abc123',  // ← MESMO ID
  event_time: 1748475600,
  user_data: { ph: hashSHA256('5531972039180'), fn: hashSHA256('joao') },
}
```

**Regra:** `event_id` idêntico nos dois lados. Meta descarta o duplicado automaticamente.

---

## Advanced Matching — Event Match Quality

O EMQ mede quão bem a Meta consegue associar eventos a usuários. Fatores:

| Sinal | Status | Impacto EMQ |
|---|---|---|
| `fbp` cookie | ✅ Capturado no payload | Alto |
| `fbc` cookie | ✅ Capturado no payload | Alto |
| `ph` (telefone hash) | ✅ Enviado via CAPI | Muito Alto |
| `fn`/`ln` (nome hash) | ✅ Enviado via CAPI | Médio |
| `em` (email hash) | ❌ Formulário não captura email | Alto — **adicionar campo email** |
| `ct`/`st` (cidade/estado) | ✅ Fixo BH/MG no CAPI | Baixo |
| `client_ip` | ❌ Site estático sem server | — configure no n8n com IP do header |

**Para aumentar EMQ:**
1. Adicionar campo email no formulário da Home
2. Capturar `X-Forwarded-For` no n8n e passar como `client_ip_address`
3. Passar `user_agent` do header no n8n

---

## GTM × GA4 — Aviso de Double Counting

O site carrega **GA4 direto** (`GoogleAnalytics.astro`) + **GTM** (`GTMHead.astro`).

Se o GTM container `GTM-MQ69PTC9` também tiver uma tag GA4 configurada para a mesma property `G-9GFH1BS308`, os pageviews serão **contados em dobro** no GA4.

**Verificar:** GTM → Tags → procurar tag Google Analytics 4
- Se existir: remover `GoogleAnalytics.astro` das páginas (deixar só via GTM)
- Se não existir: manter como está (GA4 só via código direto)

---

## Configurar CAPI no n8n — Passo a Passo

1. Acesse o n8n em `https://n8n-n8nn.sumjyb.easypanel.host`
2. Abra o workflow **captura-leads**
3. Após o nó de webhook, adicione nó **Code**
4. Cole o código de `n8n-capi-workflow.json` (campo `n8n_code_node.parameters.jsCode`)
5. Em **Settings → Environment Variables**, adicione:
   - `META_PIXEL_ID` = seu Pixel ID
   - `META_CAPI_TOKEN` = seu CAPI access token
6. Para testar:
   - Events Manager → Test Events → copie o `Test Event Code`
   - No nó Code, descomente `test_event_code: 'TEST12345'`
   - Envie um lead de teste e verifique no Events Manager

---

## Verificação com Meta Pixel Helper

1. Instale: [Meta Pixel Helper para Chrome](https://chrome.google.com/webstore/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
2. Acesse `https://smartops-ia.com.br`
3. Verifique:
   - ✅ Pixel ID correto carregado
   - ✅ `PageView` disparou com `eventID`
   - ✅ Clique no WhatsApp → `Contact` + `WhatsAppClick`
   - ✅ Acesse `/diagnostico-gratuito` → clique no CTA → `Schedule` + `Lead`
   - ✅ Scroll até 90% → `ViewContent`

---

## Checklist de Qualidade (mensal)

- [ ] Events Manager: taxa de correspondência > 80%?
- [ ] Eventos duplicados? (browser + CAPI com mesmo event_id = 1 evento no relatório)
- [ ] EMQ score ≥ 7/10?
- [ ] CAPI enviando eventos para todos os leads?
- [ ] GTM container sem tags GA4 duplicadas?
- [ ] `PUBLIC_META_PIXEL_ID` definido no deploy (Netlify env vars)?

---

## Variáveis de Ambiente Necessárias

```bash
# .env (desenvolvimento local)
PUBLIC_META_PIXEL_ID=1234567890123456    # Pixel ID — ativa o Meta Pixel
META_CAPI_ACCESS_TOKEN=EAAxxxxx...       # Token CAPI — usado pelo n8n

# Netlify (produção) — adicionar em Site Settings → Environment Variables
PUBLIC_META_PIXEL_ID=1234567890123456
```

---

## Arquivos Modificados nesta Auditoria

| Arquivo | Modificação |
|---|---|
| `src/components/MetaPixel.astro` | + Advanced Matching, + `event_id` no PageView |
| `src/components/EventTracking.astro` | + `schedule_diagnostico`, + `clique_telefone`, + Advanced Matching hook |
| `src/pages/diagnostico-gratuito.astro` | + GA4, + EventTracking, + `data-event` em 4 CTAs |
| `src/pages/lean-six-sigma/index.astro` | + EventTracking |
| `src/pages/automacao/index.astro` | + EventTracking |
| `src/pages/index.astro` | + `event_id` para dedup, + `fbp`/`fbc` no payload, Contact→Lead flow |
| `src/lib/meta-capi.js` | Novo — funções CAPI (Lead, Schedule, Contact) |
| `n8n-capi-workflow.json` | Novo — código para nó n8n |
| `.env` | Requer adição manual: `PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` |
