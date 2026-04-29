(function (global) {
  function mergeConfig(base, override) {
    const merged = Object.assign({}, base);

    if (!override || typeof override !== 'object') {
      return merged;
    }

    Object.keys(override).forEach(function (key) {
      const baseValue = base[key];
      const overrideValue = override[key];

      if (
        baseValue &&
        overrideValue &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue) &&
        typeof overrideValue === 'object' &&
        !Array.isArray(overrideValue)
      ) {
        merged[key] = mergeConfig(baseValue, overrideValue);
      } else {
        merged[key] = overrideValue;
      }
    });

    return merged;
  }

  const defaultConfig = {
    navigation: {
      scrollTargetId: 'invitationContent',
      scrollBehavior: 'smooth',
      scrollBlock: 'start'
    },
    firefly: {
      maxCount: 50,
      spawnPerFrame: 3,
      sizeMin: 0.5,
      sizeRange: 1.0,
      speedScale: 0.3,
      opacityMin: 0.1,
      opacityMax: 0.7,
      fadeSpeedMin: 0.002,
      fadeSpeedRange: 0.003,
      angleJitterDeg: 2.5,
      maxDevicePixelRatio: 2
    },
    animation: {
      starts: {
        wedding: 0.0,
        date: 0.0,
        korean: 0.0,
        venue: 0.0,
        nameRow: 0.0,
        groom: 0.8,
        ampersand: 0.8,
        bride: 0.8,
        arrow: 3.0
      },
      nameRowAnim: {
        fadeDuration: 1.2,
        fadeEase: 'power2.out'
      },
      // ── Per-character hero text animation ─────────────────────────
      // Controls how letters in `THE WEDDING OF`, the date, the Korean
      // names, and the venue line "fall into place". Tweak here to
      // change the *feel* of the intro without touching JS.
      //
      //   yRange:               px each letter can drift from before
      //                         settling. Lower = subtler / more
      //                         elegant. (was hardcoded 100)
      //   duration:             seconds for each letter's flight.
      //                         Higher = more graceful. (was 1.75)
      //   ease:                 GSAP ease curve. 'power4.inOut' is
      //                         dramatic; 'power2.out' / 'sine.out'
      //                         read as more refined.
      //   staggerEach:          delay (s) between consecutive letters.
      //                         Tiny = letters arrive together;
      //                         ~0.04 = graceful wave.
      //   staggerFrom:          'start' | 'center' | 'end' | 'edges'.
      //   rotationX:            initial 3D tilt (deg). 0 = pure
      //                         vertical drift, no theatrical fall.
      //   transformPerspective: GSAP 3D perspective (px). Larger =
      //                         flatter / more subtle.
      //   transformOrigin:      where the 3D rotation pivots from.
      //
      // `perLine` overrides any subset of the above for a specific
      // hero line (keyed by element id in index.html).
      charAnim: {
        yRange: 10,
        duration: 1.75,
        ease: 'power4.inOut',
        staggerEach: 0.01,
        staggerFrom: 'center',
        rotationX: 20,
        transformPerspective: 600,
        transformOrigin: '50% 50% -50px',
        perLine: {
          theWedding:   {},
          weddingDate:  { duration: 1.5 },
          koreanNames:  {},
          weddingVenue: {}
        }
      },
      postIntro: {
        start: 2.0,
        duration: 4.0,
        hideTitleGroup: true,
        titleYOffset: -24
      },
      overlay: {
        before: { y0: 0.8, y35: 0.8, y60: 0.8, y100: 0.8 },
        after: { y0: 0.0, y35: 0.0, y60: 0.30, y100: 0.8 }
      }
    },
    letter: {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.12,
      charStaggerMs: 55,
      messageStaggerMs: 160,
      familyStaggerMs: 180,
      photoParallaxStrength: 24
    },
    calendar: {
      weddingDate: '2026-07-12T12:00:00+09:00',
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.15,
      countdownUpdateMs: 1000
    },
    gallery: {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.12,
      // Pixels per ~16ms frame for the polaroid filmstrip auto-marquee.
      // Set to 0 to disable auto scrolling entirely.
      filmstripAutoScrollSpeed: 0.35,
      // Pixel offset applied to the featured photo as it scrolls through
      // the viewport (gentle ken-burns parallax).
      parallaxStrength: 18,
      // ── Filmstrip drag / fling response ────────────────────────────
      // Window (ms) used to compute release velocity. Smaller = snappier
      // response to a real flick; the default captures the gesture's
      // final ~80ms which corresponds to the user's actual finger speed
      // at lift-off (avoids the "starts too late" feel).
      filmstripFlingWindowMs: 80,
      // Friction applied per ~16ms frame after release. Lower = glides
      // farther (more film-like). Range: 0.85 (sticky) – 0.97 (very long).
      filmstripFriction: 0.945,
      // How long (ms) the auto-marquee stays paused after the last user
      // interaction. Used to be 2200ms which felt sluggish; 700ms feels
      // alive without fighting the user.
      filmstripResumeDelayMs: 700,
      // Maximum tilt (deg) randomly applied to each polaroid so adding
      // photos doesn't require manually tuning style="--polaroid-tilt".
      filmstripTiltMaxDeg: 2.6,
      // Maximum tape-piece rotation (deg).
      filmstripTapeMaxDeg: 5
    },
    // ── Section 05 · Location ────────────────────────────────────────
    // Single source of truth for the venue identity that powers the
    // editorial address header, the sketch-map card, every external
    // map deep-link, and the copy-address toast. All strings here are
    // user-facing — change once, and every label + share URL stays in
    // sync.
    location: {
      // Scroll-reveal tuning (matches the gallery / calendar feel).
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.12,
      // ── Venue identity ────────────────────────────────────────────
      venue: {
        // English display name + the script title used as the map
        // share-URL `place` parameter (kakao / naver / tmap all accept
        // UTF-8 — Korean works equally well).
        name: 'Crest 72',
        // Korean script rendering of the venue name. Used in the
        // editorial header beneath the English wordmark.
        nameKor: '크레스트 72',
        hall: '글래스홀',
        // Both road-name and lot-number addresses are kept available;
        // the road-name one is what `주소 복사` writes to the clipboard.
        addressRoad: '서울특별시 중구 장충단로 72',
        addressLot:  '서울특별시 중구 장충동2가 201-6',
        landmark:    '한국자유총연맹 자유센터',
        tel:         '02-2232-7366',
        // Coordinates (WGS84) for 한국자유총연맹 / 자유센터 — used by
        // every `link/to` URL that pre-fills the route destination in
        // Kakao Map, Naver Map, and Tmap.
        lat: 37.5547,
        lng: 127.0048
      },
      // ── Kakao "RoughMap" embed (no API key required) ──────────────
      // Generated once via https://apis.map.kakao.com/web/sample/jsMapLink/
      // for the Crest 72 pin. Note: the loader script (roughmapLoader.js)
      // and its `Lander(...).render()` call must both be invoked during
      // *initial document parsing* — not after DOMContentLoaded — because
      // the loader uses `document.write` to inject its dependency chain.
      // index.html therefore references the loader synchronously inside
      // Section 5 (no defer/async) and immediately calls `.render()` from
      // an inline synchronous <script>. This config exists for the rest
      // of the codebase to read the same identifiers in one place.
      kakaoRoughmap: {
        timestamp: '1777298027750',
        key: 'mt9w6w4x9bt'
      },
      // ── Toast (after 주소 복사) ───────────────────────────────────
      copyToastMs: 2200
    },
    // ── Section 06 · Account (마음 전하실 곳) ───────────────────────
    // Single source of truth for the gift-account section. The two
    // sides (`groom` / `bride`) each carry an ordered list of family
    // members; each member declares the bank `code`, the displayed
    // bank name, the account number, and (optionally) a Kakao Pay
    // QR / send link. The renderer uses `code` to look up the brand
    // colour + initials in the `banks` registry below.
    //
    // Replace the placeholder account numbers with the real values
    // before deploying. Numbers are stored as plain strings so any
    // formatting (hyphens / spaces) the user keys in is preserved
    // verbatim in the rendered display AND in the clipboard payload.
    account: {
      // Scroll-reveal tuning — matches the letter / location feel.
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.14,
      // Reuses `#locationToast` for the "계좌번호가 복사되었습니다" pill
      // so we don't introduce a second toast surface on the page.
      copyToastMs: 2200,
      // Editorial copy shown above the two cards. The lines read as a
      // quiet apology/notice — appropriate gravitas for a section about
      // money. `soft` is intentionally empty so no smaller secondary
      // line is rendered beneath the main paragraph.
      intro: {
        eyebrow: 'WITH HEART',
        title: '마음 전하실 곳',
        lines: [
          '참석 못하시는 분들의 요청으로',
          '부득이하게 계좌번호 올려드림을',
          '널리 양해 부탁드립니다.'
        ],
        soft: ''
      },
      // Closing line below the two cards. Empty = no closing rendered.
      closing: '',
      // ── Bank registry ────────────────────────────────────────────
      // The renderer reads each member's `bank` code and looks up the
      // displayed `name` here. The `bg` / `ink` / `initials` fields
      // are no longer painted (the brand-coloured chip was removed
      // in favour of an editorial typographic layout), but they are
      // kept for forward compatibility in case a future variant
      // wants to reintroduce a brand mark.
      banks: {
        kb:        { name: 'KB국민은행',  bg: '#ffbc00', ink: '#2f2824', initials: 'KB' },
        shinhan:   { name: '신한은행',    bg: '#0046ff', ink: '#ffffff', initials: '신한' },
        woori:     { name: '우리은행',    bg: '#0067ac', ink: '#ffffff', initials: '우리' },
        hana:      { name: '하나은행',    bg: '#008c95', ink: '#ffffff', initials: '하나' },
        nonghyup:  { name: '농협은행',    bg: '#04aa6d', ink: '#ffffff', initials: 'NH' },
        ibk:       { name: 'IBK기업은행', bg: '#00a0e9', ink: '#ffffff', initials: 'IBK' },
        kakaobank: { name: '카카오뱅크',  bg: '#ffe600', ink: '#2c1e1e', initials: 'kakao' },
        toss:      { name: '토스뱅크',    bg: '#0064ff', ink: '#ffffff', initials: 'toss' },
        kbank:     { name: '케이뱅크',    bg: '#1c5cf3', ink: '#ffffff', initials: 'K' },
        sc:        { name: 'SC제일은행',  bg: '#0473ea', ink: '#ffffff', initials: 'SC' },
        post:      { name: '우체국',      bg: '#e7261d', ink: '#ffffff', initials: '우체' },
        saemaul:   { name: '새마을금고',  bg: '#005baa', ink: '#ffffff', initials: 'MG' },
        suhyup:    { name: '수협은행',    bg: '#005bac', ink: '#ffffff', initials: '수협' },
        citi:      { name: '한국씨티',    bg: '#003b71', ink: '#ffffff', initials: 'C'  }
      },
      // ── 신랑측 ───────────────────────────────────────────────────
      groom: {
        // Editorial label printed across the card head when collapsed.
        // The card head is a single typographic line (no coloured pill,
        // no second name) so this is the only string the head shows.
        // The colon is rendered tight against "곳" (no leading space)
        // and only breathes after, matching standard Korean typography.
        headLabel: '마음 전하실 곳: 신랑측',
        // Members are rendered top-down. Each row is fully self-
        // contained (no inheritance) so the user can mix banks across
        // the family without surprises.
        members: [
          {
            role: '신랑',
            name: '정성문',
            bank: 'kakaobank',
            number: '3333-00-0000000',
            // Optional Kakao Pay QR send-link. When present the row
            // shows a "송금" pill button next to "계좌번호 복사".
            kakaopay: ''
          },
          {
            role: '신랑측 아버님',
            name: '정인복',
            bank: 'nonghyup',
            number: '352-0000-0000-00',
            kakaopay: ''
          },
          {
            role: '신랑측 어머님',
            name: '전명자',
            bank: 'kb',
            number: '000000-00-000000',
            kakaopay: ''
          }
        ]
      },
      // ── 신부측 ───────────────────────────────────────────────────
      bride: {
        headLabel: '마음 전하실 곳: 신부측',
        members: [
          {
            role: '신부',
            name: '송나은',
            bank: 'toss',
            number: '1000-0000-0000',
            kakaopay: ''
          },
          {
            role: '신부측 아버님',
            name: '송점수',
            bank: 'shinhan',
            number: '110-000-000000',
            kakaopay: ''
          },
          {
            role: '신부측 어머님',
            name: '이혜경',
            bank: 'hana',
            number: '000-000000-00000',
            kakaopay: ''
          }
        ]
      }
    }
  };

  // Allow user override by defining window.WeddingConfig before this file.
  global.WeddingConfig = mergeConfig(defaultConfig, global.WeddingConfig);
})(window);
