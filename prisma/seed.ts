import 'dotenv/config';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Fungsi utilitas untuk memilih item acak dari array
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fungsi utilitas untuk mendapatkan tanggal acak di masa depan
function getRandomDate(startDaysFromNow: number, endDaysFromNow: number): Date {
  const date = new Date();
  const days = startDaysFromNow + Math.random() * (endDaysFromNow - startDaysFromNow);
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return date;
}

const PROPERTY_ADJECTIVES = ['Cozy', 'Spacious', 'Modern', 'Minimalist', 'Luxury', 'Classic', 'Urban'];
const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Villa', 'Condo'];
const PROPERTY_LOCATIONS = ['Sudirman', 'Kemang', 'Senayan', 'Menteng', 'Kuningan', 'PIK', 'BSD'];

const STATUSES: BookingStatus[] = ['PENDING', 'ACCEPT', 'REJECT', 'EXPIRED'];

async function main() {
  console.log('Menghapus data lama...');
  await prisma.bookingRequest.deleteMany();
  await prisma.property.deleteMany();

  console.log('Membuat 20 Property secara acak...');
  const properties = [];
  for (let i = 1; i <= 20; i++) {
    const property = await prisma.property.create({
      data: {
        name: `${getRandomItem(PROPERTY_ADJECTIVES)} ${getRandomItem(PROPERTY_TYPES)} in ${getRandomItem(PROPERTY_LOCATIONS)}`,
        landlordId: `landlord-${Math.floor(Math.random() * 5) + 1}`, // landlord-1 sampai landlord-5
      }
    });
    properties.push(property);
  }
  console.log(`Berhasil membuat 20 Property.`);

  console.log('Membuat 40 Booking Request secara acak...');
  let pendingCount = 0;
  for (let i = 1; i <= 40; i++) {
    const property = getRandomItem(properties);
    const tenantNum = Math.floor(Math.random() * 20) + 1; // tenant-1 sampai tenant-20
    const status = getRandomItem(STATUSES);
    
    // Pastikan kita memiliki setidaknya beberapa status PENDING untuk di-test nantinya
    const finalStatus = (i <= 10) ? 'PENDING' : status; 
    if (finalStatus === 'PENDING') pendingCount++;

    await prisma.bookingRequest.create({
      data: {
        propertyId: property.id,
        tenantId: `tenant-${tenantNum}`,
        landlordId: property.landlordId,
        tenantName: `Penyewa Dummy ${tenantNum}`,
        tenantEmail: `tenant${tenantNum}@example.com`,
        requestedViewingAt: getRandomDate(1, 14), // Jadwal survei 1-14 hari ke depan
        status: finalStatus,
        expiresAt: getRandomDate(0, 1), // Kadaluwarsa dalam 0-1 hari
      }
    });
  }
  
  console.log(`Berhasil membuat 40 Booking Request (${pendingCount} di antaranya berstatus PENDING).`);
  console.log('Seeding selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
