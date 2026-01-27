// packages/shared/index.ts
export type CardValue = 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 15 | 20 | 25;

export interface Player {
  id: string;
  name: string;
  hand: CardValue[];
  spent: number;
}
