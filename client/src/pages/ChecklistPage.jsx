import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { formatDateShort } from '../lib/formatDate';
import RowMenu from '../components/RowMenu';

const CATEGORIES = [
  { key: 'BEFORE_MOVE', label: 'Before Move' },
  { key: 'MOVING_DAY', label: 'Moving Day' },
  { key: 'AFTER_MOVE', label: 'After Move' },
];

export default function ChecklistPage() {
  const { activeMoveId } = useMoveContext();
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [category, setCategory] = useState('BEFORE_MOVE');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.get(`/api/tasks?moveId=${activeMoveId}`);
      setTasks(data);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [activeMoveId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleComplete(task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isComplete: !t.isComplete } : t)));
    try {
      await api.patch(`/api/tasks/${task.id}`, { isComplete: !task.isComplete });
    } catch (err) {
      window.alert(err.message);
      load();
    }
  }

  async function handleDelete(taskId) {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !title.trim()) return;
    setSubmitting(true);
    try {
      const task = await api.post('/api/tasks', {
        moveId: activeMoveId,
        title,
        category,
        dueDate: dueDate || null,
      });
      setTasks((prev) => [...prev, task]);
      setTitle('');
      setDueDate('');
      setShowDetails(false);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') return <Loading label="Loading checklist…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  const completeCount = tasks.filter((t) => t.isComplete).length;
  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: tasks
      .filter((t) => t.category === c.key)
      .sort((a, b) => new Date(a.dueDate ?? 0) - new Date(b.dueDate ?? 0)),
  })).filter((c) => c.items.length > 0);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="What needs to get done?"
          />
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : '+ Add'}
          </button>
        </div>

        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            + Add details (category, due date)
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-500">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-slate-500">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        )}
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          title="Your checklist is empty"
          description="Add your first task to start planning your move."
        />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-slate-600">
              {completeCount} / {tasks.length} tasks complete
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${tasks.length ? (completeCount / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <h3 className="font-semibold text-slate-800">{section.label}</h3>
                  <span className="text-xs text-slate-400">
                    {section.items.length} {section.items.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {section.items.map((task) => (
                    <li
                      key={task.id}
                      onClick={() => toggleComplete(task)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={task.isComplete}
                        onChange={() => toggleComplete(task)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          task.isComplete ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.dueDate && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatDateShort(task.dueDate)}
                        </span>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <RowMenu actions={[{ label: 'Delete', danger: true, onClick: () => handleDelete(task.id) }]} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
