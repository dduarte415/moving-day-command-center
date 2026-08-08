// Convenience script for local dev: creates one sample move with its default
// task checklist so the app isn't empty on first run. Not used in production.
import { prisma } from '../src/lib/prisma.js';
import { buildDefaultTasksForMove } from '../src/lib/defaultTasks.js';

async function main() {
  const existing = await prisma.move.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} move(s) already exist.`);
    return;
  }

  const moveDate = new Date();
  moveDate.setUTCDate(moveDate.getUTCDate() + 30);

  const move = await prisma.move.create({
    data: {
      oldAddress: '123 Old St, Springfield, IL 62701',
      newAddress: '456 New Ave, Austin, TX 73301',
      moveDate,
      tasks: { create: buildDefaultTasksForMove(moveDate) },
    },
    include: { tasks: true },
  });

  console.log(`Seeded move ${move.id} with ${move.tasks.length} default tasks.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
