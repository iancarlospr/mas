import { NextResponse, type NextRequest } from 'next/server';

const BLACK_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title></title>
<style>
  html,body{margin:0;padding:0;background:#000;color:#000;height:100%;width:100%;overflow:hidden}
</style>
</head>
<body></body>
</html>`;

export function middleware(_request: NextRequest) {
  return new NextResponse(BLACK_PAGE, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export const config = {
  matcher: ['/:path*'],
};
