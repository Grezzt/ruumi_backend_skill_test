import { PrismaClient, BookingStatus, Prisma } from '@prisma/client';

export class BookingRepository {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async findMany(filters: any, page: number, limit: number) {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.bookingRequest.findMany({
        where: filters,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.bookingRequest.count({ where: filters })
    ]);

    return { data, total };
  }

  async create(data: Prisma.BookingRequestUncheckedCreateInput) {
    return this.prisma.bookingRequest.create({ data });
  }

  async findById(id: string) {
    return this.prisma.bookingRequest.findUnique({ where: { id } });
  }

  // OPTIMISTIC LOCKING IMPLEMENTATION
  async updateStatusWithLock(id: string, currentVersion: number, newStatus: BookingStatus) {
    const result = await this.prisma.bookingRequest.updateMany({
      where: {
        id,
        version: currentVersion,
        status: 'PENDING' // Pastikan hanya data yang PENDING yang bisa diubah
      },
      data: {
        status: newStatus,
        version: { increment: 1 } // Mutasi versi secara atomic
      }
    });
    
    return result.count > 0; // Jika 0, berarti terjadi race condition atau sudah diubah
  }
}
