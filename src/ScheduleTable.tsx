import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Text,
} from "@chakra-ui/react";
import { CellSize, DAY_LABELS, 분 } from "./constants.ts";
import { Schedule, TimeInfo } from "./types.ts";
import { fill2, parseHnM } from "./utils.ts";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ComponentProps, Fragment, memo, useMemo } from "react";
import { useActiveTableId } from "./ScheduleDndProvider.tsx";

interface Props {
  tableId: string;
  schedules: readonly Schedule[];
  onScheduleTimeClick?: (timeInfo: TimeInfo) => void;
  onDeleteButtonClick?: (timeInfo: TimeInfo) => void;
}

const TIMES = [
  ...Array(18)
    .fill(0)
    .map((v, k) => v + k * 30 * 분)
    .map((v) => `${parseHnM(v)}~${parseHnM(v + 30 * 분)}`),

  ...Array(6)
    .fill(18 * 30 * 분)
    .map((v, k) => v + k * 55 * 분)
    .map((v) => `${parseHnM(v)}~${parseHnM(v + 50 * 분)}`),
] as const;

// 드래그 중인 테이블 outline만 표시하는 별도 컴포넌트
// useActiveTableId를 사용하여 드래그 중 transform 변경에 반응하지 않음
const ActiveTableOutline = memo(({ tableId }: { tableId: string }) => {
  const activeTableId = useActiveTableId();
  const isActive = activeTableId === tableId;

  if (!isActive) return null;

  return (
    <Box
      position="absolute"
      inset={0}
      outline="5px dashed"
      outlineColor="blue.300"
      pointerEvents="none"
      zIndex={1}
    />
  );
});

ActiveTableOutline.displayName = 'ActiveTableOutline';

const ScheduleTableComponent = ({ tableId, schedules, onScheduleTimeClick, onDeleteButtonClick }: Props) => {

  const getColor = useMemo(() => {
    const lectureColorMap = new Map<string, string>();
    const lectures = [...new Set(schedules.map(({ lecture }) => lecture.id))];
    const colors = ["#fdd", "#ffd", "#dff", "#ddf", "#fdf", "#dfd"];
    lectures.forEach((lectureId, index) => {
      lectureColorMap.set(lectureId, colors[index % colors.length]);
    });
    return (lectureId: string): string => {
      return lectureColorMap.get(lectureId) || colors[0];
    };
  }, [schedules]);

  return (
    <Box position="relative">
      <ActiveTableOutline tableId={tableId} />
      <Grid
        templateColumns={`120px repeat(${DAY_LABELS.length}, ${CellSize.WIDTH}px)`}
        templateRows={`40px repeat(${TIMES.length}, ${CellSize.HEIGHT}px)`}
        bg="white"
        fontSize="sm"
        textAlign="center"
        outline="1px solid"
        outlineColor="gray.300"
      >
        <GridItem key="교시" borderColor="gray.300" bg="gray.100">
          <Flex justifyContent="center" alignItems="center" h="full" w="full">
            <Text fontWeight="bold">교시</Text>
          </Flex>
        </GridItem>
        {DAY_LABELS.map((day) => (
          <GridItem key={day} borderLeft="1px" borderColor="gray.300" bg="gray.100">
            <Flex justifyContent="center" alignItems="center" h="full">
              <Text fontWeight="bold">{day}</Text>
            </Flex>
          </GridItem>
        ))}
        {TIMES.map((time, timeIndex) => (
          <Fragment key={`시간-${timeIndex + 1}`}>
            <GridItem
              borderTop="1px solid"
              borderColor="gray.300"
              bg={timeIndex > 17 ? 'gray.200' : 'gray.100'}
            >
              <Flex justifyContent="center" alignItems="center" h="full">
                <Text fontSize="xs">{fill2(timeIndex + 1)} ({time})</Text>
              </Flex>
            </GridItem>
            {DAY_LABELS.map((day) => (
              <GridItem
                key={`${day}-${timeIndex + 2}`}
                borderWidth="1px 0 0 1px"
                borderColor="gray.300"
                bg={timeIndex > 17 ? 'gray.100' : 'white'}
                cursor="pointer"
                _hover={{ bg: 'yellow.100' }}
                onClick={() => onScheduleTimeClick?.({ day, time: timeIndex + 1 })}
              />
            ))}
          </Fragment>
        ))}
      </Grid>

      {schedules.map((schedule, index) => (
        <DraggableSchedule
          key={`${schedule.lecture.title}-${index}`}
          id={`${tableId}:${index}`}
          data={schedule}
          bg={getColor(schedule.lecture.id)}
          onDeleteButtonClick={() => onDeleteButtonClick?.({
            day: schedule.day,
            time: schedule.range[0],
          })}
        />
      ))}
    </Box>
  );
};

