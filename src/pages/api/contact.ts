import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { handleContactRequest, type ContactEnv } from '../../../functions/api/contact';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => {
  const env: ContactEnv = {
    RESEND_API_KEY: getSecret('RESEND_API_KEY'),
    CONTACT_TO_EMAIL: getSecret('CONTACT_TO_EMAIL'),
    CONTACT_FROM_EMAIL: getSecret('CONTACT_FROM_EMAIL'),
    TURNSTILE_SECRET_KEY: getSecret('TURNSTILE_SECRET_KEY'),
  };

  return handleContactRequest(request, env);
};
