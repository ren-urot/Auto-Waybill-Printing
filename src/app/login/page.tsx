'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DEMO_MODE_COOKIE, type DemoMode } from '@/lib/demo/mode-constants';

// TEMPORARY: real Supabase sign-in is skipped while the proxy auth gate is
// disabled (see src/proxy.ts) for frontend-only design review — no
// credentials are being issued right now. In its place, this page offers
// two honest demo paths: "Sign in" loads an existing account with data
// already in it (mock data fills in only where the real database is
// empty/unreachable — see src/lib/demo/mock-data.ts), and "Create an
// account" loads a genuinely brand-new, empty account. Restore the real
// signInWithPassword call together with the proxy gate before any real
// usage.
function setDemoMode(mode: DemoMode) {
  if (mode) {
    document.cookie = `${DEMO_MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 30}`;
  } else {
    document.cookie = `${DEMO_MODE_COOKIE}=; path=/; max-age=0`;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDemoMode('populated');
    router.push('/');
    router.refresh();
  }

  function handleSignUp() {
    setDemoMode('empty');
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm [--card-spacing:30px]">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex w-full items-center justify-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG from /public */}
            <img src="/omniship-icon.svg" alt="" className="h-11 w-11" />
            <p className="text-3xl font-semibold tracking-tight text-black">OmniShip</p>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to manage your orders and waybills</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{' '}
            <button type="button" onClick={handleSignUp} className="font-medium text-primary hover:underline">
              Create an account
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
