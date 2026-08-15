# Panduan & Solusi Deployment ke Vercel (vercel.app)

Aplikasi **Sistem Penilaian Lomba Pramuka Real-Time** telah disesuaikan agar **100% kompatibel dengan Vercel** tanpa masalah layar blank (*white screen*) maupun data kosong.

---

## 🔧 Solusi Data & Serverless Vercel yang Telah Diterapkan:
1. **URL Normalization Middleware**: Menangani *URL routing rewrite* Vercel pada endpoint API (`/api/initial-data`, `/api/scores`, dll.) agar tidak terjadi galat 404 pada arsitektur serverless.
2. **Instant Seed Fallback**: 55 data pangkalan/sekolah, pos lomba, dan juri selalu langsung muncul di browser dari seed lokal tanpa menunggu koneksi API selesai (*zero-latency hydration*).
3. **Penyimpanan Lokal & Polling Real-time**: Mengintegrasikan polling berkala yang aman untuk serverless Vercel serta sinkronisasi otomatis ke Google Cloud Firestore.
4. **Dynamic Vite Import**: Mengganti impor statis `vite` pada backend serverless agar Vercel Lambda tidak mencari modul dev-dependency di runtime produksi.

---

## 🚀 Langkah Deploy ke Vercel

### Opsi 1: Melalui GitHub & Vercel Dashboard (Paling Direkomendasikan)

1. **Export ke GitHub**:
   - Di Google AI Studio, klik menu **Settings (ikon gear)** di kanan atas -> pilih **Export to GitHub** (atau Download ZIP lalu push ke repository GitHub Anda).
2. **Buka Vercel**:
   - Masuk ke [https://vercel.com/new](https://vercel.com/new).
3. **Import Project**:
   - Pilih repository GitHub Anda.
   - **Framework Preset**: Biarkan terdeteksi otomatis sebagai **Vite**.
   - **Root Directory**: `./`
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
4. **Tambahkan Environment Variables di Vercel**:
   - `FIREBASE_PROJECT_ID` = `penilaianjamrankuningan`
   - `FIREBASE_API_KEY` = `AIzaSyDIZJlVu0kBSbyppN21i3tENEMUKtCGnms`
   - `FIREBASE_DATABASE_ID` = `(default)`
   - `FIREBASE_AUTH_DOMAIN` = `penilaianjamrankuningan.firebaseapp.com`
   - `FIREBASE_STORAGE_BUCKET` = `penilaianjamrankuningan.firebasestorage.app`
5. **Klik "Deploy"**:
   - Vercel akan memproses build dan memberikan tautan online gratis (misal: `https://penilaian-pramuka.vercel.app`).

---

## 💡 Mengapa Data Awal Belum Muncul di Vercel & Solusinya:
1. **Pastikan Login / Masuk**: Data Rekap dan Nilai Pos akan tampil saat juri/admin memasukkan nilai atau mengaktifkan mode publik di menu Pengaturan.
2. **Master 55 Sekolah & Pos Lomba**: Sudah otomatis terisi (55 pangkalan se-Kecamatan Kuningan dan pos penjelajahan).
3. **Sinkronisasi Cloud Firestore**:
   - Masuk sebagai **Admin** (password default: `admin123`).
   - Buka menu **Pengaturan** -> bagian **Google Firebase Cloud Firestore**.
   - Klik tombol **"Sinkronkan ke Cloud"** untuk mengirim data master ke database online, atau **"Tarik Data dari Cloud"** jika database sudah terisi.

