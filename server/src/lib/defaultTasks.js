// Default checklist applied to every new move. `dayOffset` is relative to
// the move's moveDate (negative = days before, 0 = moving day, positive =
// days after) — used to compute each task's concrete dueDate.

export const DEFAULT_TASKS = [
  { title: 'Schedule movers or rent a truck', category: 'BEFORE_MOVE', dayOffset: -21 },
  { title: 'Transfer or set up utilities at the new address', category: 'BEFORE_MOVE', dayOffset: -14 },
  { title: 'Submit a USPS mail forwarding request', category: 'BEFORE_MOVE', dayOffset: -7 },
  { title: 'Notify your employer or school of the address change', category: 'BEFORE_MOVE', dayOffset: -7 },
  { title: 'Do a final walkthrough of the old home', category: 'MOVING_DAY', dayOffset: 0 },
  { title: 'Update your address with the DMV', category: 'AFTER_MOVE', dayOffset: 14 },
];

export function buildDefaultTasksForMove(moveDate) {
  const base = new Date(moveDate);
  return DEFAULT_TASKS.map(({ title, category, dayOffset }) => {
    const dueDate = new Date(base);
    dueDate.setUTCDate(dueDate.getUTCDate() + dayOffset);
    return { title, category, dueDate };
  });
}
