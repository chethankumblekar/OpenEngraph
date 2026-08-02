export interface GraphResult {
  id: string;
  kind: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  via: 'graph' | 'embedding';
}
