'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setCompanyName(data.settings.companyName ?? '');
          setCompanyAddress(data.settings.companyAddress ?? '');
        }
      });
  }, []);

  async function save() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, companyAddress, defaultPaperSize: '4x6' }),
    });
    toast.success('Settings saved');
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Company Profile</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Company Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <Input
            placeholder="Company address"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
