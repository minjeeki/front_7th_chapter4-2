import { DndContext, Modifier, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { PropsWithChildren, useCallback, useMemo, useState, createContext, useContext, memo } from "react";
import { CellSize, DAY_LABELS } from "./constants.ts";
import { useScheduleContext } from "./ScheduleContext.tsx";

// 드래그 중인 테이블 ID만 관리하는 컨텍스트
const ActiveTableIdContext = createContext<string | null>(null);

export const useActiveTableId = () => {
  return useContext(ActiveTableIdContext);
};

function createSnapModifier(): Modifier {
  return ({ transform, containerNodeRect, draggingNodeRect }) => {
    const containerTop = containerNodeRect?.top ?? 0;
    const containerLeft = containerNodeRect?.left ?? 0;
    const containerBottom = containerNodeRect?.bottom ?? 0;
    const containerRight = containerNodeRect?.right ?? 0;

    const { top = 0, left = 0, bottom = 0, right = 0 } = draggingNodeRect ?? {};

    const minX = containerLeft - left + 120 + 1;
    const minY = containerTop - top + 40 + 1;
    const maxX = containerRight - right;
    const maxY = containerBottom - bottom;


    return ({
      ...transform,
      x: Math.min(Math.max(Math.round(transform.x / CellSize.WIDTH) * CellSize.WIDTH, minX), maxX),
      y: Math.min(Math.max(Math.round(transform.y / CellSize.HEIGHT) * CellSize.HEIGHT, minY), maxY),
    })
  };
}

const modifiers = [createSnapModifier()]

function ScheduleDndProvider({ children }: PropsWithChildren) {
  const { updateTableSchedules } = useScheduleContext();
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStart = useCallback((event: any) => {
    const { active } = event;
    const [tableId] = String(active.id).split(':');
    setActiveTableId(tableId);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = useCallback((event: any) => {
    const { active, delta } = event;
    const { x, y } = delta;
    const [tableId, index] = String(active.id).split(':');
    const scheduleIndex = Number(index);
    
    // 특정 테이블만 업데이트 (다른 테이블은 기존 참조 유지)
    updateTableSchedules(tableId, (schedules) => {
      const schedule = schedules[scheduleIndex];
      if (!schedule) return schedules;
      
      const nowDayIndex = DAY_LABELS.indexOf(schedule.day as typeof DAY_LABELS[number])
      const moveDayIndex = Math.floor(x / 80);
      const moveTimeIndex = Math.floor(y / 30);

      // 변경된 스케줄만 새로운 객체로, 나머지는 기존 참조 유지
      return schedules.map((targetSchedule, targetIndex) => {
        if (targetIndex !== scheduleIndex) {
          return targetSchedule; // 기존 참조 유지
        }
        return {
          ...targetSchedule,
          day: DAY_LABELS[nowDayIndex + moveDayIndex],
          range: targetSchedule.range.map(time => time + moveTimeIndex),
        }
      });
    });
    
    setActiveTableId(null);
  }, [updateTableSchedules]);

  const handleDragCancel = useCallback(() => {
    setActiveTableId(null);
  }, []);

  const memoizedSensors = useMemo(() => sensors, [sensors]);
  
  // activeTableId를 메모이제이션하여 불필요한 리렌더링 방지
  const contextValue = useMemo(() => activeTableId, [activeTableId]);

  return (
    <ActiveTableIdContext.Provider value={contextValue}>
      <DndContext 
        sensors={memoizedSensors} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={modifiers}
      >
        {children}
      </DndContext>
    </ActiveTableIdContext.Provider>
  );
}

// ScheduleDndProvider를 memo로 감싸서 불필요한 리렌더링 방지
// 단, children이 변경되면 리렌더링되어야 하므로 주의
export default memo(ScheduleDndProvider);
