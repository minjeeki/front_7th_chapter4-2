import { ParsedScheduleItem } from "./types.ts";

export const fill2 = (n: number): string => `0${n}`.substr(-2);

export const parseHnM = (current: number): string => {
  const date = new Date(current);
  return `${fill2(date.getHours())}:${fill2(date.getMinutes())}`;
};

const getTimeRange = (value: string): number[] => {
  const [start, end] = value.split("~").map(Number);
  if (end === undefined || isNaN(end)) return [start];
  return Array(end - start + 1)
    .fill(start)
    .map((v, k) => v + k);
};

export const parseSchedule = (schedule: string): ParsedScheduleItem[] => {
  const schedules = schedule.split('<p>');
  return schedules.map(schedule => {
    const reg = /^([가-힣])(\d+(~\d+)?)(.*)/;

    const [day] = schedule.split(/(\d+)/);

    const range = getTimeRange(schedule.replace(reg, "$2"));

    const room = schedule.replace(reg, "$4")?.replace(/\(|\)/g, "");

    return { day, range, room: room || undefined };
  });
};
