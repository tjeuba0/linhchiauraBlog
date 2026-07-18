export interface ContactEnv {
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface FunctionContext {
  request: Request;
  env: ContactEnv;
}

interface ContactPayload {
  name: string;
  mail: string;
  msg: string;
  turnstileToken: string;
}

type EmailSendFailure =
  | 'configuration'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'rejected'
  | 'unavailable';

type EmailSendResult = { ok: true } | { ok: false; reason: EmailSendFailure };

const MAX_BODY_BYTES = 32_768;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5_000;
const MAX_TURNSTILE_TOKEN_LENGTH = 2_048;
const EMAIL_RE = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const ALLOWED_FIELDS = new Set([
  'name',
  'mail',
  'msg',
  'website',
  'turnstileToken',
]);

const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status, extraHeaders);
}

function hasForbiddenControlCharacters(value: string, allowLineBreaks = false): boolean {
  const pattern = allowLineBreaks
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  return pattern.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isValidFromAddress(value: string): boolean {
  if (hasForbiddenControlCharacters(value)) return false;
  if (EMAIL_RE.test(value)) return true;

  const displayAddress = value.match(/^.{1,100}\s<([^<>]+)>$/);
  return displayAddress !== null && EMAIL_RE.test(displayAddress[1]);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return escaped[character];
  });
}

function validatePayload(value: Record<string, unknown>): ContactPayload | Response {
  if (Object.keys(value).some((key) => !ALLOWED_FIELDS.has(key))) {
    return errorResponse(400, 'INVALID_REQUEST', 'Dữ liệu gửi chưa hợp lệ.');
  }

  const { name, mail = '', msg, website = '', turnstileToken = '' } = value;
  if (
    typeof name !== 'string' ||
    typeof mail !== 'string' ||
    typeof msg !== 'string' ||
    typeof website !== 'string' ||
    typeof turnstileToken !== 'string'
  ) {
    return errorResponse(400, 'INVALID_REQUEST', 'Dữ liệu gửi chưa hợp lệ.');
  }

  const normalized = {
    name: name.trim(),
    mail: mail.trim(),
    msg: msg.trim(),
    turnstileToken: turnstileToken.trim(),
  };

  if (
    normalized.name.length === 0 ||
    normalized.name.length > MAX_NAME_LENGTH ||
    hasForbiddenControlCharacters(normalized.name)
  ) {
    return errorResponse(400, 'INVALID_NAME', 'Tên cần có từ 1 đến 80 ký tự.');
  }

  if (
    normalized.mail.length > MAX_EMAIL_LENGTH ||
    hasForbiddenControlCharacters(normalized.mail) ||
    (normalized.mail.length > 0 && !EMAIL_RE.test(normalized.mail))
  ) {
    return errorResponse(400, 'INVALID_EMAIL', 'Email chưa đúng định dạng.');
  }

  if (
    normalized.msg.length === 0 ||
    normalized.msg.length > MAX_MESSAGE_LENGTH ||
    hasForbiddenControlCharacters(normalized.msg, true)
  ) {
    return errorResponse(400, 'INVALID_MESSAGE', 'Lời nhắn cần có từ 1 đến 5000 ký tự.');
  }

  if (normalized.turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
    return errorResponse(400, 'INVALID_REQUEST', 'Dữ liệu gửi chưa hợp lệ.');
  }

  return normalized;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMilliseconds: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp: string | null,
): Promise<'valid' | 'invalid' | 'unavailable'> {
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const response = await fetchWithTimeout(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      },
      8_000,
    );
    if (!response.ok) return 'unavailable';

    const result: unknown = await response.json();
    if (!isPlainObject(result) || typeof result.success !== 'boolean') return 'unavailable';
    return result.success ? 'valid' : 'invalid';
  } catch {
    return 'unavailable';
  }
}

function buildEmailHtml(payload: ContactPayload): string {
  const safeName = escapeHtml(payload.name);
  const safeEmail = payload.mail ? escapeHtml(payload.mail) : 'Không để lại email';
  const safeMessage = escapeHtml(payload.msg).replace(/\r\n?|\n/g, '<br>');

  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;background:#f7f7f5;color:#292824;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e8e5de;border-radius:16px;padding:28px">
        <h1 style="margin:0 0 24px;font-size:22px">Lời nhắn mới từ Hộp thư</h1>
        <p style="margin:0 0 8px"><strong>Tên:</strong> ${safeName}</p>
        <p style="margin:0 0 24px"><strong>Email hồi âm:</strong> ${safeEmail}</p>
        <div style="border-top:1px solid #eee8df;padding-top:20px;line-height:1.7">${safeMessage}</div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendContactEmail(
  env: ContactEnv,
  payload: ContactPayload,
): Promise<EmailSendResult> {
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const to = env.CONTACT_TO_EMAIL?.trim() ?? '';
  const from = env.CONTACT_FROM_EMAIL?.trim() ?? '';

  if (
    apiKey.length === 0 ||
    !EMAIL_RE.test(to) ||
    hasForbiddenControlCharacters(to) ||
    !isValidFromAddress(from)
  ) {
    return { ok: false, reason: 'configuration' };
  }

  const email: Record<string, unknown> = {
    from,
    to: [to],
    subject: `[Hộp thư Linhchiaura] ${payload.name.slice(0, 60)}`,
    text: [
      `Tên: ${payload.name}`,
      `Email hồi âm: ${payload.mail || 'Không để lại email'}`,
      '',
      'Lời nhắn:',
      payload.msg,
    ].join('\n'),
    html: buildEmailHtml(payload),
  };
  if (payload.mail) email.reply_to = payload.mail;

  try {
    const response = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(email),
      },
      10_000,
    );
    if (response.ok) return { ok: true };

    console.error('Resend email request failed', { status: response.status });

    if (response.status === 401) return { ok: false, reason: 'unauthorized' };
    if (response.status === 403) return { ok: false, reason: 'forbidden' };
    if (response.status === 429) return { ok: false, reason: 'rate_limited' };
    if (response.status >= 500) return { ok: false, reason: 'unavailable' };
    return { ok: false, reason: 'rejected' };
  } catch {
    console.error('Resend email request failed', { status: 'network_or_timeout' });
    return { ok: false, reason: 'unavailable' };
  }
}

