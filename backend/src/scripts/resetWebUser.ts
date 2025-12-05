import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const webUser = await prisma.profile.findUnique({
        where: { telegramId: -1n }
    });

    if (webUser) {
        console.log('Found Web User (ID -1). Deleting...');
        await prisma.profile.delete({
            where: { id: webUser.id }
        });
        console.log('Web User deleted.');
    } else {
        console.log('Web User not found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
