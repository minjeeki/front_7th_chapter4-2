import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { useScheduleContext } from "./ScheduleContext.tsx";
import { Lecture } from "./types.ts";
import { parseSchedule } from "./utils.ts";
import axios, { AxiosResponse } from "axios";
import { DAY_LABELS } from "./constants.ts";

interface Props {
  searchInfo: {
    tableId: string;
    day?: string;
    time?: number;
  } | null;
  onClose: () => void;
}

interface SearchOption {
  query?: string,
  grades: number[],
  days: string[],
  times: number[],
  majors: string[],
  credits?: number,
}

const TIME_SLOTS = [
  { id: 1, label: "09:00~09:30" },
  { id: 2, label: "09:30~10:00" },
  { id: 3, label: "10:00~10:30" },
  { id: 4, label: "10:30~11:00" },
  { id: 5, label: "11:00~11:30" },
  { id: 6, label: "11:30~12:00" },
  { id: 7, label: "12:00~12:30" },
  { id: 8, label: "12:30~13:00" },
  { id: 9, label: "13:00~13:30" },
  { id: 10, label: "13:30~14:00" },
  { id: 11, label: "14:00~14:30" },
  { id: 12, label: "14:30~15:00" },
  { id: 13, label: "15:00~15:30" },
  { id: 14, label: "15:30~16:00" },
  { id: 15, label: "16:00~16:30" },
  { id: 16, label: "16:30~17:00" },
  { id: 17, label: "17:00~17:30" },
  { id: 18, label: "17:30~18:00" },
  { id: 19, label: "18:00~18:50" },
  { id: 20, label: "18:55~19:45" },
  { id: 21, label: "19:50~20:40" },
  { id: 22, label: "20:45~21:35" },
  { id: 23, label: "21:40~22:30" },
  { id: 24, label: "22:35~23:25" },
];

const PAGE_SIZE = 100;

const fetchMajors = () => axios.get<Lecture[]>('/schedules-majors.json');
const fetchLiberalArts = () => axios.get<Lecture[]>('/schedules-liberal-arts.json');

// 클로저를 이용한 캐시 메커니즘으로 중복 API 호출 방지 + 병렬 실행
const fetchAllLectures = (() => {
  const cache = new Map<string, Promise<AxiosResponse<Lecture[]>>>();
  
  const getCachedPromise = (key: string, fetcher: () => Promise<AxiosResponse<Lecture[]>>, callNumber: number) => {
    let promise = cache.get(key);
    if (promise) {
      console.log(`API Call ${callNumber}: ${key} (캐시 사용)`, performance.now());
    } else {
      console.log(`API Call ${callNumber}: ${key} (새로 호출)`, performance.now());
      promise = fetcher();
      cache.set(key, promise);
    }
    return promise;
  };
  
  return async () => {
    const majorsKey = 'majors';
    const liberalArtsKey = 'liberal-arts';
    
    return Promise.all([
      getCachedPromise(majorsKey, fetchMajors, 1),
      getCachedPromise(liberalArtsKey, fetchLiberalArts, 2),
      getCachedPromise(majorsKey, fetchMajors, 3),
      getCachedPromise(liberalArtsKey, fetchLiberalArts, 4),
      getCachedPromise(majorsKey, fetchMajors, 5),
      getCachedPromise(liberalArtsKey, fetchLiberalArts, 6),
    ]);
  };
})();

// LectureRow: 테이블의 각 행을 렌더링하는 컴포넌트
interface LectureRowProps {
  lecture: Lecture;
  index: number;
  onAddSchedule: (lecture: Lecture) => void;
}

const LectureRow = ({ lecture, index, onAddSchedule }: LectureRowProps) => {
  return (
    <Tr key={`${lecture.id}-${index}`}>
      <Td width="100px">{lecture.id}</Td>
      <Td width="50px">{lecture.grade}</Td>
      <Td width="200px">{lecture.title}</Td>
      <Td width="50px">{lecture.credits}</Td>
      <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.major }}/>
      <Td width="150px" dangerouslySetInnerHTML={{ __html: lecture.schedule }}/>
      <Td width="80px">
        <Button size="sm" colorScheme="green" onClick={() => onAddSchedule(lecture)}>추가</Button>
      </Td>
    </Tr>
  );
};

// MajorSelector: 전공 선택을 담당하는 컴포넌트
interface MajorSelectorProps {
  majors: string[];
  selectedMajors: string[];
  onMajorChange: (majors: string[]) => void;
}

