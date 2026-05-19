export interface Task {
  id: number;
  text: string;
  done: boolean;
}

export interface List {
  id: number;
  name: string;
  tasks: Task[];
  notes: string;
}

export type Filter = 'all' | 'active' | 'done';
export type Theme = 'light' | 'dark';

export interface LogEntry {
  id: number;
  message: string;
  timestamp: string;
}
