'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

/* ═══════════════════════════════════════════════════════════════
   Reviews — Window Content

   Live scan counter (starting at 101), Chloé's fake review card
   with Scooby-Doo reveal, and a polished feedback form.
   ═══════════════════════════════════════════════════════════════ */

const REVIEW_LABELS = ['terrible', 'meh', 'decent', 'great', 'obsessed'] as const;

export default function CustomersWindow() {
  const { isAuthenticated } = useAuth();
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [revealed1, setRevealed1] = useState(false);
  const [revealed2, setRevealed2] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const counterRef = useRef<HTMLDivElement>(null);

  // Fetch real scan count + animate counter
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => {
        const target = (count ?? 0) + 101;
        // Animate from 0 to target
        let current = 0;
        const step = Math.ceil(target / 40);
        const interval = setInterval(() => {
          current = Math.min(current + step, target);
          setScanCount(current);
          if (current >= target) clearInterval(interval);
        }, 30);
      });
  }, []);

  const activeRating = hoverRating || rating;

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitted(true);
  };

  return (
    <>
      <style>{`
        @keyframes count-glow {
          0%, 100% { text-shadow: 0 0 8px oklch(0.75 0.2 340 / 0.4); }
          50% { text-shadow: 0 0 24px oklch(0.75 0.2 340 / 0.8), 0 0 48px oklch(0.75 0.2 340 / 0.3); }
        }
        .scan-counter { animation: count-glow 3s ease-in-out infinite; }

        @keyframes reveal-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-4px) rotate(-1.5deg); }
          20% { transform: translateX(4px) rotate(1.5deg); }
          30% { transform: translateX(-4px) rotate(-1.5deg); }
          40% { transform: translateX(4px) rotate(1.5deg); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          70% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
        }
        .reveal-shake { animation: reveal-shake 0.7s ease-in-out; }

        @keyframes star-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .star-pop { animation: star-pop 0.2s ease-out; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.4s ease-out; }

        .review-textarea:focus {
          box-shadow: 0 0 0 2px oklch(0.75 0.2 340 / 0.3);
        }
      `}</style>
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-6">
      {/* ── Live scan counter ── */}
      <div className="text-center space-y-gs-2">
        <div
          ref={counterRef}
          className="font-data text-[36px] font-bold text-gs-red scan-counter leading-none"
        >
          {scanCount !== null ? scanCount.toLocaleString() : '···'}
        </div>
        <div className="font-system text-os-xs text-gs-muted mt-gs-1 tracking-wide uppercase">
          reports generated and counting
        </div>
      </div>

      {/* ── Fake review #1 — Totally Real Marketing Professional ── */}
      <div
        className={`bevel-sunken p-gs-4 cursor-pointer transition-all duration-300 ${revealed1 ? 'reveal-shake' : 'hover:border-gs-red/30'}`}
        onClick={() => !revealed1 && setRevealed1(true)}
      >
        {!revealed1 ? (
          <div className="space-y-gs-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-gs-2">
                <div className="w-[28px] h-[28px] rounded-full bg-gs-red/15 border border-gs-red/40 flex items-center justify-center flex-shrink-0">
                  <span className="font-system text-[11px] font-bold text-gs-red">T</span>
                </div>
                <div>
                  <div className="font-system text-os-xs font-bold text-gs-light">
                    Totally Real Marketing Professional
                  </div>
                  <div className="font-data text-data-xs text-gs-muted">
                    VP of Digital Strategy
                  </div>
                </div>
              </div>
              <span className="font-data text-data-xs text-gs-mid/60 px-gs-1 py-[2px] border border-gs-mid/20 rounded text-[9px] uppercase tracking-wider">
                verified
              </span>
            </div>
            <div className="flex items-center gap-gs-2">
              <span className="text-gs-red text-[14px] tracking-[3px]">★★★★★</span>
              <span className="font-data text-data-xs text-gs-muted">2 days ago</span>
            </div>
            <p className="font-data text-data-sm text-gs-light/85 leading-relaxed">
              &ldquo;Honestly the best marketing tool I&apos;ve ever used. Changed my
              entire strategy overnight. The AI is scary smart and the report
              was more thorough than what my last agency delivered in 3 months.
              11/10 would recommend to literally everyone I know.&rdquo;
            </p>
            <div className="flex items-center justify-between pt-gs-1 border-t border-gs-mid/15">
              <span className="font-data text-data-xs text-gs-muted">
                47 people found this helpful
              </span>
              <span className="font-data text-data-xs text-gs-mid/40">
                click to inspect →
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-gs-3 py-gs-2">
            <p className="font-data text-data-xs text-gs-muted fade-up">
              wait...
            </p>
            <p className="font-data text-data-sm text-gs-light font-bold fade-up" style={{ animationDelay: '0.15s' }}>
              &ldquo;And I would have gotten away with it too,
              if it weren&apos;t for you meddling marketers!&rdquo;
            </p>
            <div className="fade-up" style={{ animationDelay: '0.3s' }}>
              <p className="font-data italic text-data-sm text-gs-red">
                — it was Chloé the whole time
              </p>
            </div>
            <div className="fade-up pt-gs-1" style={{ animationDelay: '0.5s' }}>
              <p className="font-data text-data-xs text-gs-muted">
                no real reviews yet. be the first one ↓
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Fake review #2 — Seth Grodin ── */}
      <div
        className={`bevel-sunken p-gs-4 cursor-pointer transition-all duration-300 ${revealed2 ? 'reveal-shake' : 'hover:border-gs-red/30'}`}
        onClick={() => !revealed2 && setRevealed2(true)}
      >
        {!revealed2 ? (
          <div className="space-y-gs-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-gs-2">
                <div className="w-[28px] h-[28px] rounded-full bg-gs-red/15 border border-gs-red/40 flex items-center justify-center flex-shrink-0">
                  <span className="font-system text-[11px] font-bold text-gs-red">S</span>
                </div>
                <div>
                  <div className="font-system text-os-xs font-bold text-gs-light">
                    Seth Grodin
                  </div>
                  <div className="font-data text-data-xs text-gs-muted">
                    Best-Selling Author & Speaker
                  </div>
                </div>
              </div>
              <span className="font-data text-data-xs text-gs-mid/60 px-gs-1 py-[2px] border border-gs-mid/20 rounded text-[9px] uppercase tracking-wider">
                verified
              </span>
            </div>
            <div className="flex items-center gap-gs-2">
              <span className="text-gs-red text-[14px] tracking-[3px]">★★★★★</span>
              <span className="font-data text-data-xs text-gs-muted">5 days ago</span>
            </div>
            <p className="font-data text-data-sm text-gs-light/85 leading-relaxed">
              &ldquo;Marketing is no longer about the stuff you make, but about
              the stories you tell. This tool tells you the story your website
              is telling without your permission. Remarkable.&rdquo;
            </p>
            <div className="flex items-center justify-between pt-gs-1 border-t border-gs-mid/15">
              <span className="font-data text-data-xs text-gs-muted">
                112 people found this helpful
              </span>
              <span className="font-data text-data-xs text-gs-mid/40">
                click to inspect →
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-gs-3 py-gs-2">
            <p className="font-data text-data-xs text-gs-muted fade-up">
              lol got you again
            </p>
            <p className="font-data text-data-sm text-gs-light font-bold fade-up" style={{ animationDelay: '0.15s' }}>
              you&apos;re out here reading reviews, turning every rock,
              investigating every link — but you still haven&apos;t scanned
              your own website?
            </p>
            <div className="fade-up" style={{ animationDelay: '0.3s' }}>
              <p className="font-data italic text-data-sm text-gs-red">
                — also Chloé. go scan your site already.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Feedback form — logged in users only ── */}
      {isAuthenticated ? (
        <div className="bevel-sunken p-gs-4 space-y-gs-3">
          <div className="flex items-center justify-between">
            <h2 className="font-system text-os-sm font-bold text-gs-light">
              Leave a Review
            </h2>
            {!submitted && (
              <span className="font-data text-data-xs text-gs-muted">
                {rating > 0 ? REVIEW_LABELS[rating - 1] : 'tap a star'}
              </span>
            )}
          </div>

          {submitted ? (
            <div className="text-center space-y-gs-2 py-gs-3 fade-up">
              <div className="font-data text-[28px] text-gs-red">★</div>
              <p className="font-data text-data-sm text-gs-red font-bold">
                ty so much
              </p>
              <p className="font-data text-data-xs text-gs-muted">
                your feedback means everything to us.
                <br />we read every single one.
              </p>
            </div>
          ) : (
            <div className="space-y-gs-3">
              {/* Star rating — big, interactive */}
              <div className="flex items-center justify-center gap-gs-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    className={`text-[28px] transition-all duration-150 cursor-pointer ${
                      i <= activeRating
                        ? 'text-gs-red drop-shadow-[0_0_6px_oklch(0.75_0.2_340_/_0.5)]'
                        : 'text-gs-mid/30 hover:text-gs-mid/50'
                    } ${rating === i ? 'star-pop' : ''}`}
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(i)}
                  >
                    ★
                  </button>
                ))}
              </div>

              {/* Text feedback */}
              <div className="relative">
                <textarea
                  value={feedback}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setFeedback(e.target.value);
                      setCharCount(e.target.value.length);
                    }
                  }}
                  placeholder="what did you love? what could be better? don't hold back..."
                  className="w-full h-[88px] bg-gs-light/90 text-gs-void font-data text-data-sm rounded-[7px] border border-gs-mid/30 px-gs-3 py-gs-2 resize-none select-text placeholder:text-gs-mid/50 focus:outline-none focus:border-gs-red/50 review-textarea"
                  style={{ color: 'var(--gs-void)', caretColor: 'currentColor' }}
                />
                <span className="absolute bottom-[6px] right-[8px] font-data text-[10px] text-gs-mid/40">
                  {charCount}/500
                </span>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={rating === 0}
                className="bevel-button-primary w-full py-gs-2 font-system text-os-sm font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {rating === 0 ? 'Pick a rating to submit' : 'Send Review'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
    </>
  );
}
