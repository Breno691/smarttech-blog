/**
 * meta-capi.js — Funções para envio de eventos à Meta Conversions API
 *
 * USO NO N8N:
 *   1. No workflow de captura de leads, após salvar o lead, adicione um nó "Code"
 *   2. Cole o conteúdo de capiLeadPayload() e execute fetch para a URL abaixo
 *
 * ENDPOINT META CAPI:
 *   POST https://graph.facebook.com/v20.0/{PIXEL_ID}/events
 *   ?access_token={CAPI_ACCESS_TOKEN}
 *
 * DOCUMENTAÇÃO:
 *   https://developers.facebook.com/docs/marketing-api/conversions-api
 */

'use strict';

const CAPI_API_VERSION = 'v20.0';
const CAPI_ENDPOINT = `https://graph.facebook.com/${CAPI_API_VERSION}`;

// ─── Utilitários de hash (SHA-256 normalizado, conforme exige a Meta) ─────────
const crypto = require('crypto');

function hashSHA256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.toString().trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : '55' + digits;
}

// ─── Monta user_data com hashes conforme Advanced Matching da Meta ─────────────
function buildUserData({ email, phone, firstName, lastName, city, state, country, zip, clientIp, userAgent, fbp, fbc }) {
  const ud = {};
  if (email)     ud.em  = hashSHA256(email);
  if (phone)     ud.ph  = hashSHA256(normalizePhone(phone));
  if (firstName) ud.fn  = hashSHA256(firstName);
  if (lastName)  ud.ln  = hashSHA256(lastName);
  if (city)      ud.ct  = hashSHA256(city);
  if (state)     ud.st  = hashSHA256(state);
  if (country)   ud.country = hashSHA256(country);
  if (zip)       ud.zp  = hashSHA256(zip);
  if (clientIp)  ud.client_ip_address = clientIp;
  if (userAgent) ud.client_user_agent = userAgent;
  if (fbp)       ud.fbp = fbp;   // cookie _fbp — NÃO hashear
  if (fbc)       ud.fbc = fbc;   // cookie _fbc — NÃO hashear
  return ud;
}

// ─── Payload para evento Lead (captura de lead via formulário) ────────────────
function capiLeadPayload({ pixelId, accessToken, eventId, sourceUrl, userData, customData }) {
  return {
    url: `${CAPI_ENDPOINT}/${pixelId}/events?access_token=${accessToken}`,
    body: {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || ('lead_' + Date.now()),  // para deduplicação com browser pixel
        event_source_url: sourceUrl || 'https://smartops-ia.com.br',
        action_source: 'website',
        user_data: buildUserData(userData || {}),
        custom_data: {
          content_name: customData?.servico || 'diagnostico_gratuito',
          content_category: 'consultoria',
          ...customData,
        },
      }],
      test_event_code: process.env.META_CAPI_TEST_CODE || undefined, // remover em produção
    },
  };
}

// ─── Payload para evento Schedule (agendamento de diagnóstico) ────────────────
function capiSchedulePayload({ pixelId, accessToken, eventId, sourceUrl, userData }) {
  return {
    url: `${CAPI_ENDPOINT}/${pixelId}/events?access_token=${accessToken}`,
    body: {
      data: [{
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || ('sched_' + Date.now()),
        event_source_url: sourceUrl || 'https://smartops-ia.com.br/diagnostico-gratuito',
        action_source: 'website',
        user_data: buildUserData(userData || {}),
        custom_data: {
          content_name: 'diagnostico_gratuito',
          content_category: 'consultoria',
        },
      }],
    },
  };
}

// ─── Payload para evento Contact (clique no WhatsApp) ─────────────────────────
function capiContactPayload({ pixelId, accessToken, eventId, sourceUrl, userData }) {
  return {
    url: `${CAPI_ENDPOINT}/${pixelId}/events?access_token=${accessToken}`,
    body: {
      data: [{
        event_name: 'Contact',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId || ('contact_' + Date.now()),
        event_source_url: sourceUrl,
        action_source: 'website',
        user_data: buildUserData(userData || {}),
      }],
    },
  };
}

// ─── Envio para a API da Meta ─────────────────────────────────────────────────
async function sendCAPIEvent(payload) {
  const res = await fetch(payload.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload.body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`CAPI error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

module.exports = {
  capiLeadPayload,
  capiSchedulePayload,
  capiContactPayload,
  buildUserData,
  hashSHA256,
  sendCAPIEvent,
};
