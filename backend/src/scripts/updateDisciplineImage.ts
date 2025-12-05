import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSafeFileAccess, PathTraversalError } from '../services/pathSecurity.js';

const scriptDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = path.resolve(scriptDir, '../../..');
const images = createSafeFileAccess(path.join(projectRoot, 'картинки'));

const prisma = new PrismaClient();

async function updateDisciplineImage() {
    try {
        const imageDir = 'Калистеника';
        const imageFile = 'Калистеника.png';

        let imagePath: string;
        try {
            imagePath = images.resolve(imageDir, imageFile);
        } catch (error) {
            if (error instanceof PathTraversalError) {
                console.error('[security] Заблокирована попытка обращения к файлу вне разрешённой директории', {
                    directory: imageDir,
                    file: imageFile,
                    baseDir: images.root,
                });
                process.exit(1);
            }
            throw error;
        }

        if (!existsSync(imagePath)) {
            console.error(`Файл не найден: ${imagePath}`);
            process.exit(1);
        }

        // Читаем файл
        const imageBuffer = readFileSync(imagePath);
        
        // Конвертируем в base64
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        // Находим направление "Калистеника"
        const discipline = await prisma.trainingDiscipline.findFirst({
            where: {
                name: {
                    contains: 'Калистеника',
                    mode: 'insensitive'
                }
            }
        });

        if (!discipline) {
            console.error('Направление "Калистеника" не найдено в БД');
            process.exit(1);
        }

        console.log(`Найдено направление: ${discipline.name} (ID: ${discipline.id})`);

        // Обновляем запись в БД
        const updated = await prisma.trainingDiscipline.update({
            where: { id: discipline.id },
            data: {
                imageUrl: dataUrl
            }
        });

        console.log(`✅ Картинка успешно добавлена к направлению "${updated.name}"`);
        console.log(`   Размер картинки: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`   Формат: PNG (base64)`);

    } catch (error: any) {
        console.error('Ошибка при обновлении картинки:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

updateDisciplineImage();

