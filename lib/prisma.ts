// Stub prisma client - database not configured
// When DATABASE_URL is set, regenerate with: npx prisma generate
export const prisma: any = {
  user: {
    upsert: async () => null,
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => null,
    delete: async () => null,
  },
}
