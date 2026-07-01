# Ruumi Property Rental - Backend Skill Test

## 🚀 Persiapan & Menjalankan Proyek Secara Lokal

Proyek ini dibangun menggunakan Node.js (Express), TypeScript, Prisma ORM, PostgreSQL, Redis, dan BullMQ.

### Prasyarat

1. **Node.js** (v18+)
2. **Docker Desktop** (untuk menjalankan PostgreSQL dan Redis)

### Langkah-Langkah Eksekusi

1. **Jalankan Infrastruktur (Docker)**
   Buka terminal di root proyek dan jalankan:

   ```bash
   docker-compose up -d
   ```

   _Ini akan menjalankan PostgreSQL dan Redis pada docker._

2. **Setup Proyek (Instalasi, Migrasi, Seeding)**
   Anda dapat melakukan tahapan ini secara otomatis maupun manual.

   **Opsi A: Setup Otomatis**

   ```bash
   npm run setup
   ```

   _Perintah ini akan secara otomatis melakukan `npm install`, migrasi Prisma, eksekusi seed data, dan mem-build TypeScript._

   **Opsi B: Setup Manual**
   Jika Anda ingin menjalaninya tahap demi tahap:

   ```bash
   npm install
   npx prisma migrate dev
   npx prisma db seed
   npm run build
   ```

3. **Jalankan Server**

   ```bash
   npm run dev
   ```

   _Server akan berjalan di `http://localhost:3000`. Swagger API Docs dapat diakses di `http://localhost:3000/api-docs`._

4. **Jalankan Pengujian (Testing & Concurrency)**
   ```bash
   npm run test
   ```

---

## Keputusan Arsitektur & Penyelesaian Tantangan

Bagian ini menjelaskan strategi arsitektur yang saya pilih untuk menjawab spesifikasi teknis dari skill test, beserta pertukaran (_trade-offs_) dari opsi lain yang saya pertimbangkan.

### 1. Tantangan A: Mengatasi _Race Condition_ (Concurrency Guard)

**Skenario Masalah:**
Saat banyak permintaan sewa (`PENDING`) menumpuk pada properti populer, pemilik properti bisa saja tanpa sengaja melakukan aksi persetujuan (ACCEPT) ganda akibat koneksi yang buruk atau _bug_ jaringan. Terburuknya, jika dua pemilik mengakses aplikasi pada milidetik yang sama, mereka bisa secara bersamaan mengubah satu status menjadi ACCEPT dan satunya lagi REJECT, mengakibatkan inkonsistensi data.

**Strategi yang Digunakan: _Optimistic Locking_**
Untuk mencegah hal tersebut, sistem ini memanfaatkan skema **Optimistic Locking** di tingkat database.
Saya menambahkan kolom `version` (Integer) ke tabel `BookingRequest`. Saat landlord ingin melakukan PATCH (ACCEPT/REJECT), aliran yang terjadi adalah:

1. _Service_ mengecek versi dari data saat ini (misal: `version = 1`).
2. _Repository_ menembak _query update_ atomik menggunakan `updateMany` dengan dua syarat utama: `id = ID_BOOKING` **DAN** `version = 1`.
3. Jika mutasi berhasil, kolom `version` akan dinaikkan `version: { increment: 1 }`.
4. Jika di saat milidetik yang persis bersamaan ada antrean HTTP lain yang mencoba merespons data yang sama, ia tetap akan mencoba melakukan _update_ dengan syarat `version = 1`. Namun karena versi telah berubah menjadi `2` oleh permintaan pertama, _query update_ permintaan kedua ini **tidak akan menemukan data yang cocok** sehingga menghasilkan **0 row affected (tidak ada baris yang diubah)**.
5. _Service_ yang mendeteksi 0 baris tersebut langsung melempar kesalahan `HTTP 409 Conflict: Data has been modified by another process`.

**Mengapa Memilih _Optimistic Locking_ Dibanding _Pessimistic Locking_? (Trade-offs)**

