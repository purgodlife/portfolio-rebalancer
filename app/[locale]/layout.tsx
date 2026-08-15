import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import NavBar from '@/components/NavBar';
import DisclaimerGate from '@/components/DisclaimerGate';
import AdSlot from '@/components/AdSlot';
import { AccountProvider } from '@/lib/storage/accountContext';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function isSupportedLocale(value: string): value is (typeof routing.locales)[number] {
  return (routing.locales as readonly string[]).includes(value);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AccountProvider>
        <NavBar />
        <DisclaimerGate>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
          <AdSlot />
        </DisclaimerGate>
      </AccountProvider>
    </NextIntlClientProvider>
  );
}
