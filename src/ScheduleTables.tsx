import { Button, ButtonGroup, Flex, Heading, Stack } from "@chakra-ui/react";
import ScheduleTable from "./ScheduleTable.tsx";
import { useScheduleContext } from "./ScheduleContext.tsx";
import SearchDialog from "./SearchDialog.tsx";
import { useState, useCallback, useMemo, memo } from "react";
import { Schedule } from "./types.ts";

// 각 테이블의 schedules를 개별적으로 메모이제이션하는 컴포넌트
const MemoizedScheduleTableItem = memo(({ 
  tableId, 
  schedules, 
  index,
  onScheduleTimeClick,
  onDeleteButtonClick,
  onDuplicate,
  onRemove,
  disabledRemoveButton,
  onSearchClick,
}: {
  tableId: string;
  schedules: Schedule[];
  index: number;
  onScheduleTimeClick: (timeInfo: { day: string, time: number }) => void;
  onDeleteButtonClick: (timeInfo: { day: string, time: number }) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  disabledRemoveButton: boolean;
  onSearchClick: () => void;
}) => {
  return (
    <Stack key={tableId} width="600px">
      <Flex justifyContent="space-between" alignItems="center">
        <Heading as="h3" fontSize="lg">시간표 {index + 1}</Heading>
        <ButtonGroup size="sm" isAttached>
          <Button colorScheme="green" onClick={onSearchClick}>시간표 추가</Button>
          <Button colorScheme="green" mx="1px" onClick={onDuplicate}>복제</Button>
          <Button colorScheme="green" isDisabled={disabledRemoveButton}
                  onClick={onRemove}>삭제</Button>
        </ButtonGroup>
      </Flex>
      <ScheduleTable
        schedules={schedules}
        tableId={tableId}
        onScheduleTimeClick={onScheduleTimeClick}
        onDeleteButtonClick={onDeleteButtonClick}
      />
    </Stack>
  );
}, (prevProps: {
  tableId: string;
  schedules: Schedule[];
  index: number;
  disabledRemoveButton: boolean;
}, nextProps: {
  tableId: string;
  schedules: Schedule[];
  index: number;
  disabledRemoveButton: boolean;
}) => {
  // tableId와 index가 같고, schedules 배열이 동일한 참조이면 리렌더링하지 않음
  if (prevProps.tableId !== nextProps.tableId) return false;
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.schedules !== nextProps.schedules) return false;
  if (prevProps.disabledRemoveButton !== nextProps.disabledRemoveButton) return false;
  // 함수 참조는 무시 (항상 동일한 동작)
  return true;
});

MemoizedScheduleTableItem.displayName = 'MemoizedScheduleTableItem';

export const ScheduleTables = () => {
  const { schedulesMap, setSchedulesMap, updateTableSchedules } = useScheduleContext();
  const [searchInfo, setSearchInfo] = useState<{
    tableId: string;
    day?: string;
    time?: number;
  } | null>(null);

  const disabledRemoveButton = useMemo(() => Object.keys(schedulesMap).length === 1, [schedulesMap]);

  const duplicate = useCallback((targetId: string) => {
    setSchedulesMap(prev => ({
      ...prev,
      [`schedule-${Date.now()}`]: [...prev[targetId]]
    }))
  }, [setSchedulesMap]);

  const remove = useCallback((targetId: string) => {
    setSchedulesMap(prev => {
      const newMap = { ...prev };
      delete newMap[targetId];
      return newMap;
    })
  }, [setSchedulesMap]);

  const handleScheduleTimeClick = useCallback((tableId: string) => (timeInfo: { day: string, time: number }) => {
    setSearchInfo({ tableId, ...timeInfo });
  }, []);

  const handleDeleteButtonClick = useCallback((tableId: string) => ({ day, time }: { day: string, time: number }) => {
    updateTableSchedules(tableId, (schedules) => 
      schedules.filter(schedule => schedule.day !== day || !schedule.range.includes(time))
    );
  }, [updateTableSchedules]);

  // 각 테이블의 schedules를 개별적으로 메모이제이션
  const scheduleEntries = useMemo(() => {
    return Object.entries(schedulesMap).map(([tableId, schedules]) => ({
      tableId,
      schedules, // 각 테이블의 schedules 배열 참조를 그대로 유지
    }));
  }, [schedulesMap]);

  return (
    <>
      <Flex w="full" gap={6} p={6} flexWrap="wrap">
        {scheduleEntries.map(({ tableId, schedules }, index) => (
          <MemoizedScheduleTableItem
            key={tableId}
            tableId={tableId}
            schedules={schedules}
            index={index}
            onScheduleTimeClick={handleScheduleTimeClick(tableId)}
            onDeleteButtonClick={handleDeleteButtonClick(tableId)}
            onDuplicate={() => duplicate(tableId)}
            onRemove={() => remove(tableId)}
            disabledRemoveButton={disabledRemoveButton}
            onSearchClick={() => setSearchInfo({ tableId })}
          />
        ))}
      </Flex>
      <SearchDialog searchInfo={searchInfo} onClose={() => setSearchInfo(null)}/>
    </>
  );
}
