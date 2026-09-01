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
      oldAddress: '6030 Sturgeon Lake Rd, Sacramento, CA 95828',
      newAddress: '456 Oakland Ave, Novato, CA 94945',
      moveDate,
      budgetCap: '3000.00',
      tasks: { create: buildDefaultTasksForMove(moveDate) },
      budgetItems: {
        create: [
          { label: 'Moving truck rental', category: 'MOVERS', amount: '850.00', isPaid: false },
          { label: 'Security deposit', category: 'DEPOSIT', amount: '500.00', isPaid: true },
        ],
      },
    },
    include: { tasks: true, budgetItems: true },
  });

  console.log(
    `Seeded move ${move.id} with ${move.tasks.length} default tasks and ${move.budgetItems.length} budget items.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
