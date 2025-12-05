import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profile.findMany();
  console.log('Found profiles:', profiles.length);
  profiles.forEach(p => {
    console.log(`ID: ${p.id}, TelegramID: ${p.telegramId}, FirstName: ${p.firstName}, LastName: ${p.lastName}, PIN Hash: ${p.pinHash ? p.pinHash.substring(0, 10) + '...' : 'null'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
