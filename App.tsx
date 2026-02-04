
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GameTurn, CharacterInfo } from './types';
import { generateTurnData, generateAchievementImage } from './geminiService';

const ROLES = [
  { identity: '破产学生', occupation: '外卖骑手', family: '独居', baseDebt: 70000, baseFico: 550, age: 20 },
  { identity: '单亲妈妈', occupation: '钟点工', family: '三个孩子', baseDebt: 45000, baseFico: 610, age: 32 },
  { identity: '失业职员', occupation: '网约车司机', family: '患病双亲', baseDebt: 120000, baseFico: 700, age: 40 },
  { identity: '退伍士兵', occupation: '夜班保安', family: '无', baseDebt: 25000, baseFico: 500, age: 45 },
  { identity: '滞留者', occupation: '后厨洗碗', family: '远方亲人', baseDebt: 15000, baseFico: 420, age: 26 },
];

const WEALTHY_ROLE = { identity: '幸运儿', occupation: '分析师', family: '富裕', baseDebt: -50000, baseFico: 800, age: 24 };

const GENDERS = ['男性', '女性', '非二元'];

const NEW_JOBS = ['夜店保镖', '实验体', '清理工', '散工', '街头艺人', '收割者'];

const StatusBar: React.FC<{ state: GameState }> = ({ state }) => {
  const isHighRisk = state.cr >= 35;
  const isLethal = state.cr >= 63;

  return (
    <div className="flex flex-col gap-1 mb-2">
      {/* Primary Dashboard */}
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-blue-900/20 border border-blue-500/30 p-1 flex flex-col items-center">
          <span className="text-[10px] text-blue-400 font-bold uppercase leading-none">信用</span>
          <span className="text-sm font-black text-white">{state.fico}</span>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 p-1 flex flex-col items-center col-span-1">
          <span className="text-[10px] text-blue-400 font-bold uppercase leading-none">财务</span>
          <span className={`text-sm font-black ${state.debt < 0 ? 'text-green-500' : 'text-white'}`}>
             ${Math.abs(state.debt).toLocaleString()}
          </span>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 p-1 flex flex-col items-center">
          <span className="text-[10px] text-blue-400 font-bold uppercase leading-none">SAN</span>
          <span className={`text-sm font-black ${state.san < 30 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>{state.san}</span>
        </div>
      </div>

      {/* CR Risk Bar - Vertical pixels are precious */}
      <div className={`border p-1 ${isLethal ? 'bg-red-900/30 border-red-500' : isHighRisk ? 'bg-orange-900/30 border-orange-500' : 'bg-black border-blue-500/50'}`}>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-blue-400 italic">崩溃风险系数</span>
          <span className={`text-xs font-black ${isHighRisk ? 'text-orange-500 animate-pulse' : 'text-blue-500'}`}>
            {state.cr}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-white/5 mt-0.5 border border-blue-900/30">
          <div 
            className={`h-full transition-all duration-1000 ${isHighRisk ? 'bg-orange-600' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]'}`}
            style={{ width: `${Math.min(state.cr, 100)}%` }}
          />
        </div>
      </div>
      
      {/* Identity Label */}
      <div className="text-[10px] font-bold text-blue-500/70 text-center uppercase tracking-tighter">
        {state.character?.identity} / {state.character?.occupation} / {state.turn}M
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'start' | 'roll' | 'playing' | 'end'>('start');
  const [state, setState] = useState<GameState | null>(null);
  const [turnData, setTurnData] = useState<GameTurn | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAchievement, setLoadingAchievement] = useState(false);

  const rollCharacter = () => {
    const isLucky = Math.random() < 0.1;
    const role = isLucky ? WEALTHY_ROLE : ROLES[Math.floor(Math.random() * ROLES.length)];
    const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
    
    const newState: GameState = {
      age: role.age + Math.floor(Math.random() * 5),
      debt: role.baseDebt,
      fico: role.baseFico,
      san: 100,
      cr: 5,
      status: '活动中',
      character: {
        identity: role.identity,
        occupation: role.occupation,
        gender: gender,
        family: role.family
      },
      turn: 1,
      history: [],
      isGameOver: false,
      isVictory: false,
      gameOverReason: '',
      inventory: [],
      buffs: [],
      hasTriggeredSanRecovery: false,
      hasTriggeredFicoRecovery: false,
      hasTriggeredCrRecovery: false
    };
    setState(newState);
    setView('roll');
  };

  const startGame = () => {
    if (!state) return;
    setView('playing');
    fetchNextTurn(state);
  };

  const fetchNextTurn = useCallback(async (currentState: GameState, special?: string) => {
    setLoading(true);
    try {
      const data = await generateTurnData(currentState, special);
      setTurnData(data);
    } catch (err) {
      console.error("同步失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const finalizeGame = async (finalState: GameState) => {
    setLoadingAchievement(true);
    setView('end');
    const achievement = finalState.achievement || (finalState.isVictory ? "逃离斩杀线" : "无效资产");
    const img = await generateAchievementImage(achievement, finalState.isVictory);
    setState({ ...finalState, achievementImageUrl: img || undefined });
    setLoadingAchievement(false);
  };

  const handleChoice = (choiceId: 'A' | 'B' | 'C') => {
    if (!state || state.isGameOver) return;

    let newState = { ...state, turn: state.turn + 1 };
    let specialEventTriggered = "";

    const isLuckyRoll = Math.random() < 0.05;

    if (isLuckyRoll) {
      newState.debt -= 5000;
      newState.cr -= 8;
      newState.san += 15;
      specialEventTriggered = "天降利好";
    } else {
      if (choiceId === 'A') {
        newState.debt += Math.floor(newState.debt * 0.015);
        newState.cr += 3 + Math.floor(Math.random() * 3);
        newState.fico -= 1;
        newState.san -= 3;
      } else if (choiceId === 'B') {
        if (Math.random() > 0.45) {
          newState.debt -= 2000;
          newState.cr -= 3;
          newState.san -= 10;
        } else {
          newState.cr += 10;
          newState.fico -= 30;
          newState.san -= 15;
        }
      } else if (choiceId === 'C') {
        newState.debt = Math.floor(newState.debt * 0.6);
        newState.cr -= 12;
        newState.fico -= 50;
        newState.san -= 30;
      }
    }

    if (Math.random() < 0.1 && newState.character) {
      const newJob = NEW_JOBS[Math.floor(Math.random() * NEW_JOBS.length)];
      newState.character.occupation = newJob;
      specialEventTriggered = `强制转行: ${newJob}`;
    }

    if (newState.turn <= 24 && newState.san < 30 && !newState.hasTriggeredSanRecovery) {
      newState.san += 40;
      newState.hasTriggeredSanRecovery = true;
      specialEventTriggered = "社区救助";
    }
    if (newState.turn <= 12 && newState.fico < 450 && !newState.hasTriggeredFicoRecovery) {
      newState.fico += 80;
      newState.hasTriggeredFicoRecovery = true;
      specialEventTriggered = "债务重组";
    }
    if (newState.turn <= 12 && newState.cr > 30 && !newState.hasTriggeredCrRecovery) {
      newState.cr -= 15;
      newState.hasTriggeredCrRecovery = true;
      specialEventTriggered = "延期令";
    }

    if (newState.turn > 36) {
      newState.isGameOver = true;
      newState.isVictory = true;
      newState.achievement = "逃离斩杀线";
    } else {
      if (newState.cr >= 63) {
        newState.isGameOver = true;
        newState.gameOverReason = "风险溢出。系统已将你清算。";
        newState.achievement = "无效资产";
      } else if (newState.san <= 0) {
        newState.isGameOver = true;
        newState.gameOverReason = "精神崩溃。你融入了低语。";
        newState.achievement = "空壳人";
      } else if (newState.fico <= 0) {
        newState.isGameOver = true;
        newState.gameOverReason = "信用破产。你已社会性死亡。";
        newState.achievement = "透明幽灵";
      }
    }

    setState(newState);
    if (!newState.isGameOver) {
      fetchNextTurn(newState, specialEventTriggered);
    } else {
      finalizeGame(newState);
    }
  };

  if (view === 'start') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="mb-10 space-y-4">
          <h1 className="text-4xl md:text-7xl font-black text-blue-600 tracking-tighter italic drop-shadow-[0_0_15px_rgba(37,99,235,0.6)]">模拟斩杀线：37%</h1>
          <p className="text-blue-400 font-bold text-sm md:text-xl tracking-[0.2em] uppercase italic opacity-80">美式生存现实模拟</p>
        </div>
        <button 
          onClick={rollCharacter}
          className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform active:scale-95 border-2 border-blue-400"
        >
          初始化档案
        </button>
      </div>
    );
  }

  if (view === 'roll') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full border-4 border-blue-600 bg-black p-6 space-y-6 shadow-xl">
          <h2 className="text-xl font-black text-blue-500 border-b-2 border-blue-500 pb-2 italic">载入档案...完成</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-blue-400 text-[10px] uppercase font-bold">性别</span> <span className="text-white block font-black">{state?.character?.gender}</span></div>
            <div><span className="text-blue-400 text-[10px] uppercase font-bold">身份</span> <span className="text-white block font-black">{state?.character?.identity}</span></div>
            <div><span className="text-blue-400 text-[10px] uppercase font-bold">职业</span> <span className="text-white block font-black">{state?.character?.occupation}</span></div>
            <div><span className="text-blue-400 text-[10px] uppercase font-bold">年龄</span> <span className="text-white block font-black">{state?.age}</span></div>
            <div className="col-span-2 border-t border-blue-900 pt-2"><span className="text-blue-400 text-[10px] uppercase font-bold">家庭</span> <span className="text-white italic block font-black">"{state?.character?.family}"</span></div>
            <div className="col-span-2 bg-blue-900/10 p-2 border border-blue-500/30">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-blue-400 text-[10px] font-bold uppercase">财务状况</span>
                  <span className={`font-black block text-lg ${state!.debt < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {state!.debt < 0 ? `+$${Math.abs(state!.debt).toLocaleString()}` : `$${state!.debt.toLocaleString()}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-blue-400 text-[10px] font-bold uppercase">初始信用</span>
                  <span className="text-white font-black block text-lg">{state?.fico}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={rollCharacter} className="flex-1 py-3 border-2 border-blue-600 text-blue-600 font-black text-xs hover:bg-blue-600 hover:text-white">重新载入</button>
            <button onClick={startGame} className="flex-1 py-3 bg-blue-600 text-white font-black text-xs shadow-lg">确认身份</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'end') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 overflow-y-auto">
        <div className={`max-w-md w-full border-4 bg-black p-6 text-center shadow-2xl ${state?.isVictory ? 'border-blue-600' : 'border-red-600'}`}>
          <div className="mb-4 border-b-2 border-blue-900 pb-2 text-left">
            <h1 className={`text-2xl font-black tracking-tighter italic ${state?.isVictory ? 'text-blue-500' : 'text-red-600'}`}>
                {state?.isVictory ? '存续确认' : '连接中断'}
            </h1>
          </div>

          <div className="mb-6">
            {loadingAchievement ? (
              <div className="w-full h-48 bg-white/5 border border-dashed border-blue-500/30 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : state?.achievementImageUrl ? (
              <img src={state.achievementImageUrl} alt="成就" className="w-full h-48 object-cover border-2 border-blue-900 shadow-md" />
            ) : (
                <div className="w-full h-48 bg-white/5 border border-blue-500/10"></div>
            )}
          </div>

          <p className="text-sm text-white font-black mb-6 leading-tight italic">
            {state?.isVictory ? "你完成了36个月的存续。" : `"${state?.gameOverReason}"`}
          </p>

          <div className="bg-white/5 p-4 mb-6 border border-white/10">
            <div className="text-[10px] text-blue-400 font-bold uppercase mb-1 tracking-widest italic text-left">最终成就</div>
            <div className="text-2xl font-black text-yellow-500 tracking-widest drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">{state?.achievement}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-white/60 mb-8 font-bold text-left bg-white/5 p-3">
             <div>结算财务: <span className={`${state!.debt < 0 ? 'text-green-500' : 'text-white'}`}>${Math.abs(state!.debt).toLocaleString()}</span></div>
             <div>信用得分: <span className="text-white">{state?.fico}</span></div>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className={`w-full py-4 text-white font-black text-xl transition-all border-2 ${state?.isVictory ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-red-600 border-red-400 shadow-lg'}`}
          >
            再次载入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-2 h-screen flex flex-col overflow-hidden">
      <header className="mb-2 flex justify-between items-center border-b border-blue-900/50 pb-1">
          <h1 className="text-lg font-black tracking-tighter text-blue-600 italic">
            L_37 <span className="text-xs ml-1 not-italic opacity-60">V2.2_M</span>
          </h1>
          <div className="text-[8px] font-black text-blue-500/50 uppercase tracking-widest">REALTIME_SURVIVAL_SYS</div>
      </header>

      {state && <StatusBar state={state} />}

      <main className="flex-grow flex flex-col justify-start">
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-grow py-10">
            <div className="w-10 h-10 border-4 border-blue-900 border-t-blue-500 animate-spin mb-4"></div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest animate-pulse">演算下一周期...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Narrative Box - Fixed height or constrained to fit */}
            <div className="border-l-4 border-blue-700 bg-blue-900/10 px-3 py-3 mb-2 shadow-inner min-h-[80px] flex items-center">
              <p className="text-base leading-tight text-white font-black italic">
                {turnData?.narrative}
              </p>
            </div>

            {/* Options List - Very compact for mobile */}
            <div className="space-y-1 overflow-y-auto pb-4">
              {turnData?.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleChoice(option.id as any)}
                  className="w-full text-left p-3 border border-blue-500/30 bg-black/60 hover:bg-blue-900/20 active:bg-blue-900/40 transition-all flex flex-col group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-blue-500 text-lg italic">[{option.id}]</span>
                    <span className="text-sm font-black text-white leading-tight">{option.text}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-yellow-400 font-bold border-t border-blue-900/30 pt-1 flex items-center gap-1">
                    <span className="bg-yellow-400 text-black px-1 text-[8px] font-black italic">预测</span>
                    {option.prediction}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-1 border-t border-blue-900/50 text-[8px] font-bold text-blue-600/30 uppercase tracking-tighter flex justify-between">
        <span>协议: L-37_MOBILE</span>
        <span>VIBE_CORE_V2.2</span>
      </footer>
    </div>
  );
}
