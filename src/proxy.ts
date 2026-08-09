import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath =
    path.startsWith('/login') || path.startsWith('/api/cron') || path.startsWith('/api/webhooks');

  // Checked before building a Supabase client: cron and webhook traffic is
  // never authenticated by cookie, so calling auth.getUser() for it only buys
  // a wasted network round-trip on every single request.
  if (isPublicPath) {
    return NextResponse.next({ request });
  }

  // TEMPORARY: auth gate fully disabled everywhere (including the deployed
  // Vercel build) while doing frontend-only redesign work with no login
  // credentials to hand. Revert this before any real usage.
  return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

// manifest.webmanifest, the PWA icons, and the favicon (icon.svg, via
// Next's app/icon.svg convention) must stay reachable without a session:
// browsers fetch these without credentials, so gating them behind auth
// redirected the fetch to /login — the manifest/PWA install broke silently,
// and the browser tab fell back to no favicon at all.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon\\.svg|manifest.webmanifest|icon-.*\\.png).*)'],
};
