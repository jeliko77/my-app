import type { NextConfig } from "next";

/**
 * 모든 응답에 붙이는 보안 설정(헤더). 브라우저가 이 규칙을 지켜 공격을 막는다.
 * Design Ref: DESIGN.md §2 보안 설정
 */
const securityHeaders = [
  // 다른 사이트가 이 화면을 자기 페이지 안에 몰래 끼워 넣지 못하게 한다 (클릭 유도 공격 대비)
  // 스크립트 제한은 넣지 않았다: Next.js가 화면에 넣는 스크립트까지 막혀 앱이 멈출 수 있어서다
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" }, // 위와 같은 뜻. 오래된 브라우저용
  { key: "X-Content-Type-Options", value: "nosniff" }, // 파일 종류를 브라우저가 멋대로 추측하지 않게 한다
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // 다른 사이트로 이동할 때 주소 전체를 넘기지 않는다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // 쓰지 않는 기기 권한은 끈다
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // "Next.js로 만듦" 표시를 응답에서 뺀다
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
