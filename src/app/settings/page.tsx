'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAPER_SIZES, type PaperSize } from '@/components/print-preview-document';
import { toast } from 'sonner';

const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  '4x6': '4×6 in (thermal label)',
  a6: 'A6',
  a5: 'A5',
  letter: 'Letter',
};

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [defaultPaperSize, setDefaultPaperSize] = useState<PaperSize>('4x6');
  const [defaultCourier, setDefaultCourier] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setCompanyName(data.settings.companyName ?? '');
          setCompanyAddress(data.settings.companyAddress ?? '');
          // Loaded, not assumed: saving used to post a hardcoded '4x6' and
          // silently clobber whatever the user had chosen.
          if ((PAPER_SIZES as string[]).includes(data.settings.defaultPaperSize)) {
            setDefaultPaperSize(data.settings.defaultPaperSize as PaperSize);
          }
          setDefaultCourier(data.settings.defaultCourier ?? '');
        }
      })
      .catch(() => toast.error('Could not load settings'));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyAddress: companyAddress || null,
          defaultPaperSize,
          defaultCourier: defaultCourier || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not save settings');
      }
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
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
          <Select
            value={defaultPaperSize}
            onValueChange={(v) => setDefaultPaperSize(((v ?? '4x6') as PaperSize) || '4x6')}
          >
            <SelectTrigger className="w-full" aria-label="Default paper size">
              <SelectValue placeholder="Default paper size" />
            </SelectTrigger>
            <SelectContent>
              {PAPER_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {PAPER_SIZE_LABELS[size]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Default courier"
            value={defaultCourier}
            onChange={(e) => setDefaultCourier(e.target.value)}
          />
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