const MajorSelector = ({ majors, selectedMajors, onMajorChange }: MajorSelectorProps) => {
  return (
    <FormControl>
      <FormLabel>전공</FormLabel>
      <CheckboxGroup
        colorScheme="green"
        value={selectedMajors}
        onChange={(values) => onMajorChange(values as string[])}
      >
        <Wrap spacing={1} mb={2}>
          {selectedMajors.map(major => (
            <Tag key={major} size="sm" variant="outline" colorScheme="blue">
              <TagLabel>{major.split("<p>").pop()}</TagLabel>
              <TagCloseButton
                onClick={() => onMajorChange(selectedMajors.filter(v => v !== major))}/>
            </Tag>
          ))}
        </Wrap>
        <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200"
               borderRadius={5} p={2}>
          {majors.map(major => (
            <Box key={major}>
              <Checkbox key={major} size="sm" value={major}>
                {major.replace(/<p>/gi, ' ')}
              </Checkbox>
            </Box>
          ))}
        </Stack>
      </CheckboxGroup>
    </FormControl>
  );
};

// LectureTable: 검색 결과 테이블을 담당하는 컴포넌트
interface LectureTableProps {
  lectures: Lecture[];
  loaderWrapperRef: React.RefObject<HTMLDivElement | null>;
  loaderRef: React.RefObject<HTMLDivElement | null>;
  onAddSchedule: (lecture: Lecture) => void;
}

const LectureTable = ({ lectures, loaderWrapperRef, loaderRef, onAddSchedule }: LectureTableProps) => {
  return (
    <Box>
      <Table>
        <Thead>
          <Tr>
            <Th width="100px">과목코드</Th>
            <Th width="50px">학년</Th>
            <Th width="200px">과목명</Th>
            <Th width="50px">학점</Th>
            <Th width="150px">전공</Th>
            <Th width="150px">시간</Th>
            <Th width="80px"></Th>
          </Tr>
        </Thead>
      </Table>

      <Box overflowY="auto" maxH="500px" ref={loaderWrapperRef}>
        <Table size="sm" variant="striped">
          <Tbody>
            {lectures.map((lecture, index) => (
              <LectureRow
                key={`${lecture.id}-${index}`}
                lecture={lecture}
                index={index}
                onAddSchedule={onAddSchedule}
              />
            ))}
          </Tbody>
        </Table>
        <Box ref={loaderRef} h="20px"/>
      </Box>
    </Box>
  );
};

// SearchForm: 검색 옵션 폼을 담당하는 컴포넌트
interface SearchFormProps {
  searchOptions: SearchOption;
  allMajors: string[];
  onSearchOptionChange: (field: keyof SearchOption, value: SearchOption[keyof SearchOption]) => void;
}

