# Wedding Invitation

정적(Static) 모바일 청첩장 프로젝트입니다.

## 1) 요구 사항

- Node.js 18 이상 (권장: 20 이상, 현재 테스트: 22)
- Git
- (선택) GitHub CLI `gh`

## 2) 설치

이 프로젝트는 런타임 의존성 패키지가 없습니다.

```bash
git clone https://github.com/Soluna-Angelito/wedding-invitation.git
cd wedding-invitation
```

`npm install`은 필수가 아닙니다. (dependencies가 없음)

## 3) 로컬에서 확인

정적 페이지라서 간단한 로컬 서버로 확인하면 됩니다.

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500` 접속

## 4) 개발 방법

- 보통은 `index.html`과 `assets/*` 파일을 직접 수정합니다.
- 별도 번들러(webpack/vite) 없이 동작합니다.

### 4-1) 사진 추가 / 제거 / 설명 바꾸기

갤러리에 들어가는 사진은 **`assets/data/photos.js` 한 파일**에서만 관리하면
됩니다. 파일 안의 주석에 자세한 안내가 있으며, 핵심만 정리하면 다음과 같습니다.

1. 새 사진 추가
   1. 사진 파일을 `assets/img/` 폴더에 복사합니다 (`.webp` 권장).
   2. `assets/data/photos.js`의 `registry`에 한 줄을 추가합니다.

      ```js
      'IMG_2300.webp': '여기에 한 줄 설명을 적어주세요',
      ```
2. 사진 빼기
   - `registry`에서 해당 줄을 지우거나 `layout` 영역에서 빼면 됩니다.
3. 설명만 바꾸기
   - `registry` 값(작은따옴표 안)만 수정하면 갤러리/라이트박스/캡션 등
     모든 곳에 자동으로 반영됩니다.
4. 갤러리 자리 배치
   - `layout.featured` : 갤러리 상단의 시네마틱 한 장
   - `layout.mosaics` : 중간 모자이크 (`duo` / `mixed` / `trio`)
   - `layout.filmstrip` : 하단 필름 스트립 (`'auto'` 면 등록된 모든 사진을 사용)

작업이 끝나면 캐시 버전을 새로 찍기 위해 한 번 실행해주세요.

```bash
npm run version-assets
```

### 4-2) 필름 스트립 동작 미세 조정

드래그 응답성, 자동 스크롤 속도, 폴라로이드 회전각 등은
`assets/js/config.js`의 `gallery` 섹션에서 직접 조정할 수 있습니다.
주요 항목:

| 키 | 의미 |
| --- | --- |
| `filmstripAutoScrollSpeed` | 자동 스크롤 속도(0이면 비활성) |
| `filmstripFlingWindowMs` | 손을 뗐을 때 관성 속도를 계산하는 시간창(ms) |
| `filmstripFriction` | 관성 마찰. 1에 가까울수록 더 멀리 미끄러집니다 |
| `filmstripResumeDelayMs` | 사용자 조작 후 자동 스크롤이 다시 시작되기까지의 시간 |
| `filmstripTiltMaxDeg` | 폴라로이드 기울기 최대 각도 |
| `filmstripTapeMaxDeg` | 폴라로이드 위쪽 테이프 회전 최대 각도 |

## 5) 빌드(배포 전 필수)

이 프로젝트의 "빌드"는 캐시 버저닝 처리입니다.

```bash
npm run version-assets
```

무엇을 하나요:
- `index.html` 안의 `assets/...` URL에 `?v=<해시>`를 자동으로 붙입니다.
- 기존 `v` 파라미터가 있으면 새 해시로 교체합니다.
- 파일 내용이 바뀌면 해시도 바뀌어 브라우저 캐시 충돌을 방지합니다.

주의:
- `assets` 파일 수정 후에는 배포 전에 반드시 다시 실행하세요.
- 이 명령은 `index.html`을 직접 수정합니다.

## 6) 배포 (GitHub Pages)

Repository 설정:
- Visibility: `Public`
- Pages > Build and deployment > Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

배포 명령:

```bash
npm run version-assets
git add .
git commit -m "Update invitation"
git push
```

배포 URL:
- https://soluna-angelito.github.io/wedding-invitation/

## 7) 자주 쓰는 명령

```bash
# 캐시 버전 태그 갱신
npm run version-assets

# 배포용 커밋/푸시
git add .
git commit -m "Update invitation"
git push
```

## 8) 문제 해결

- 페이지가 이전 버전으로 보일 때:
  - `Ctrl+F5`(강력 새로고침)로 확인
  - `npm run version-assets` 실행 후 다시 푸시
- 스크립트가 `Skipped missing assets`를 출력할 때:
  - `index.html`의 자산 경로와 실제 파일 경로가 일치하는지 확인
