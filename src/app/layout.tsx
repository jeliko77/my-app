import type { Metadata } from "next";
// 한글이 깔끔하게 보이는 무료 글꼴 Pretendard. 외부 서버 대신 앱이 직접 파일을 보내 준다
// (방문자 정보가 글꼴 서버로 새지 않고, 외부 파일이 바뀌어도 영향을 받지 않는다)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "할일 추출기",
  description: "글을 붙여넣으면 할 일만 골라냅니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