- _Pessimistic Locking_ (contoh: `SELECT ... FOR UPDATE` via transaksi basis data) memang sangat aman karena ia membekukan seluruh baris data sampai satu _request_ selesai. Namun, ini dapat memicu **Database Deadlock** dan membuat aplikasi menjadi sangat lambat (membunuh _throughput_) jika pengguna sedang ramai.
- _Optimistic Locking_ tidak menggunakan _lock_. Ia mengasumsikan bahwa konflik sangat jarang terjadi di dunia nyata. Hal ini **sangat ringan dan jauh lebih bersahabat pada CPU Database**.
- Kekurangannya _(Trade-off)_: Jika konflik benar-benar terjadi, pengguna (atau _frontend_) akan menerima _error_ dan dituntut untuk me-_refresh_ data dan mencoba ulang aksinya secara manual. saya menilai ini jauh lebih masuk akal untuk skema UX _Property Rental_ dibandingkan membiarkan layar pengguna _hang_ karena _database table locking_.

---

### 2. Tantangan B: Mekanisme Kadaluwarsa Otomatis (_Auto-Expiration_ 24 Jam)

**Skenario Masalah:**
Setiap _booking request_ baru akan diberi `expiresAt` tepat 24 jam dari saat ia dibuat. Jika _landlord_ tidak menjawab, maka status harus berubah dari PENDING menjadi EXPIRED, sekaligus menembak email pemberitahuan ke _Tenant_.

**Strategi yang Digunakan: _Delayed Message Queue_ (BullMQ + Redis)**
Saat API POST berhasil menciptakan pesanan, saya langsung menjadwalkan pekerjaan ke BullMQ Queue dengan penundaan (_delay_) `86.400.000` milidetik (24 Jam).
24 jam kemudian, fungsi _worker_ akan terbangun. Menggunakan _Transaction_ DB, _worker_ tersebut akan memeriksa apakah status masih `PENDING`. Jika iya, ia memutasi status ke `EXPIRED` dan menembak _Email Queue_. Jika sudah berstatus ACCEPT/REJECT, _worker_ akan mundur dan tidak melakukan apa-apa.

**Mengapa Memilih _Delayed Queues_ Dibandingkan _Cron Scheduler / Opportunistic Lazy Evaluation_? (Trade-offs)**

- **Opportunistic / Lazy Evaluation:** Ini adalah metode di mana status tidak benar-benar diubah di DB; namun setiap kali pengguna meminta API `GET`, logika kode mengevaluasi jika tanggal sudah lewat, lalu menampilkan sebagai EXPIRED. Sayangnya, cara ini tidak mampu menjawab keharusan sistem yang mana kita harus **mengirimkan pesan Email tepat pada saat data tersebut kadaluwarsa**.

- **Cron Schedulers (Poller):** Kita bisa membuat _cron-job_ yang berjalan setiap menit mengecek isi seluruh tabel: `SELECT * FROM BookingRequest WHERE expiresAt <= NOW()`. Sayangnya, seiring data yang membengkak jutaan baris, melakukan _query scan_ raksasa setiap menit hanya akan membuat memori CPU PostgreSQL menangis (_bottleneck_). Selain itu, pengiriman eksekusi tidak dijamin akurat di satuan detik spesifik.

- **Delayed Jobs (BullMQ):** saya memilih ini karena sifatnya yang **Event-Driven**. Mengandalkan _Redis ZSET_ di belakang layar, ia secara akurat membangkitkan eksekusi persis pada detik yang dibutuhkan tanpa perlu secara terus-menerus mem-pumping _query database_. Eksekusi perubahannya spesifik untuk 1 buah ID saja.
- _Kekurangannya (Trade-off):_ Membutuhkan layanan tambahan (Redis), yang memperbesar kompleksitas infrastruktur _deployment_, dan berpotensi memori Redis akan membengkak jika _delayed jobs_ yang masuk berjuta-juta dalam sehari. Namun, BullMQ menawarkan optimasi yang baik untuk hal ini.

---

### 3. Tantangan C: Background Queue Email (_Fault Tolerance_)

saya menggunakan antrean terpisah khusus untuk menangani pengiriman pesan (Brevo SMTP via Nodemailer).
Dengan `BullMQ`, API Controller mampu mengeksekusi _response HTTP 201_ kepada pengguna dalam hitungan milidetik, karena ia hanya sekadar meng-oper muatan (_payload_) surat kepada Redis. _email.worker_ yang akan mengeksekusi koneksi TCP ke jaringan surat eksternal. Jika SMTP Brevo sedang _down_, BullMQ dikonfigurasi untuk melakukan **3 percobaan ulang secara eksponensial** (_Exponential Backoff Retry_), yang menjamin resiliensi sistem (_Fault Tolerance_).