const SearchForm = ({ searchOptions, allMajors, onSearchOptionChange }: SearchFormProps) => {
  return (
    <>
      <HStack spacing={4}>
        <FormControl>
          <FormLabel>검색어</FormLabel>
          <Input
            placeholder="과목명 또는 과목코드"
            value={searchOptions.query}
            onChange={(e) => onSearchOptionChange('query', e.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel>학점</FormLabel>
          <Select
            value={searchOptions.credits}
            onChange={(e) => onSearchOptionChange('credits', e.target.value)}
          >
            <option value="">전체</option>
            <option value="1">1학점</option>
            <option value="2">2학점</option>
            <option value="3">3학점</option>
          </Select>
        </FormControl>
      </HStack>

      <HStack spacing={4}>
        <FormControl>
          <FormLabel>학년</FormLabel>
          <CheckboxGroup
            value={searchOptions.grades}
            onChange={(value) => onSearchOptionChange('grades', value.map(Number))}
          >
            <HStack spacing={4}>
              {[1, 2, 3, 4].map(grade => (
                <Checkbox key={grade} value={grade}>{grade}학년</Checkbox>
              ))}
            </HStack>
          </CheckboxGroup>
        </FormControl>

        <FormControl>
          <FormLabel>요일</FormLabel>
          <CheckboxGroup
            value={searchOptions.days}
            onChange={(value) => onSearchOptionChange('days', value as string[])}
          >
            <HStack spacing={4}>
              {DAY_LABELS.map(day => (
                <Checkbox key={day} value={day}>{day}</Checkbox>
              ))}
            </HStack>
          </CheckboxGroup>
        </FormControl>
      </HStack>

      <HStack spacing={4}>
        <FormControl>
          <FormLabel>시간</FormLabel>
          <CheckboxGroup
            colorScheme="green"
            value={searchOptions.times}
            onChange={(values) => onSearchOptionChange('times', values.map(Number))}
          >
            <Wrap spacing={1} mb={2}>
              {[...searchOptions.times].sort((a, b) => a - b).map(time => (
                <Tag key={time} size="sm" variant="outline" colorScheme="blue">
                  <TagLabel>{time}교시</TagLabel>
                  <TagCloseButton
                    onClick={() => onSearchOptionChange('times', searchOptions.times.filter(v => v !== time))}/>
                </Tag>
              ))}
            </Wrap>
            <Stack spacing={2} overflowY="auto" h="100px" border="1px solid" borderColor="gray.200"
                   borderRadius={5} p={2}>
              {TIME_SLOTS.map(({ id, label }) => (
                <Box key={id}>
                  <Checkbox key={id} size="sm" value={id}>
                    {id}교시({label})
                  </Checkbox>
                </Box>
              ))}
            </Stack>
          </CheckboxGroup>
        </FormControl>

        <MajorSelector
          majors={allMajors}
          selectedMajors={searchOptions.majors}
          onMajorChange={(majors) => onSearchOptionChange('majors', majors)}
        />
      </HStack>
    </>
  );
};

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { setSchedulesMap } = useScheduleContext();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: '',
    grades: [],
    days: [],
    times: [],
    majors: [],
  });

  const getFilteredLectures = () => {
    const { query = '', credits, grades, days, times, majors } = searchOptions;
    return lectures
      .filter(lecture =>
        lecture.title.toLowerCase().includes(query.toLowerCase()) ||
        lecture.id.toLowerCase().includes(query.toLowerCase())
      )
      .filter(lecture => grades.length === 0 || grades.includes(lecture.grade))
      .filter(lecture => majors.length === 0 || majors.includes(lecture.major))
      .filter(lecture => !credits || lecture.credits.startsWith(String(credits)))
      .filter(lecture => {
        if (days.length === 0) {
          return true;
        }
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => days.includes(s.day));
      })
      .filter(lecture => {
        if (times.length === 0) {
          return true;
        }
        const schedules = lecture.schedule ? parseSchedule(lecture.schedule) : [];
        return schedules.some(s => s.range.some(time => times.includes(time)));
      });
  }

  const filteredLectures = getFilteredLectures();
  const lastPage = Math.ceil(filteredLectures.length / PAGE_SIZE);
  const visibleLectures = filteredLectures.slice(0, page * PAGE_SIZE);
  const allMajors = [...new Set(lectures.map(lecture => lecture.major))];

  const changeSearchOption = (field: keyof SearchOption, value: SearchOption[typeof field]) => {
    setPage(1);
    setSearchOptions(({ ...searchOptions, [field]: value }));
    loaderWrapperRef.current?.scrollTo(0, 0);
  };

  const addSchedule = (lecture: Lecture) => {
    if (!searchInfo) return;

    const { tableId } = searchInfo;

    const schedules = parseSchedule(lecture.schedule).map(schedule => ({
      ...schedule,
      lecture
    }));

    setSchedulesMap(prev => ({
      ...prev,
      [tableId]: [...prev[tableId], ...schedules]
    }));

    onClose();
  };

  useEffect(() => {
    const start = performance.now();
    console.log('API 호출 시작: ', start)
    fetchAllLectures().then(results => {
      const end = performance.now();
      console.log('모든 API 호출 완료 ', end)
      console.log('API 호출에 걸린 시간(ms): ', end - start)
      setLectures(results.flatMap(result => result.data));
    })
  }, []);

  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setPage(prevPage => Math.min(lastPage, prevPage + 1));
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);

    return () => observer.unobserve($loader);
  }, [lastPage]);

  useEffect(() => {
    setSearchOptions(prev => ({
      ...prev,
      days: searchInfo?.day ? [searchInfo.day] : [],
      times: searchInfo?.time ? [searchInfo.time] : [],
    }))
    setPage(1);
  }, [searchInfo]);

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay/>
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton/>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <SearchForm
              searchOptions={searchOptions}
              allMajors={allMajors}
              onSearchOptionChange={changeSearchOption}
            />
            <Text align="right">
              검색결과: {filteredLectures.length}개
            </Text>
            <LectureTable
              lectures={visibleLectures}
              loaderWrapperRef={loaderWrapperRef}
              loaderRef={loaderRef}
              onAddSchedule={addSchedule}
            />
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SearchDialog;