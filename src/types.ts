import { App, Plugin, TFile } from 'obsidian';
import { KindleReaderSettings } from './settings';

export interface BookProgress {
  pct: number;
  percent: number;
  lastRead: number;
  block?: number;
  page?: number;
}

export interface ProgressBackup {
  ts: number;
  pct: number;
  percent?: number;
  block?: number;
  page?: number;
}

export interface BookHighlight {
  id: string;
  text: string;
  color: string;
  block: number;
  occ: number;
  comment?: string;
  page?: number;
  ts?: number;
  cfi?: string;
}

export interface HighlightBackup {
  ts: number;
  count: number;
  data: BookHighlight[];
}

export type ThumbCache = Record<string, string>;

export type ReadingLog = Record<string, number>;

export interface DeviceProfile {
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  columns?: string;
  textAlign?: string;
  vAlign?: string;
  theme?: string;
  maxLineCh?: number;
}

export interface PluginSavedData {
  settings: KindleReaderSettings;
  progressBackups: Record<string, ProgressBackup[]>;
  highlightsBackups: Record<string, HighlightBackup[]>;
  lastBookPath: string;
}

export type BookExtension = 'epub' | 'pdf' | 'fb2';
