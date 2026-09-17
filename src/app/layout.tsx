import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "할일 추출기",
  description: "글을 붙여넣으면 할 일만 골라냅니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 한글이 깔끔하게 보이는 무료 글꼴 Pretendard (토스 글꼴과 비슷한 느낌) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