ScheduleTableComponent.displayName = 'ScheduleTable';

// 커스텀 비교 함수로 불필요한 리렌더링 방지
const areEqual = (prevProps: Props, nextProps: Props) => {
  // tableId가 변경되면 리렌더링
  if (prevProps.tableId !== nextProps.tableId) return false;
  
  // schedules 배열의 길이나 내용이 변경되면 리렌더링
  if (prevProps.schedules.length !== nextProps.schedules.length) return false;
  
  // schedules의 각 항목을 비교
  for (let i = 0; i < prevProps.schedules.length; i++) {
    const prev = prevProps.schedules[i];
    const next = nextProps.schedules[i];
    if (
      prev.lecture.id !== next.lecture.id ||
      prev.day !== next.day ||
      prev.room !== next.room ||
      JSON.stringify(prev.range) !== JSON.stringify(next.range)
    ) {
      return false;
    }
  }
  
  // 함수 참조는 변경될 수 있지만, 실제로는 동일한 동작을 하므로 무시
  // (onScheduleTimeClick, onDeleteButtonClick)
  
  return true;
};

// 커스텀 비교 함수를 사용하여 메모이제이션
const ScheduleTable = memo(ScheduleTableComponent, areEqual);

const DraggableSchedule = memo(({
 id,
 data,
 bg,
 onDeleteButtonClick
}: { id: string; data: Schedule } & ComponentProps<typeof Box> & {
  onDeleteButtonClick: () => void
}) => {
  const { day, range, room, lecture } = data;
  const { attributes, setNodeRef, listeners, transform } = useDraggable({ id });
  const leftIndex = DAY_LABELS.indexOf(day);
  const topIndex = range[0] - 1;
  const size = range.length;

  const style = useMemo(() => ({
    position: 'absolute' as const,
    left: `${120 + (CellSize.WIDTH * leftIndex) + 1}px`,
    top: `${40 + (topIndex * CellSize.HEIGHT + 1)}px`,
    width: `${CellSize.WIDTH - 1}px`,
    height: `${CellSize.HEIGHT * size - 1}px`,
    transform: CSS.Translate.toString(transform),
  }), [leftIndex, topIndex, size, transform]);

  return (
    <Popover>
      <PopoverTrigger>
        <Box
          {...style}
          bg={bg}
          p={1}
          boxSizing="border-box"
          cursor="pointer"
          ref={setNodeRef}
          {...listeners}
          {...attributes}
        >
          <Text fontSize="sm" fontWeight="bold">{lecture.title}</Text>
          <Text fontSize="xs">{room}</Text>
        </Box>
      </PopoverTrigger>
      <PopoverContent onClick={event => event.stopPropagation()}>
        <PopoverArrow/>
        <PopoverCloseButton/>
        <PopoverBody>
          <Text>강의를 삭제하시겠습니까?</Text>
          <Button colorScheme="red" size="xs" onClick={onDeleteButtonClick}>
            삭제
          </Button>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
});

DraggableSchedule.displayName = 'DraggableSchedule';

export default ScheduleTable;
