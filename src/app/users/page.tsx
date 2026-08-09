import { UserPlus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function UsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">People with access to this OmniShip account.</p>
        </div>
        <Button disabled title="Multiple users and roles are coming in a future update">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {user && (
            <div className="flex items-center gap-3 p-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {user.email?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
                Active
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        OmniShip is currently single-user. Inviting teammates with scoped roles (Manager, Staff, Viewer) is planned
        for a future update.
      </p>
    </AppShell>
  );
}
