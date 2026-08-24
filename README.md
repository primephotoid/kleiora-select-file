# Kleiora Grads

Aplikasi terpadu Kleiora untuk booking sesi foto wisuda, pengelolaan pembayaran manual, dan galeri pemilihan foto klien.

## Struktur

- `frontend/` — Next.js 14 dan Tailwind CSS.
- `backend/` — Go, Fiber v2, GORM, dan MySQL.
- `/` — landing page publik.
- `/booking` — pemilihan paket dan pembuatan booking.
- `/g/[slug]` — galeri pemilihan foto klien.
- `/studio/login` dan `/dashboard` — area operasional studio.

## Menjalankan lokal

Siapkan database dan user MySQL terlebih dahulu:

```sql
CREATE DATABASE kleiora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Konfigurasi lokal saat ini memakai user root tanpa password.
```

Salin konfigurasi contoh dan isi `DATABASE_URL`, `JWT_SECRET`, serta `GOOGLE_DRIVE_API_KEY`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Backend membaca environment dari shell (file `.env` tidak dimuat otomatis):

```bash
cd backend
export JWT_SECRET='development-secret-yang-panjang'
export GOOGLE_DRIVE_API_KEY='google-drive-api-key'
export DATABASE_URL='root:@tcp(127.0.0.1:3306)/kleiora?charset=utf8mb4&parseTime=True&loc=Asia%2FMakassar'
go run ./cmd/server
```

Jalankan frontend di terminal lain:

```bash
cd frontend
npm ci
npm run dev
```

Frontend tersedia di `http://localhost:3000` dan API di `http://localhost:4000`.
Pada instalasi baru, halaman `/studio/login` menyediakan pendaftaran akun studio pertama. Setelah akun pertama dibuat, endpoint pendaftaran otomatis ditutup.

Untuk membuat atau memperbarui akun admin dari konfigurasi `backend/.env`:

```bash
cd backend
go run ./cmd/seed-admin
```

Seeder membaca `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULL_NAME`, dan `ADMIN_STUDIO_NAME`. Password minimal 12 karakter dan disimpan sebagai hash bcrypt; menjalankan perintah kembali akan memperbarui akun dengan email yang sama.

## Verifikasi

```bash
cd backend && go test ./...
cd frontend && npm run build
```

`AutoMigrate` akan membuat tabel aplikasi saat backend pertama kali terhubung. SQLite hanya digunakan sebagai database in-memory pada unit test, bukan pada runtime aplikasi.

## CI/CD GitHub Actions

Push ke branch `main` menjalankan validasi frontend/backend, membangun image Docker, mengirimkannya ke Docker Hub, lalu melakukan deployment melalui SSH. Workflow juga dapat dijalankan manual dari tab Actions.

Tambahkan Repository Variables berikut di GitHub:

- `NEXT_PUBLIC_API_URL` — URL API publik, misalnya `https://domain.example/api/v1`.
- `FRONTEND_ORIGIN` — origin frontend tanpa path, misalnya `https://domain.example`.
- `FRONTEND_PORT` — port frontend di server; opsional, default `4601`.
- `BACKEND_PORT` — port backend di server; opsional, default `4600`.

Tambahkan Repository Secrets berikut:

- `DOCKER_USERNAME` dan `DOCKER_PASSWORD`.
- `SSH_HOST`, `SSH_USERNAME`, dan `SSH_PRIVATE_KEY`.
- `DATABASE_URL`, `JWT_SECRET`, dan `GOOGLE_DRIVE_API_KEY`.
- `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` bila notifikasi Telegram digunakan.

Upload pengguna disimpan persisten di `/opt/kleiora/uploads` pada server deployment.

## Backup database

Buat dump struktur dan data MySQL dengan utilitas Go:

```bash
cd backend
go run ./cmd/db-dump
```

Hasil dump tersimpan di `backend/database/dumps/kleiora-YYYYMMDD-HHMMSS.sql`. File SQL diabaikan Git karena berisi data aplikasi dan hash password pengguna.

## Catatan pembayaran

Versi ini tidak membuat QRIS atau Virtual Account palsu. Booking dibuat dengan status `pending_payment`; pelanggan dapat mengunggah bukti JPG/PNG dan admin memverifikasinya dari dashboard. Integrasi payment gateway dapat ditambahkan sebagai tahap tersendiri.
