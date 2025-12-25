import React, { createContext, PropsWithChildren, useContext, useState, useCallback, useMemo } from "react";
import { Schedule } from "./types.ts";
import dummyScheduleMap from "./dummyScheduleMap.ts";

interface ScheduleContextType {
  schedulesMap: Record<string, Schedule[]>;
  setSchedulesMap: React.Dispatch<React.SetStateAction<Record<string, Schedule[]>>>;
  // 특정 테이블의 schedules만 업데이트하는 함수 (다른 테이블은 기존 참조 유지)
  updateTableSchedules: (tableId: string, updater: (prev: Schedule[]) => Schedule[]) => void;
  // 특정 테이블의 schedules를 가져오는 함수 (메모이제이션된 값 반환)
  getTableSchedules: (tableId: string) => Schedule[];
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const useScheduleContext = () => {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};

export const ScheduleProvider = ({ children }: PropsWithChildren) => {
  const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule[]>>(dummyScheduleMap);

  // 특정 테이블의 schedules만 업데이트 (다른 테이블은 기존 참조 유지)
  const updateTableSchedules = useCallback((tableId: string, updater: (prev: Schedule[]) => Schedule[]) => {
    setSchedulesMap((prev) => {
      const currentSchedules = prev[tableId];
      if (!currentSchedules) return prev;
      
      const newSchedules = updater(currentSchedules);
      
      // schedules 배열이 실제로 변경되었는지 확인
      if (currentSchedules === newSchedules) {
        return prev; // 변경사항이 없으면 기존 객체 반환
      }
      
      // 변경된 테이블만 새로운 배열로, 나머지는 기존 참조 유지
      return {
        ...prev,
        [tableId]: newSchedules,
      };
    });
  }, []);

  // 특정 테이블의 schedules를 가져오는 함수 (메모이제이션은 사용하는 쪽에서 처리)
  const getTableSchedules = useCallback((tableId: string) => {
    return schedulesMap[tableId] || [];
  }, [schedulesMap]);

  const contextValue = useMemo(() => ({
    schedulesMap,
    setSchedulesMap,
    updateTableSchedules,
    getTableSchedules,
  }), [schedulesMap, updateTableSchedules, getTableSchedules]);

  return (
    <ScheduleContext.Provider value={contextValue}>
      {children}
    </ScheduleContext.Provider>
  );
};
