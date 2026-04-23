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
