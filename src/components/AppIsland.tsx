import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { PostSummary } from '../lib/posts';

type Tab = 'nhatky' | 'gioithieu' | 'hopthu';
type SubmitState = 'idle' | 'sending' | 'error';
type Reading = { size: number; bold: boolean; italic: boolean };
type ModalContentState = 'idle' | 'ready' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const READING_STORAGE_KEY = 'lc-reading';
const READING_MIN = 15;
const READING_MAX = 24;
const DEFAULT_READING: Reading = { size: 17, bold: false, italic: false };
const MODAL_CLOSE_DURATION = 180;
const TURNSTILE_SITE_KEY =
  import.meta.env.PUBLIC_TURNSTILE_SITE_KEY?.trim() || '0x4AAAAAAD4dVml4Ve5kO060';
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

function clampReadingSize(size: number): number {
  return Math.min(READING_MAX, Math.max(READING_MIN, size));
}

function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

const postContentCache = new Map<string, Promise<string>>();

function getPostContent(slug: string): Promise<string> {
  const cached = postContentCache.get(slug);
  if (cached) return cached;

  const request = fetch(`/bai/${encodeURIComponent(slug)}/`, {
    headers: { Accept: 'text/html' },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Không thể tải bài viết (${response.status}).`);
      const html = await response.text();
      const document = new DOMParser().parseFromString(html, 'text/html');
      const content = document.querySelector<HTMLElement>('[data-modal-content]');
      if (!content) throw new Error('Không tìm thấy nội dung bài viết.');

      content.querySelectorAll<HTMLElement>('[href], [src]').forEach((element) => {
        for (const attribute of ['href', 'src'] as const) {
          const value = element.getAttribute(attribute);
          if (!value) continue;
          try {
            element.setAttribute(attribute, new URL(value, response.url).href);
          } catch {
            // Keep malformed author content unchanged so the rest of the post still renders.
          }
        }
      });
      content.querySelectorAll<HTMLElement>('[srcset]').forEach((element) => {
        const srcset = element.getAttribute('srcset');
        if (!srcset) return;
        const normalized = srcset
          .split(',')
          .map((candidate) => {
            const [url, ...descriptor] = candidate.trim().split(/\s+/);
            try {
              return [new URL(url, response.url).href, ...descriptor].join(' ');
            } catch {
              return candidate.trim();
            }
          })
          .join(', ');
        element.setAttribute('srcset', normalized);
      });
      return content.innerHTML;
    })
    .catch((error) => {
      postContentCache.delete(slug);
      throw error;
    });

  postContentCache.set(slug, request);
  return request;
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

  // --- Focused reading dialog ---
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activeSlugRef = useRef<string | null>(null);
  const [modalHtml, setModalHtml] = useState('');
  const [modalContentState, setModalContentState] = useState<ModalContentState>('idle');
  const [modalReloadKey, setModalReloadKey] = useState(0);
  const [reading, setReading] = useState<Reading>(DEFAULT_READING);
  const readingRef = useRef<Reading>(DEFAULT_READING);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalTitleRef = useRef<HTMLHeadingElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLAnchorElement | null>(null);
  const requestIdRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const progressFrameRef = useRef<number | null>(null);

  const activePost = activeSlug ? posts.find((post) => post.slug === activeSlug) ?? null : null;
  const activeIndex = activePost ? posts.findIndex((post) => post.slug === activePost.slug) : -1;
  const previousPost = activeIndex > 0 ? posts[activeIndex - 1] : null;
  const nextPost = activeIndex >= 0 && activeIndex < posts.length - 1 ? posts[activeIndex + 1] : null;

  const setActive = useCallback((slug: string | null) => {
    activeSlugRef.current = slug;
    setActiveSlug(slug);
  }, []);

  const setReadingPersist = useCallback((next: Reading) => {
    readingRef.current = next;
    setReading(next);
    try {
      localStorage.setItem(READING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Reading controls remain functional when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(READING_STORAGE_KEY) ?? '{}') as Partial<Reading>;
      setReadingPersist({
        size: typeof saved.size === 'number' ? clampReadingSize(saved.size) : DEFAULT_READING.size,
        bold: saved.bold === true,
        italic: saved.italic === true,
      });
    } catch {
      // Ignore old or malformed preferences.
    }
  }, [setReadingPersist]);

  const updateReading = (change: Partial<Reading>) => {
    setReadingPersist({ ...readingRef.current, ...change });
  };

  const prefetchPost = useCallback((slug: string | undefined) => {
    if (!slug) return;
    void getPostContent(slug).catch(() => undefined);
  }, []);

  const updateReadingProgress = useCallback(() => {
    const body = modalBodyRef.current;
    const progress = progressRef.current;
    if (!body || !progress) return;
    if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current);
    progressFrameRef.current = requestAnimationFrame(() => {
      const scrollable = body.scrollHeight - body.clientHeight;
      const ratio = scrollable > 0 ? Math.min(1, body.scrollTop / scrollable) : 1;
      progress.style.transform = `scaleX(${ratio})`;
      progressFrameRef.current = null;
    });
  }, []);

  const openPost = useCallback(
    (slug: string, opener?: HTMLAnchorElement | null, replaceHistory = false) => {
      if (!dialogRef.current?.showModal) return false;
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      dialogRef.current.classList.remove('is-closing');
      requestIdRef.current += 1;
      setModalHtml('');
      setModalContentState('idle');
      if (opener) openerRef.current = opener;
      const nextUrl = `/bai/${encodeURIComponent(slug)}/`;
      try {
        const state = { ...(window.history.state ?? {}), lcModal: true, lcSlug: slug };
        if (replaceHistory || activeSlugRef.current) {
          window.history.replaceState(state, '', nextUrl);
        } else {
          window.history.pushState(state, '', nextUrl);
        }
      } catch {
        // The dialog still works if History API is unavailable.
      }
      setActive(slug);
      return true;
    },
    [setActive],
  );

  const finishClose = useCallback(
    (fromHistory = false) => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      dialogRef.current?.classList.remove('is-closing');
      if (!fromHistory && (window.history.state as { lcModal?: boolean } | null)?.lcModal) {
        window.history.back();
      } else {
        setActive(null);
      }
    },
    [setActive],
  );

  const closePost = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.classList.contains('is-closing')) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      finishClose();
      return;
    }
    dialog.classList.add('is-closing');
    closeTimerRef.current = window.setTimeout(() => finishClose(), MODAL_CLOSE_DURATION);
  }, [finishClose]);

  useEffect(() => {
    if (!activeSlug) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePost();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activeSlug, closePost]);

  useEffect(() => {
    const syncModalFromHistory = () => {
      const state = window.history.state as { lcModal?: boolean; lcSlug?: string } | null;
      const match = window.location.pathname.match(/^\/bai\/([^/]+)\/?$/);
      if (state?.lcModal && match) {
        const slug = decodeURIComponent(match[1]);
        if (posts.some((post) => post.slug === slug)) {
          setActive(slug);
          return;
        }
      }
      finishClose(true);
    };
    window.addEventListener('popstate', syncModalFromHistory);
    return () => window.removeEventListener('popstate', syncModalFromHistory);
  }, [finishClose, posts, setActive]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!activePost) {
      if (dialog?.open) dialog.close();
      document.body.classList.remove('lc-dialog-open');
      requestAnimationFrame(() => openerRef.current?.focus());
      return;
    }

    if (dialog && !dialog.open) dialog.showModal();
    document.body.classList.add('lc-dialog-open');
    dialog?.classList.remove('is-closing');
    requestAnimationFrame(() => modalTitleRef.current?.focus({ preventScroll: true }));
    modalBodyRef.current?.scrollTo({ top: 0 });
    if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';
    setModalHtml('');
    setModalContentState('idle');
    const requestId = ++requestIdRef.current;

    getPostContent(activePost.slug)
      .then((html) => {
        if (requestId !== requestIdRef.current || activeSlugRef.current !== activePost.slug) return;
        setModalHtml(html);
        setModalContentState('ready');
        requestAnimationFrame(() => {
          modalTitleRef.current?.focus({ preventScroll: true });
          updateReadingProgress();
        });
        const adjacent = [previousPost?.slug, nextPost?.slug].filter(Boolean) as string[];
        const warmAdjacent = () => adjacent.forEach(prefetchPost);
        window.setTimeout(warmAdjacent, 250);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current || activeSlugRef.current !== activePost.slug) return;
        setModalContentState('error');
        requestAnimationFrame(() => modalTitleRef.current?.focus({ preventScroll: true }));
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    activePost,
    modalReloadKey,
    nextPost?.slug,
    prefetchPost,
    previousPost?.slug,
    updateReadingProgress,
  ]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current);
      document.body.classList.remove('lc-dialog-open');
    },
    [],
  );

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
        <div className="lc-tabs-inner" role="tablist" aria-label="Chọn nội dung" data-active={tab}>
          {tabBtn('nhatky', 'Nhật Ký')}
          {tabBtn('gioithieu', 'Giới Thiệu')}
          {tabBtn('hopthu', 'Hộp Thư')}
        </div>
      </nav>

      {tab === 'nhatky' && (
        <section
          id="lc-panel-nhatky"
          className="lc-section lc-tab-panel"
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
              <a
                key={post.slug}
                className="lc-card"
                href={`/bai/${post.slug}/`}
                aria-haspopup="dialog"
                aria-controls="lc-reading-dialog"
                onPointerEnter={() => prefetchPost(post.slug)}
                onPointerDown={() => prefetchPost(post.slug)}
                onFocus={() => prefetchPost(post.slug)}
                onClick={(event) => {
                  if (!isPlainLeftClick(event)) return;
                  if (openPost(post.slug, event.currentTarget)) event.preventDefault();
                }}
              >
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
          className="lc-section lc-tab-panel"
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
          className="lc-ht-wrap lc-tab-panel"
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

      <dialog
        ref={dialogRef}
        id="lc-reading-dialog"
        className="lc-reading-dialog"
        aria-labelledby="lc-modal-title"
        aria-describedby="lc-modal-meta"
        onCancel={(event) => {
          event.preventDefault();
          closePost();
        }}
        onClose={() => {
          if (activeSlugRef.current) finishClose();
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) closePost();
        }}
      >
        <article className="lc-modal" aria-label={activePost?.title}>
          <div className="lc-modal-handle" aria-hidden="true" />
          <div className="lc-modal-bar" aria-hidden="true" />
          <div className="lc-modal-progress-track" aria-hidden="true">
            <div ref={progressRef} className="lc-modal-progress" />
          </div>

          <header className="lc-modal-head">
            <div className="lc-modal-meta-row">
              <div id="lc-modal-meta" className="lc-modal-meta">
                {activePost && <span className="lc-tag">{activePost.tag}</span>}
                {activePost && (
                  <span className="lc-modal-date">
                    {activePost.date} · {activePost.mins}
                  </span>
                )}
              </div>
              <button type="button" className="lc-close" onClick={closePost} aria-label="Đóng bài viết">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <h2 ref={modalTitleRef} id="lc-modal-title" className="lc-modal-title" tabIndex={-1}>
              {activePost?.title ?? 'Bài viết'}
            </h2>

            <div className="lc-modal-reader" role="toolbar" aria-label="Tùy chỉnh cách đọc">
              <span className="lc-modal-reader-label">Cỡ chữ</span>
              <button
                type="button"
                className="lc-ctl"
                onClick={() => updateReading({ size: clampReadingSize(readingRef.current.size - 1) })}
                disabled={reading.size <= READING_MIN}
                aria-label="A−, giảm cỡ chữ"
              >
                A−
              </button>
              <output className="lc-modal-reader-size" aria-live="polite">
                {reading.size}px
              </output>
              <button
                type="button"
                className="lc-ctl lc-ctl--plus"
                onClick={() => updateReading({ size: clampReadingSize(readingRef.current.size + 1) })}
                disabled={reading.size >= READING_MAX}
                aria-label="A+, tăng cỡ chữ"
              >
                A+
              </button>
              <button
                type="button"
                className={`lc-ctl-toggle${reading.bold ? ' is-active' : ''}`}
                onClick={() => updateReading({ bold: !readingRef.current.bold })}
                aria-pressed={reading.bold}
              >
                Đậm
              </button>
              <button
                type="button"
                className={`lc-ctl-toggle lc-ctl-toggle--italic${reading.italic ? ' is-active' : ''}`}
                onClick={() => updateReading({ italic: !readingRef.current.italic })}
                aria-pressed={reading.italic}
              >
                Nghiêng
              </button>
            </div>
          </header>

          <div ref={modalBodyRef} className="lc-modal-body" onScroll={updateReadingProgress}>
            {modalContentState === 'idle' && (
              <div className="lc-modal-loading" role="status" aria-live="polite">
                <span>Đang mở bài viết…</span>
                <div className="lc-modal-skeleton" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}

            {modalContentState === 'error' && activePost && (
              <div className="lc-modal-error" role="alert">
                <div aria-hidden="true">🌿</div>
                <h3>Chưa tải được bài viết</h3>
                <p>Bạn thử lại một lần nữa hoặc mở trang bài viết đầy đủ nhé.</p>
                <div className="lc-modal-error-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModalContentState('idle');
                      setModalReloadKey((value) => value + 1);
                    }}
                  >
                    Thử lại
                  </button>
                  <a href={`/bai/${activePost.slug}/`}>Mở trang bài viết</a>
                </div>
              </div>
            )}

            {modalContentState === 'ready' && (
              <div
                className={`lc-modal-reading lc-article-content${reading.bold ? ' is-bold' : ''}${
                  reading.italic ? ' is-italic' : ''
                }`}
                style={{ fontSize: `${reading.size}px` }}
                dangerouslySetInnerHTML={{ __html: modalHtml }}
              />
            )}
          </div>

          <footer className="lc-modal-foot">
            <div className="lc-modal-nav" aria-label="Chuyển bài viết">
              {previousPost ? (
                <a
                  href={`/bai/${previousPost.slug}/`}
                  onPointerEnter={() => prefetchPost(previousPost.slug)}
                  onFocus={() => prefetchPost(previousPost.slug)}
                  onClick={(event) => {
                    if (!isPlainLeftClick(event)) return;
                    if (openPost(previousPost.slug, null, true)) event.preventDefault();
                  }}
                >
                  <span aria-hidden="true">←</span> Bài trước
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="lc-modal-count" aria-label={`Bài ${activeIndex + 1} trên ${posts.length}`}>
                {activeIndex + 1}/{posts.length}
              </span>
              {nextPost ? (
                <a
                  href={`/bai/${nextPost.slug}/`}
                  onPointerEnter={() => prefetchPost(nextPost.slug)}
                  onFocus={() => prefetchPost(nextPost.slug)}
                  onClick={(event) => {
                    if (!isPlainLeftClick(event)) return;
                    if (openPost(nextPost.slug, null, true)) event.preventDefault();
                  }}
                >
                  Bài tiếp <span aria-hidden="true">→</span>
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
            <button type="button" className="lc-modal-foot-btn" onClick={closePost}>
              Đóng lại
            </button>
          </footer>
        </article>
      </dialog>
    </>
  );
}
