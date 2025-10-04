# AGENTS.md

﻿# Repository Guidelines

Bu depo için katkı ve çalışma kuralları. Önemli kural: Türkçe kullanılmalıdır (açıklamalar, PR’lar, commit mesajları).

## Proje Yapısı ve Modüller
- `kurulumSihirbazi/installer-ui`: Next.js 15 tabanlı admin paneli (App Router, Tailwind).
- `kurulumSihirbazi/installer-api`: Node.js/Express + TypeScript API (deployment orkestrasyonu).
- `kurulumSihirbazi/customers`: Müşteri başına PM2/konfigürasyon çıktıları.
- `docs`: Operasyon ve notlar.

## Geliştirme, Build ve Çalıştırma
- UI: `cd kurulumSihirbazi/installer-ui && npm install && npm run dev` (3030). Prod: `npm run build && npm run start`.
- API: `cd kurulumSihirbazi/installer-api && npm install && npm run dev` (3031). Prod: `npm run build && npm run start`.
- Ortam: `cp kurulumSihirbazi/installer-api/.env.example kurulumSihirbazi/installer-api/.env` sonrası değerleri güncelleyin.

## Kod Stili ve İsimlendirme
- TypeScript strict; 2 boşluk girinti, satır sonu LF.
- ESLint: `npm run lint` (her iki projede). Next.js kuralları UI’da etkindir.
- İsimlendirme: `camelCase` (değişken/fonksiyon), `PascalCase` (React bileşeni), dosya isimleri bileşenlerde `PascalCase.tsx`, yardımcılar `kebab-case.ts`.

## Test Rehberi
- Mevcutta test script’i tanımlı değil. Yeni modüller eklerken Jest + ts-jest tercih edin; hızlı birim testleri yazın ve CI süresini düşük tutun.
- Test dosyası adı: `*.test.ts` / `*.test.tsx`; konum: ilgili modülün yanında.

## Commit ve PR Kuralları
- Mesaj dili Türkçe, kısa ve emir kipinde: “Fix API rate limit”.
- Öneri: Conventional Commits (`feat:`, `fix:`, `chore:`) kullanın. Örnek: `feat(api): müşteri oluşturma endpoint’i`.
- PR’larda: amaç ve kapsam, ilgili issue/link, çalıştırma adımları ve gerekiyorsa ekran görüntüsü/log ekleyin.

## Güvenlik ve Konfigürasyon İpuçları
- Geliştirme portları: UI `3030`, API `3031`; müşteri servisleri `4000+` (localhost’a bind edin, Nginx üzerinden yayınlayın).
- SSL/NGINX üretimde API tarafından otomatikleştirilir; değişiklikte `nginx -t && nginx -s reload`.
- Büyük Next.js build’lerinde `heapMB` (Node heap) ve `skipTypeCheck` ayarlarına dikkat edin.
