import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { PostSummary } from '../lib/posts';

type Tab = 'nhatky' | 'gioithieu' | 'hopthu';
type SubmitState = 'idle' | 'sending' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
const TAB_ORDER: Tab[] = ['nhatky', 'gioithieu', 'hopthu'];
const TAB_HASH: Record<Tab, string> = {
  nhatky: '#nhat-ky',
  gioithieu: '#gioi-thieu',
  hopthu: '#hop-thu',
};

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: 'light';
      size: 'flexible';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => boolean;
    },
  ): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface Props {
  posts: PostSummary[];
}

function tabFromHash(hash: string): Tab {
  const match = TAB_ORDER.find((key) => TAB_HASH[key] === hash);
  return match ?? 'nhatky';
}

export default function AppIsland({ posts }: Props) {
  const [tab, setTab] = useState<Tab>('nhatky');

  useEffect(() => {
    const syncFromUrl = () => setTab(tabFromHash(window.location.hash));
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  const selectTab = (next: Tab, pushHistory = true) => {
    setTab(next);
    if (!pushHistory || window.location.hash === TAB_HASH[next]) return;
    window.history.pushState({ lcTab: next }, '', `${window.location.pathname}${TAB_HASH[next]}`);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const currentIndex = TAB_ORDER.indexOf(current);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TAB_ORDER.length - 1;
    if (nextIndex == null) return;

    event.preventDefault();
    const next = TAB_ORDER[nextIndex];
    selectTab(next);
    requestAnimationFrame(() => document.getElementById(`lc-tab-${next}`)?.focus());
  };

  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [msg, setMsg] = useState('');
  const [hp, setHp] = useState('');
  const [sent, setSent] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileHostRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('');
    if (turnstileWidgetRef.current) window.turnstile?.reset(turnstileWidgetRef.current);
  }, []);

  useEffect(() => {
    if (tab !== 'hopthu' || !TURNSTILE_SITE_KEY || !turnstileHostRef.current) return;

    let cancelled = false;
    const host = turnstileHostRef.current;

    const renderWidget = () => {
      if (cancelled || !window.turnstile || turnstileWidgetRef.current) return;
      turnstileWidgetRef.current = window.turnstile.render(host, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'flexible',
        callback: setTurnstileToken,
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => {
          setTurnstileToken('');
          return true;
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-lc-turnstile]');
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', renderWidget);
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.lcTurnstile = 'true';
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (turnstileWidgetRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetRef.current);
      }
      turnstileWidgetRef.current = null;
      setTurnstileToken('');
    };
  }, [tab]);

  const mailInvalid = mail.trim() !== '' && !EMAIL_RE.test(mail.trim());
  const turnstileReady = !TURNSTILE_SITE_KEY || turnstileToken !== '';
  const canSend =
    name.trim() !== '' &&
    msg.trim() !== '' &&
    !mailInvalid &&
    turnstileReady &&
    submitState !== 'sending';

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;

    setSubmitState('sending');
    setSubmitError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mail: mail.trim(),
          msg: msg.trim(),
          website: hp.trim(),
          turnstileToken,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error?.message || 'Không thể gửi lời nhắn lúc này.');
      }

      setSent(true);
      setSubmitState('idle');
    } catch (error) {
      setSubmitState('error');
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Lời nhắn chưa gửi được. Bạn vui lòng thử lại sau nhé.',
      );
      resetTurnstile();
    }
  };

  const resetForm = () => {
    setSent(false);
    setName('');
    setMail('');
    setMsg('');
    setHp('');
    setSubmitState('idle');
    setSubmitError('');
    resetTurnstile();
  };

  const tabBtn = (key: Tab, label: string) => (
    <button
      id={`lc-tab-${key}`}
      type="button"
      role="tab"
      className={`lc-tab${tab === key ? ' is-active' : ''}`}
      aria-selected={tab === key}
      aria-controls={`lc-panel-${key}`}
      tabIndex={tab === key ? 0 : -1}
      onClick={() => selectTab(key)}
      onKeyDown={(event) => handleTabKeyDown(event, key)}
    >
      {label}
    </button>
  );

  return (
    <>
      <nav className="lc-tabs" aria-label="Nội dung chính">
        <div className="lc-tabs-inner" role="tablist" aria-label="Chọn nội dung">
          {tabBtn('nhatky', 'Nhật Ký')}
          {tabBtn('gioithieu', 'Giới Thiệu')}
          {tabBtn('hopthu', 'Hộp Thư')}
        </div>
      </nav>

      {tab === 'nhatky' && (
        <section
          id="lc-panel-nhatky"
          className="lc-section"
          role="tabpanel"
          aria-labelledby="lc-tab-nhatky"
        >
          <div className="lc-nk-head">
            <div>
              <h2 className="lc-h2">
                <span aria-hidden="true">📖</span>
                <span>Nhật Ký Linhchiaura</span>
              </h2>
              <p className="lc-sub">Nơi lắng đọng những dòng suy ngẫm mộc mạc và chân thành.</p>
            </div>
          </div>
          <div className="lc-grid">
            {posts.map((post) => (
              <a key={post.slug} className="lc-card" href={`/bai/${post.slug}`}>
                <div className="lc-card-top">
                  <span className="lc-tag">{post.tag}</span>
                  <span className="lc-mins">{post.mins}</span>
                </div>
                <h3 className="lc-card-title">{post.title}</h3>
                <p className="lc-card-excerpt">{post.excerpt}</p>
                <div className="lc-card-bottom">
                  <time className="lc-card-date" dateTime={post.isoDate}>
                    {post.date}
                  </time>
                  <span className="lc-card-more">Đọc tiếp →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {tab === 'gioithieu' && (
        <section
          id="lc-panel-gioithieu"
          className="lc-section"
          role="tabpanel"
          aria-labelledby="lc-tab-gioithieu"
        >
          <div className="lc-about-grid">
            <article className="lc-about-card">
              <div className="lc-blob lc-blob--green" aria-hidden="true" />
              <div className="lc-about-icon lc-about-icon--heart" aria-hidden="true">
                <Heart size={18} strokeWidth={2} />
              </div>
              <h2 className="lc-about-title">Sở thích &amp; Đam mê</h2>
              <p className="lc-about-desc">
                Chạy bộ &amp; leo núi, sáng tạo nội dung số, tâm lý học, du lịch khám phá &amp; thiện
                nguyện.
              </p>
            </article>
            <article className="lc-about-card">
              <div className="lc-blob lc-blob--orange" aria-hidden="true" />
              <div className="lc-about-icon lc-about-icon--spark" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <h2 className="lc-about-title">Phong cách sống</h2>
              <p className="lc-about-desc">
                Năng động, hiện đại, độc lập, tinh tế và luôn tràn đầy tiếng cười; kết hợp sự mềm mại
                nữ tính với tinh thần tự tin bứt phá.
              </p>
            </article>
            <article className="lc-about-card">
              <div className="lc-blob lc-blob--green" aria-hidden="true" />
              <div className="lc-about-icon lc-about-icon--quote" aria-hidden="true">
                ❞
              </div>
              <h2 className="lc-about-title">Triết lý sống</h2>
              <p className="lc-about-desc lc-about-desc--italic">
                Sống rực rỡ và tỏa sáng theo cách riêng của bạn. Bằng tri thức, sự bình an và tử tế!
              </p>
            </article>
          </div>
          <figure className="lc-banner">
            <div className="lc-banner-mark" aria-hidden="true">
              “
            </div>
            <blockquote className="lc-banner-quote">
              Aut inveniam viam aut faciam – Hoặc tôi sẽ tìm thấy một con đường, hoặc tôi sẽ tự tạo
              con đường cho chính tôi.
            </blockquote>
          </figure>
        </section>
      )}

      {tab === 'hopthu' && (
        <section
          id="lc-panel-hopthu"
          className="lc-ht-wrap"
          role="tabpanel"
          aria-labelledby="lc-tab-hopthu"
        >
          <div className="lc-ht-col">
            <div className="lc-ht-head">
              <h2 className="lc-h2 lc-h2--center">
                <span aria-hidden="true">🕊</span>
                <span>Gửi Lời Nhắn Cho Mình</span>
              </h2>
              <p className="lc-ht-sub">
                Một câu tâm sự, một câu hỏi hay chỉ đơn giản là lời chào. Thư được gửi riêng cho mình
                và không hiển thị công khai. Nếu muốn nhận hồi âm, bạn hãy để lại email nhé 🤍
              </p>
            </div>
            <div className="lc-form-card">
              {sent ? (
                <div className="lc-thanks" role="status" aria-live="polite">
                  <div className="lc-thanks-emoji" aria-hidden="true">
                    💌
                  </div>
                  <h3 className="lc-thanks-title">Đã gửi đi yêu thương!</h3>
                  <p className="lc-thanks-text">
                    Cảm ơn bạn đã để lại đôi dòng. Lời nhắn đã đến hộp thư của mình rồi nhé 🤍
                  </p>
                  <button type="button" className="lc-thanks-btn" onClick={resetForm}>
                    Viết thêm lời nhắn
                  </button>
                </div>
              ) : (
                <form className="lc-form" onSubmit={handleSubmit} noValidate>
                  <div>
                    <label className="lc-label" htmlFor="lc-contact-name">
                      Tên của bạn <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="lc-contact-name"
                      className="lc-input"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nhập tên đáng yêu của bạn..."
                      autoComplete="name"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div>
                    <label className="lc-label" htmlFor="lc-contact-email">
                      Email <span className="lc-label-optional">(không bắt buộc)</span>
                    </label>
                    <input
                      id="lc-contact-email"
                      className="lc-input"
                      name="email"
                      type="email"
                      inputMode="email"
                      value={mail}
                      onChange={(event) => setMail(event.target.value)}
                      placeholder="ban@example.com — nếu muốn nhận hồi âm"
                      autoComplete="email"
                      maxLength={254}
                      aria-invalid={mailInvalid}
                      aria-describedby={mailInvalid ? 'lc-contact-email-error' : undefined}
                    />
                    {mailInvalid && (
                      <div id="lc-contact-email-error" className="lc-field-error" role="alert">
                        Email chưa đúng định dạng, bạn kiểm tra lại nhé.
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="lc-label" htmlFor="lc-contact-message">
                      Lời nhắn gửi <span aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="lc-contact-message"
                      className="lc-textarea"
                      name="message"
                      rows={5}
                      value={msg}
                      onChange={(event) => setMsg(event.target.value)}
                      placeholder="Hãy viết điều bạn đang nghĩ vào đây..."
                      maxLength={5000}
                      required
                    />
                  </div>
                  <div className="lc-hp" aria-hidden="true">
                    <input
                      id="lc-contact-website"
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value={hp}
                      onChange={(event) => setHp(event.target.value)}
                    />
                  </div>
                  {TURNSTILE_SITE_KEY && (
                    <div className="lc-turnstile-wrap">
                      <div ref={turnstileHostRef} className="lc-turnstile" />
                      {!turnstileReady && (
                        <p className="lc-form-hint">Hoàn tất bước xác minh để gửi lời nhắn.</p>
                      )}
                    </div>
                  )}
                  {submitState === 'error' && (
                    <div className="lc-submit-error" role="alert" aria-live="assertive">
                      {submitError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className={`lc-send${canSend ? ' is-ready' : ''}`}
                    disabled={!canSend}
                    aria-busy={submitState === 'sending'}
                  >
                    {submitState === 'sending' ? 'ĐANG GỬI...' : '🕊 GỬI ĐI YÊU THƯƠNG'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
