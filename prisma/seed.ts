import 'dotenv/config';
import { PrismaClient, BookingStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Utility function to get a random item from an array
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Utility function to get a random future date
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
  console.log('Clearing old data...');
  await prisma.bookingRequest.deleteMany();
  await prisma.property.deleteMany();

  console.log('Creating 20 random properties...');
  const properties = [];
  for (let i = 1; i <= 20; i++) {
    const property = await prisma.property.create({
      data: {
        name: `${getRandomItem(PROPERTY_ADJECTIVES)} ${getRandomItem(PROPERTY_TYPES)} in ${getRandomItem(PROPERTY_LOCATIONS)}`,
        landlordId: `landlord-${Math.floor(Math.random() * 5) + 1}`, // landlord-1 to landlord-5
      }
    });
    properties.push(property);
  }
  console.log(`Successfully created 20 properties.`);

  console.log('Creating 40 random booking requests...');
  let pendingCount = 0;
  for (let i = 1; i <= 40; i++) {
    const property = getRandomItem(properties);
    const tenantNum = Math.floor(Math.random() * 20) + 1; // tenant-1 to tenant-20
    const status = getRandomItem(STATUSES);
    
    // Ensure we have at least a few PENDING statuses for testing
    const finalStatus = (i <= 10) ? 'PENDING' : status; 
    if (finalStatus === 'PENDING') pendingCount++;

    await prisma.bookingRequest.create({
      data: {
        propertyId: property.id,
        tenantId: `tenant-${tenantNum}`,
        landlordId: property.landlordId,
        tenantName: `Dummy Tenant ${tenantNum}`,
        tenantEmail: `tenant${tenantNum}@example.com`,
        requestedViewingAt: getRandomDate(1, 14), // Viewing schedule 1-14 days ahead
        status: finalStatus,
        expiresAt: getRandomDate(0, 1), // Expires in 0-1 days
      }
    });
  }
  
  console.log(`Successfully created 40 booking requests (${pendingCount} of which are PENDING).`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
