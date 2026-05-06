// assets/data/photos.js
// ════════════════════════════════════════════════════════════════════
//   ★  사진(Photos) 통합 관리 파일  ★
//   ──────────────────────────────────────────────────────────────────
//   이 파일 한 곳에서만 수정하면 갤러리, 라이트박스, 필름 스트립의
//   사진/설명이 모두 자동으로 갱신됩니다.
//
//   1.  새 사진을 추가하려면:
//        ① assets/img/ 폴더에 파일을 복사합니다 (.webp 권장).
//        ② 아래 `registry`에  '파일명': '한 줄 설명'  을 추가합니다.
//        ③ 필요하면 `layout` 영역에서 어느 자리(featured / mosaic /
//           filmstrip)에 보여줄지 지정합니다. (filmstrip은 'auto'면
//           registry의 모든 사진을 자동 포함합니다.)
//
//   2.  사진을 빼고 싶으면:
//        해당 줄을 `registry`에서 지우거나, layout에서만 빼면 됩니다.
//
//   3.  설명을 바꾸려면:
//        registry의 값(작은따옴표 안의 글)만 고치면 됩니다.
//        그 사진이 나타나는 모든 곳(필름 스트립 캡션, 라이트박스
//        설명, 사진을 클릭했을 때 등)에 즉시 반영됩니다.
//
//   ※  파일을 수정한 뒤에는 `npm run version-assets` 를 한 번
//      실행해 주세요. (브라우저 캐시 문제 방지)
// ════════════════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  /* ── 1) 사진 등록부 (filename → 설명) ────────────────────────────
     같은 파일명이 갤러리 어느 자리에 등장하더라도 여기 적힌
     설명을 그대로 사용합니다.  (캡션 / 클릭한 사진 / 라이트박스 /
     이미지 alt 등 모두 동일)

     설명은 한국어/영어 어느 쪽이든 자유롭게 적어 주세요.            */

  var registry = {
    'IMG_0003-0.webp': '우리의 시작',
    'IMG_0140-0.webp': '우리의 시작',
    'IMG_0626-0.webp': '우리의 시작',
    'IMG_0952-0.webp': '우리의 시작',
    'IMG_1228-0.webp': '우리의 시작',
    'IMG_1607-0.webp': '우리의 시작',
    'IMG_2169-0.webp': '영원의 약속'
  };


  /* ── 2) 사진 폴더 경로 ───────────────────────────────────────── */

  var imageBase = './assets/img/';


  /* ── 3) 갤러리 레이아웃 ───────────────────────────────────────
     아래 항목에서 사용하는 파일명은 모두 `registry`에 등록되어
     있어야 합니다.                                                */

  var layout = {

    /*  메인 상단(히어로) 사진  */
    hero: 'IMG_0003-0.webp',

    /*  갤러리 섹션 맨 위의 시네마틱 사진  */
    featured: 'IMG_0626-0.webp',

    /*  중간 모자이크 — 3개의 그룹으로 자유 구성              
        layout: 'duo'  → 세로 사진 2장
        layout: 'mixed' → 큰 세로 1장 + 작은 가로 2장
        layout: 'trio' → 정방형 3장                              */
    mosaics: [
      { layout: 'duo',   photos: ['IMG_0952-0.webp', 'IMG_1228-0.webp'] },
      { layout: 'mixed', photos: ['IMG_2169-0.webp', 'IMG_1607-0.webp', 'IMG_0140-0.webp'] },
      { layout: 'trio',  photos: ['IMG_0003-0.webp', 'IMG_0003-0.webp', 'IMG_0003-0.webp'] }
    ],

    /*  하단 폴라로이드 필름 스트립
        - 'auto'           : registry에 등록된 모든 사진을 사용
        - ['IMG_x.webp', …] : 원하는 순서대로 직접 지정
        - { exclude: [...] }: 'auto'이되 일부만 제외                */
    filmstrip: 'auto'
  };


  /* ── 공개 API ────────────────────────────────────────────────── */

  global.WeddingPhotos = {
    registry:  registry,
    imageBase: imageBase,
    layout:    layout,

    /*  파일명을 받아 캡션을 반환. 없는 파일은 빈 문자열을 돌려줍니다. */
    captionFor: function (file) {
      return Object.prototype.hasOwnProperty.call(registry, file)
        ? registry[file]
        : '';
    },

    /*  파일명 → 전체 경로  */
    pathFor: function (file) {
      return imageBase + file;
    },

    /*  registry에 등록된 모든 파일명을 등록 순서대로 반환  */
    allFiles: function () {
      return Object.keys(registry);
    }
  };

})(window);
