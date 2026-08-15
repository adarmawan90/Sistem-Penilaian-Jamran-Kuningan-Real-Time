# Panduan & Solusi Deployment ke Vercel (vercel.app)

Aplikasi **Sistem Penilaian Lomba Pramuka Real-Time** telah disesuaikan agar **100% kompatibel dengan Vercel** tanpa masalah layar blank (*white screen*).

---

## 🔧 Penyebab Layar Blank Sebelumnya & Solusi yang Telah Diterapkan:
1. **Dynamic Vite Import**: Mengganti impor statis `vite` pada backend serverless agar Vercel Lambda tidak mencari modul dev-dependency di runtime produksi.
2. **Path & Base URL Presisi**: Menambahkan `base: '/'` di `vite.config.ts` dan konfigurasi *rewrite* bersih di `vercel.json` agar seluruh berkas aset JavaScript/CSS dimuat secara absolut dari root.
3. **Instant Local Seed Fallback**: Seluruh master data (55 pangkalan, 11 pos lomba, juri) diinisialisasi seketika di memori browser, sehingga layar tidak akan pernah blank saat serverless function sedang *cold-start* atau memuat data.
4. **React Error Boundary**: Membungkus antarmuka dengan penangkap error otomatis agar pengguna mendapatkan tombol muat ulang jika terjadi gangguan sesi di browser.

---

## 🚀 Langkah Deploy Cepat ke Vercel

### Opsi 1: Melalui GitHub & Vercel Dashboard (Rekomendasi)

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
4. **Tambahkan Environment Variables di Vercel** (Opsional tapi direkomendasikan agar Firestore Cloud langsung aktif):
   - `FIREBASE_PROJECT_ID` = `penilaianjamrankuningan`
   - `FIREBASE_API_KEY` = `AIzaSyDIZJlVu0kBSbyppN21i3tENEMUKtCGnms`
   - `FIREBASE_DATABASE_ID` = `(default)`
5. **Klik "Deploy"**:
   - Vercel akan memproses build dan memberikan tautan online gratis (misal: `https://penilaian-pramuka.vercel.app`).

---

### Opsi 2: Menggunakan Vercel CLI (Dari Laptop/Komputer)

Jika menggunakan terminal di komputer:
```bash
# 1. Pastikan Vercel CLI terpasang
npm install -g vercel

# 2. Login ke akun Vercel
vercel login

# 3. Jalankan deploy produksi
vercel --prod
```
Semua pengaturan `vercel.json` akan otomatis terbaca oleh CLI.
