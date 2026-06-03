import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ShotSpec } from '../../types'
import ShotCard from './ShotCard'

interface SortableShotProps {
  shot: ShotSpec
  idx: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<ShotSpec>) => void
  onDelete: () => void
  onOpenMatcher: () => void
  transitions: string[]
}

function SortableShot({
  shot,
  idx,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onOpenMatcher,
  transitions,
}: SortableShotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.index.toString() })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ShotCard
        shot={shot}
        isSelected={isSelected}
        dragHandleProps={{ ...attributes, ...listeners }}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpenMatcher={onOpenMatcher}
        transitions={transitions}
      />
    </div>
  )
}

interface StoryboardPanelProps {
  shots: ShotSpec[]
  selectedIndex: number | null
  onSelectShot: (index: number) => void
  onUpdateShot: (index: number, patch: Partial<ShotSpec>) => void
  onReorderShots: (from: number, to: number) => void
  onDeleteShot: (index: number) => void
  onAddShot: () => void
  onOpenMatcher: (index: number) => void
  transitions: string[]
}

export default function StoryboardPanel({
  shots,
  selectedIndex,
  onSelectShot,
  onUpdateShot,
  onReorderShots,
  onDeleteShot,
  onAddShot,
  onOpenMatcher,
  transitions,
}: StoryboardPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const fromIdx = shots.findIndex((s) => s.index.toString() === active.id)
      const toIdx = shots.findIndex((s) => s.index.toString() === over.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        onReorderShots(fromIdx, toIdx)
      }
    }
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={shots.map((s) => s.index.toString())}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {shots.map((shot, idx) => (
              <SortableShot
                key={shot.index}
                shot={shot}
                idx={idx}
                isSelected={selectedIndex === shot.index}
                onSelect={() => onSelectShot(shot.index)}
                onUpdate={(patch) => onUpdateShot(shot.index, patch)}
                onDelete={() => onDeleteShot(shot.index)}
                onOpenMatcher={() => onOpenMatcher(shot.index)}
                transitions={transitions}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={onAddShot}
        className="w-full mt-2 py-2.5 border border-dashed border-gray-700 rounded-xl
                   text-gray-500 hover:text-gray-300 hover:border-gray-500
                   transition-all text-sm"
      >
        + 添加分镜
      </button>
    </div>
  )
}