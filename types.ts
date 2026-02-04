
export interface CharacterInfo {
  identity: string;
  occupation: string;
  gender: string;
  family: string;
}

export interface GameState {
  age: number;
  debt: number;
  fico: number;
  san: number;
  cr: number;
  status: string;
  character?: CharacterInfo;
  turn: number; // 月份：1-36
  history: string[];
  isGameOver: boolean;
  isVictory: boolean;
  gameOverReason: string;
  achievement?: string;
  achievementImageUrl?: string; // 新增成就图片字段
  inventory: string[];
  buffs: string[];
  // 恢复事件触发标志
  hasTriggeredSanRecovery: boolean;
  hasTriggeredFicoRecovery: boolean;
  hasTriggeredCrRecovery: boolean;
}

export interface Choice {
  id: 'A' | 'B' | 'C';
  text: string;
  prediction: string;
}

export interface GameTurn {
  narrative: string;
  statusText: string;
  options: Choice[];
}
