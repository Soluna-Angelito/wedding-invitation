# Wedding Invitation

정적 모바일 청첩장 페이지입니다.

## 배포 전 권장 절차

```bash
npm run version-assets
```

- `index.html` 안의 `assets/...` URL에 `?v=파일해시`를 자동 부여합니다.
- CSS/JS/폰트/이미지 파일이 바뀌면 URL도 바뀌어서 캐시 충돌을 피할 수 있습니다.

## GitHub Pages

- 저장소 루트에 `index.html`이 있으므로 GitHub Pages Source를 `Deploy from a branch` + `main /(root)`로 설정하면 바로 서비스할 수 있습니다.
