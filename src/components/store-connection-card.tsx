'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface StoreConnectionCardProps {
  store: { name: string; shopDomain: string; status: string; lastError: string | null } | null;
  error: string | null;
}

export function StoreConnectionCard({ store, error }: StoreConnectionCardProps) {
  const [shop, setShop] = useState('');

  function connect(shopDomain: string) {
    window.location.href = `/api/auth/shopify/connect?shop=${encodeURIComponent(shopDomain)}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify Store</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {store ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono">{store.name}</span>
              <Badge variant={store.status === 'connected' ? 'default' : 'destructive'}>{store.status}</Badge>
            </div>
            {store.status === 'error' && (
              <div className="space-y-1">
                {store.lastError && <p className="text-destructive">{store.lastError}</p>}
                <Button size="sm" variant="outline" onClick={() => connect(store.shopDomain)}>
                  Reconnect
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="your-shop.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
            <Button onClick={() => connect(shop)}>Connect</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
