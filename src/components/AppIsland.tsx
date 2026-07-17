import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { PostView } from '../lib/posts';

type Tab = 'nhatky' | 'gioithieu' | 'hopthu';

type Reading = { size: number; bold: boolean; italic: boolean };

const STORAGE_KEY = 'lc-reading';
const READING_MIN = 13;
const READING_MAX = 24;
const DEFAULT_READING: Reading = { size: 15.5, bold: false, italic: false };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clampSize = (n: number) => Math.min(READING_MAX, Math.max(READING_MIN, n));

interface Props {
  posts: PostView[];
  initialSlug?: string | null;
}

export default function AppIsland({ posts, initialSlug = null }: Props) {
  const [tab, setTab] = useState<Tab>('nhatky');

  // --- Modal state (mirrored in a ref so window listeners never read stale values) ---
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);
  const activeSlugRef = useRef<string | null>(initialSlug);
  const setActive = useCallback((slug: string | null) => {
    activeSlugRef.current = slug;
    setActiveSlug(slug);
  }, []);
  const activePost = activeSlug ? posts.find((p) => p.slug === activeSlug) ?? null : null;

  // --- Reading preferences (persisted to localStorage) ---
  const [reading, setReading] = useState<Reading>(DEFAULT_READING);
  const readingRef = useRef<Reading>(DEFAULT_READING);
  const setReadingPersist = useCallback((next: Reading) => {
    readingRef.current = next;
    setReading(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Reading>;
      const next: Reading = {
        size: typeof saved.size === 'number' ? clampSize(saved.size) : DEFAULT_READING.size,
        bold: !!saved.bold,
        italic: !!saved.italic,
      };
      readingRef.current = next;
      setReading(next);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const decSize = () =>
    setReadingPersist({ ...readingRef.current, size: clampSize(readingRef.current.size - 1) });
  const incSize = () =>
    setReadingPersist({ ...readingRef.current, size: clampSize(readingRef.current.size + 1) });
  const toggleBold = () =>
    setReadingPersist({ ...readingRef.current, bold: !readingRef.current.bold });
  const toggleItalic = () =>
    setReadingPersist({ ...readingRef.current, italic: !readingRef.current.italic });

  // --- Open / close with deep-link URL sync ---
  const openPost = useCallback(
    (slug: string) => {
      setActive(slug);
      try {
        window.history.pushState({ lcModal: slug }, '', `/bai/${slug}`);
      } catch {
        /* history unavailable — modal still opens */
      }
    },
    [setActive],
  );

  const closePost = useCallback(() => {
    if (activeSlugRef.current == null) return;
    const state = window.history.state as { lcModal?: string } | null;
    if (state && state.lcModal) {
      window.history.back(); // popstate handler clears the modal
    } else {
      setActive(null);
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        /* noop */
      }
    }
  }, [setActive]);

  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/bai\/([^/]+)\/?$/);
      setActive(m ? decodeURIComponent(m[1]) : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setActive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePost();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closePost]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (activeSlug == null) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeSlug]);

  // --- Hộp Thư form ---
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [msg, setMsg] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [sent, setSent] = useState(false);

  const mailInvalid = mail.trim() !== '' && !EMAIL_RE.test(mail.trim());
  const canSend = name.trim() !== '' && msg.trim() !== '' && !mailInvalid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    if (hp.trim() !== '') {
      // Bot filled the hidden field — pretend success, don't process.
      setSent(true);
      return;
    }
    // TODO: POST { name, mail, msg } to the private inbox endpoint (backend later).
    setSent(true);
  };

  const resetForm = () => {
    setSent(false);
    setName('');
    setMail('');
    setMsg('');
    setHp('');
  };

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      className={`lc-tab${tab === key ? ' is-active' : ''}`}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="lc-tabs">
        <div className="lc-tabs-inner">
          {tabBtn('nhatky', 'Nhật Ký')}
          {tabBtn('gioithieu', 'Giới Thiệu')}
          {tabBtn('hopthu', 'Hộp Thư')}
        </div>
      </div>

      {tab === 'nhatky' && (
        <div className="lc-section">
          <div className="lc-nk-head">
            <div>
              <h2 className="lc-h2">
                <span>📖</span>
                <span>Nhật Ký Linhchiaura</span>
              </h2>
              <p className="lc-sub">Nơi lắng đọng những dòng suy ngẫm mộc mạc và chân thành.</p>
            </div>
            <button type="button" className="lc-newpost">
              <span>+</span>
              <span>Viết bài mới</span>
            </button>
          </div>
          <div className="lc-grid">
            {posts.map((p) => (
              <button
                key={p.slug}
                type="button"
                className="lc-card"
                onClick={() => openPost(p.slug)}
              >
                <div className="lc-card-top">
                  <span className="lc-tag">{p.tag}</span>
                  <span className="lc-mins">{p.mins}</span>
                </div>
                <div className="lc-card-title">{p.title}</div>
                <div className="lc-card-excerpt">{p.excerpt}</div>
                <div className="lc-card-more">Đọc tiếp →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'gioithieu' && (
        <div className="lc-section">
          <div className="lc-about-grid">
            <div className="lc-about-card">
              <div className="lc-blob lc-blob--green" />
              <div className="lc-about-icon lc-about-icon--heart">
                <Heart size={18} strokeWidth={2} />
              </div>
              <h3 className="lc-about-title">Sở thích &amp; Đam mê</h3>
              <p className="lc-about-desc">
                Chạy bộ &amp; leo núi, năng động, Sáng tạo nội dung số, Tâm lý học, Du lịch khám phá
                &amp; Thiện nguyện.
              </p>
            </div>
            <div className="lc-about-card">
              <div className="lc-blob lc-blob--orange" />
              <div className="lc-about-icon lc-about-icon--spark">
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <h3 className="lc-about-title">Phong cách sống</h3>
              <p className="lc-about-desc">
                Năng động, Hiện đại, Độc lập, Tinh tế và luôn tràn đầy tiếng cười, kết hợp sự mềm mại
                nữ tính với tinh thần tự tin bứt phá.
              </p>
            </div>
            <div className="lc-about-card">
              <div className="lc-blob lc-blob--green" />
              <div className="lc-about-icon lc-about-icon--quote">❞</div>
              <h3 className="lc-about-title">Triết lý sống</h3>
              <p className="lc-about-desc lc-about-desc--italic">
                Sống rực rỡ và tỏa sáng theo cách riêng của bạn. Bằng tri thức - sự bình an - và tử
                tế!
              </p>
            </div>
          </div>
          <div className="lc-banner">
            <div className="lc-banner-mark">“</div>
            <p className="lc-banner-quote">
              "Aut inveniam viam aut faciam – Hoặc tôi sẽ tìm thấy một con đường, hoặc tôi sẽ tự tạo
              con đường cho chính tôi"
            </p>
          </div>
        </div>
      )}

      {tab === 'hopthu' && (
        <div className="lc-ht-wrap">
          <div className="lc-ht-col">
            <div className="lc-ht-head">
              <h2 className="lc-h2 lc-h2--center">
                <span>🕊</span>
                <span>Gửi Lời Nhắn Cho Mình</span>
              </h2>
              <p className="lc-ht-sub">
                Một câu tâm sự, một câu hỏi, hay chỉ đơn giản là lời chào dịu ngọt. Thư gửi riêng cho
                mình thôi — không hiển thị công khai, và mình sẽ hồi âm sớm nhất có thể 🤍
              </p>
            </div>
            <div className="lc-form-card">
              {sent ? (
                <div className="lc-thanks">
                  <div className="lc-thanks-emoji">💌</div>
                  <h3 className="lc-thanks-title">Đã gửi đi yêu thương!</h3>
                  <p className="lc-thanks-text">
                    Cảm ơn bạn đã để lại đôi dòng dịu dàng. Mình sẽ đọc và hồi âm sớm nhất có thể 🤍
                  </p>
                  <button type="button" className="lc-thanks-btn" onClick={resetForm}>
                    Viết thêm lời nhắn
                  </button>
                </div>
              ) : (
                <form className="lc-form" onSubmit={handleSubmit} noValidate>
                  <div>
                    <div className="lc-label">Tên của bạn *</div>
                    <input
                      className="lc-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nhập tên đáng yêu của bạn..."
                    />
                  </div>
                  <div>
                    <div className="lc-label">Gmail (không bắt buộc)</div>
                    <input
                      className="lc-input"
                      type="email"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                      placeholder="ban@gmail.com — nếu muốn nhận hồi âm nè"
                    />
                    {mailInvalid && (
                      <div className="lc-field-error">
                        Email chưa đúng định dạng, bạn kiểm tra lại nhé.
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="lc-label">Lời nhắn gửi *</div>
                    <textarea
                      className="lc-textarea"
                      rows={4}
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      placeholder="Hãy viết điều bạn đang nghĩ vào đây..."
                    />
                  </div>
                  <input
                    className="lc-hp"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    placeholder="Để trống ô này"
                  />
                  <button
                    type="submit"
                    className={`lc-send${canSend ? ' is-ready' : ''}`}
                    disabled={!canSend}
                  >
                    🕊 GỬI ĐI YÊU THƯƠNG
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {activePost && (
        <div
          className="lc-overlay"
          onClick={closePost}
          role="dialog"
          aria-modal="true"
          aria-label={activePost.title}
        >
          <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lc-modal-bar" />
            <div className="lc-modal-head">
              <div className="lc-modal-meta">
                <span className="lc-tag">{activePost.tag}</span>
                <span className="lc-modal-date">
                  {activePost.date} · {activePost.mins}
                </span>
                <div className="lc-ctl-group">
                  <button type="button" className="lc-ctl" onClick={decSize} aria-label="Giảm cỡ chữ">
                    A−
                  </button>
                  <button
                    type="button"
                    className="lc-ctl lc-ctl--plus"
                    onClick={incSize}
                    aria-label="Tăng cỡ chữ"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    className={`lc-ctl-toggle${reading.bold ? ' is-active' : ''}`}
                    onClick={toggleBold}
                    aria-pressed={reading.bold}
                  >
                    Đậm
                  </button>
                  <button
                    type="button"
                    className={`lc-ctl-toggle lc-ctl-toggle--italic${
                      reading.italic ? ' is-active' : ''
                    }`}
                    onClick={toggleItalic}
                    aria-pressed={reading.italic}
                  >
                    Nghiêng
                  </button>
                  <button type="button" className="lc-close" onClick={closePost} aria-label="Đóng">
                    ×
                  </button>
                </div>
              </div>
              <h1 className="lc-modal-title">{activePost.title}</h1>
            </div>
            <div className="lc-modal-body">
              <div
                className="lc-modal-body-inner"
                style={{
                  fontSize: `${reading.size}px`,
                  fontWeight: reading.bold ? 600 : 400,
                  fontStyle: reading.italic ? 'italic' : 'normal',
                }}
              >
                {activePost.paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
            <div className="lc-modal-foot">
              <span className="lc-modal-foot-note">Cảm ơn bạn đã ghé đọc trang nhật ký!</span>
              <button type="button" className="lc-modal-foot-btn" onClick={closePost}>
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
