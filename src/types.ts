import type { DayLabel } from "./constants.ts";
export type { DayLabel };

export interface Lecture {
  id: string;
  title: string;
  credits: string;
  major: string;
  schedule: string;
  grade: number;
}

export interface Schedule {
  lecture: Lecture;
  day: DayLabel;
  range: readonly number[];
  room?: string;
}

export interface TimeInfo {
  day: DayLabel;
  time: number;
}

export interface ParsedScheduleItem {
  day: string;
  range: number[];
  room?: string;
}
