import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ArrowRight, CheckCircle2, GripVertical } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { Screen } from '../../components/Layout';
import { AvatarStack } from '../../components/Person';
import { initials, personColor } from '../../lib/people';
import { Button } from '../../components/ui';
import { useMoney } from '../../lib/hooks';
import { feedback } from '../../lib/feedback';
import { addPersonToItem, splitRemainingEqually } from '../../state/actions';
import { useBill } from '../../state/bill';
import { computeBill, unassignedItems } from '../../state/derive';
import { toast } from '../../state/toasts';
import type { BillItem, Person } from '../../state/types';
import { Composer } from './Composer';
import { ItemSheet } from './ItemSheet';

function PersonDrop({ person, subtotal }: { person: Person; subtotal: string }) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({
    id: `person:${person.id}`,
    data: { personId: person.id },
  });
  return (
    <li
      ref={setNodeRef}
      aria-label={t('assign.personTotal', { name: person.name, amount: subtotal })}
      className={`flex min-h-14 shrink-0 items-center gap-2 rounded-2xl py-1.5 pr-3 pl-1.5 text-person-fg transition-transform ${
        isOver ? 'scale-105 ring-4 ring-ring' : ''
      }`}
      style={{ backgroundColor: personColor(person) }}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white/55 font-display text-sm font-semibold">
        {person.emoji ?? initials(person.name)}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display font-semibold">{person.name}</span>
        <span className="tabular text-xs font-medium opacity-90" aria-hidden>
          {subtotal}
        </span>
      </span>
    </li>
  );
}

function ItemCardBody({
  item,
  sharers,
  dragging = false,
}: {
  item: BillItem;
  sharers: Person[];
  dragging?: boolean;
}) {
  const { t } = useTranslation();
  const { format } = useMoney();
  return (
    <span
      className={`flex w-full items-center gap-2 rounded-2xl border bg-surface p-3 text-left shadow-card ${
        sharers.length === 0 ? 'border-dashed border-primary/60' : 'border-border'
      } ${dragging ? 'rotate-2 shadow-xl ring-2 ring-primary' : ''}`}
    >
      <GripVertical aria-hidden className="size-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {item.quantity !== 1 && <span className="text-muted">{item.quantity} × </span>}
          {item.name}
        </span>
        {sharers.length === 0 ? (
          <span className="text-sm text-primary">{t('assign.unassigned')}</span>
        ) : (
          <span className="block truncate text-sm text-muted">
            {sharers.map((p) => p.name).join(', ')}
          </span>
        )}
      </span>
      {sharers.length > 0 && <AvatarStack people={sharers} max={3} />}
      <span className="tabular shrink-0 font-display font-semibold">
        {format(item.lineTotalMinor)}
      </span>
    </span>
  );
}

function DraggableItem({
  item,
  sharers,
  onOpen,
}: {
  item: BillItem;
  sharers: Person[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { itemId: item.id },
  });
  return (
    <li id={`item-${item.id}`}>
      <button
        ref={setNodeRef}
        type="button"
        onClick={onOpen}
        {...listeners}
        {...attributes}
        className={`w-full touch-manipulation rounded-2xl ${isDragging ? 'opacity-30' : ''}`}
      >
        <ItemCardBody item={item} sharers={sharers} />
      </button>
    </li>
  );
}

export function AssignScreen() {
  const { t } = useTranslation();
  const { format } = useMoney();
  const data = useBill((s) => s.data);
  const go = useBill((s) => s.go);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [askUnassigned, setAskUnassigned] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const result = useMemo(() => computeBill(data), [data]);
  const remaining = unassignedItems(data);
  const peopleById = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const sharersOf = (itemId: string) =>
    (data.assignments[itemId] ?? []).flatMap((s) => {
      const p = peopleById.get(s.personId);
      return p && s.weight > 0 ? [p] : [];
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) =>
    setDragItem(String(e.active.data.current?.itemId ?? ''));
  const onDragEnd = (e: DragEndEvent) => {
    setDragItem(null);
    const itemId = e.active.data.current?.itemId as string | undefined;
    const personId = e.over?.data.current?.personId as string | undefined;
    if (!itemId || !personId) return;
    const item = data.items.find((i) => i.id === itemId);
    const person = peopleById.get(personId);
    if (!item || !person) return;
    addPersonToItem(itemId, personId);
    feedback('assign');
    toast(t('assign.dropped', { item: item.name, name: person.name }), { undoable: true });
  };

  const next = () => {
    if (remaining.length > 0) setAskUnassigned(true);
    else go('extras');
  };

  const dragged = dragItem ? data.items.find((i) => i.id === dragItem) : undefined;
  const sheetItem = openItem ? data.items.find((i) => i.id === openItem) : undefined;

  return (
    <Screen
      step="assign"
      title={t('assign.title')}
      subtitle={t('assign.subtitle')}
      actions={
        <div className="flex items-center gap-3">
          <p
            className={`min-w-0 flex-1 text-sm ${remaining.length ? 'text-muted' : 'text-success font-medium'}`}
            aria-live="polite"
          >
            {remaining.length > 0 ? (
              t('assign.left', { count: remaining.length })
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 aria-hidden className="size-4" />
                {t('assign.allDone')}
              </span>
            )}
          </p>
          <Button
            size="lg"
            onClick={next}
            icon={<ArrowRight aria-hidden className="order-last size-5" />}
          >
            {t('assign.next')}
          </Button>
        </div>
      }
    >
      <Composer />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragItem(null)}
      >
        <div className="sticky top-16 z-10 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md">
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t('steps.people')}>
            {data.people.map((person) => {
              const breakdown = result.people.find((p) => p.personId === person.id);
              return (
                <PersonDrop
                  key={person.id}
                  person={person}
                  subtotal={format(breakdown?.itemsMinor ?? 0)}
                />
              );
            })}
          </ul>
        </div>
        <p className="text-sm text-muted">{t('assign.dragHint')}</p>
        <ul ref={listRef} className="flex flex-col gap-2">
          {data.items.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              sharers={sharersOf(item.id)}
              onOpen={() => setOpenItem(item.id)}
            />
          ))}
        </ul>
        <DragOverlay dropAnimation={null}>
          {dragged ? (
            <ItemCardBody item={dragged} sharers={sharersOf(dragged.id)} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {sheetItem && (
        <ItemSheet key={sheetItem.id} item={sheetItem} onClose={() => setOpenItem(null)} />
      )}

      <Dialog
        open={askUnassigned}
        onClose={() => setAskUnassigned(false)}
        title={t('assign.unassignedTitle')}
        variant="center"
      >
        <p className="text-muted">{t('assign.unassignedBody', { count: remaining.length })}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={() => {
              setAskUnassigned(false);
              const first = remaining[0];
              if (first) {
                document
                  .getElementById(`item-${first.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setOpenItem(first.id);
              }
            }}
          >
            {t('assign.assignNow')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              splitRemainingEqually();
              setAskUnassigned(false);
              go('extras');
            }}
          >
            {t('assign.splitRest')}
          </Button>
        </div>
      </Dialog>
    </Screen>
  );
}