export const handleContactRequest = async (
  request: Request,
  env: ContactEnv,
): Promise<Response> => {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', {
      Allow: 'POST',
    });
  }

  if (!isSameOrigin(request)) {
    return errorResponse(403, 'FORBIDDEN', 'Yêu cầu không được chấp nhận.');
  }

  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE', 'Yêu cầu phải dùng JSON.');
  }

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Lời nhắn quá dài.');
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'Không thể đọc dữ liệu gửi lên.');
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Lời nhắn quá dài.');
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Dữ liệu JSON chưa hợp lệ.');
  }

  if (!isPlainObject(body)) {
    return errorResponse(400, 'INVALID_REQUEST', 'Dữ liệu gửi chưa hợp lệ.');
  }

  // Bots that fill this hidden field receive the normal success response, but no email is sent.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return jsonResponse({ ok: true });
  }

  const payload = validatePayload(body);
  if (payload instanceof Response) return payload;

  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const to = env.CONTACT_TO_EMAIL?.trim() ?? '';
  const from = env.CONTACT_FROM_EMAIL?.trim() ?? '';
  if (
    apiKey.length === 0 ||
    !EMAIL_RE.test(to) ||
    hasForbiddenControlCharacters(to) ||
    !isValidFromAddress(from)
  ) {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Hộp thư đang tạm gián đoạn, bạn thử lại sau nhé.');
  }

  const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim() ?? '';
  if (turnstileSecret) {
    if (!payload.turnstileToken) {
      return errorResponse(400, 'TURNSTILE_REQUIRED', 'Vui lòng hoàn tất bước xác minh.');
    }

    const verification = await verifyTurnstile(
      turnstileSecret,
      payload.turnstileToken,
      request.headers.get('CF-Connecting-IP'),
    );
    if (verification === 'invalid') {
      return errorResponse(400, 'VERIFICATION_FAILED', 'Xác minh chưa thành công, bạn thử lại nhé.');
    }
    if (verification === 'unavailable') {
      return errorResponse(503, 'VERIFICATION_UNAVAILABLE', 'Chưa thể xác minh lúc này, bạn thử lại sau nhé.');
    }
  }

  const emailResult = await sendContactEmail(env, payload);
  if (!emailResult.ok) {
    if (emailResult.reason === 'unauthorized') {
      return errorResponse(
        502,
        'EMAIL_AUTH_FAILED',
        'Khóa gửi thư của website chưa được chấp nhận. Bạn vui lòng báo giúp mình nhé.',
      );
    }
    if (emailResult.reason === 'forbidden') {
      return errorResponse(
        502,
        'EMAIL_SENDER_RESTRICTED',
        'Dịch vụ gửi thư chưa cho phép địa chỉ gửi hoặc nhận này.',
      );
    }
    if (emailResult.reason === 'rate_limited') {
      return errorResponse(
        429,
        'EMAIL_RATE_LIMITED',
        'Hộp thư đang nhận quá nhiều lời nhắn. Bạn thử lại sau nhé.',
      );
    }
    if (emailResult.reason === 'rejected') {
      return errorResponse(
        502,
        'EMAIL_REQUEST_REJECTED',
        'Dịch vụ gửi thư chưa chấp nhận nội dung hoặc cấu hình email.',
      );
    }
    if (emailResult.reason === 'configuration') {
      return errorResponse(
        503,
        'EMAIL_NOT_CONFIGURED',
        'Hộp thư đang tạm gián đoạn do thiếu cấu hình gửi thư.',
      );
    }
    return errorResponse(
      503,
      'EMAIL_PROVIDER_UNAVAILABLE',
      'Dịch vụ gửi thư đang tạm gián đoạn, bạn thử lại sau nhé.',
    );
  }

  return jsonResponse({ ok: true });
};

// Kept as a thin compatibility wrapper for Cloudflare Pages Functions previews.
export const onRequest = ({ request, env }: FunctionContext): Promise<Response> =>
  handleContactRequest(request, env);
