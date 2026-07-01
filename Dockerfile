# Gunakan Node.js LTS (Alpine untuk image yang lebih ringan)
FROM node:22-alpine

# Set direktori kerja di dalam container
WORKDIR /app

# Install openssl (Dibutuhkan oleh Prisma Client pada sistem operasi Alpine)
RUN apk add --no-cache openssl

# Salin file konfigurasi NPM
COPY package*.json ./

# Install semua dependensi
RUN npm install

# Salin seluruh kode proyek
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build aplikasi TypeScript menjadi JavaScript
RUN npm run build

# Perintah utama untuk menjalankan aplikasi (beserta sinkronisasi skema database)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
