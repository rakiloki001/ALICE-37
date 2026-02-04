
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

const WEALTHY_ROLE = { identity: '幸运儿', occupation: '初级分析师', family: '富裕家庭', baseDebt: -50000, baseFico: 800, age: 24 };

const GENDERS = ['男性', '女性', '非二元'];

const NEW_JOBS = ['夜店保镖', '非法实验体', '垃圾清理工', '日结散工', '街头艺人', '债权收割者'];

const StatusBar: React.FC<{ state: GameState }> = ({ state }) => {
  const isHighRisk = state.cr >= 35;
  const isLethal = state.cr >= 63;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div className="border-4 border-blue-600 bg-black/95 p-6 flex justify-between items-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
        <div className="flex flex-col gap-1">
          <span className="text-base font-black text-blue-400">年龄: {state.age}</span>
          <span className="text-base font-black text-blue-400">信用评分: {state.fico}</span>
          <span className="text-xs text-blue-500 font-black tracking-[0.2em] mt-2">进程: {state.turn}/36 个月</span>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black tracking-tighter ${state.debt < 0 ? 'text-green-500' : 'text-white'}`}>
            {state.debt < 0 ? `存款: $${Math.abs(state.debt).toLocaleString()}` : `债务: $${state.debt.toLocaleString()}`}
          </div>
        </div>
      </div>
      <div className={`border-4 p-6 transition-all duration-500 ${isLethal ? 'border-red-600 bg-red-900/50' : isHighRisk ? 'border-orange-600 bg-orange-900/50' : 'border-blue-600 bg-black/95 shadow-[0_0_30px_rgba(37,99,235,0.3)]'}`}>
        <div className="flex justify-between items-end mb-3">
          <span className="text-sm font-black text-blue-400 uppercase tracking-widest italic">崩溃风险系数</span>
          <span className={`text-3xl font-black ${isHighRisk ? 'text-orange-500 animate-pulse' : 'text-blue-500'}`}>
            {state.cr}%
          </span>
        </div>
        <div className="h-4 w-full bg-white/10 overflow-hidden rounded-none border border-blue-900">
          <div 
            className={`h-full transition-all duration-1000 ${isHighRisk ? 'bg-orange-600' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)]'}`}
            style={{ width: `${Math.min(state.cr, 100)}%` }}
          />
        </div>
        <div className="mt-3 text-[12px] font-black flex justify-between text-blue-500/80">
          <span className="italic">系统稳定性检测中...</span>
        </div>
      </div>
      <div className="md:col-span-2 border-2 border-blue-500 bg-blue-900/20 p-4 flex justify-between items-center px-8">
         <span className="text-base font-black text-blue-400">身份状态: <span className="text-white ml-3 uppercase">{state.character?.identity} / {state.character?.occupation}</span></span>
         <span className="text-base font-black text-blue-400">生存意志 (SAN): <span className={`${state.san < 30 ? 'text-red-500 animate-pulse' : 'text-green-400'} ml-3 font-black text-xl`}>{state.san}</span></span>
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
      specialEventTriggered = "天降横财/政策利好";
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
      specialEventTriggered = `被迫转行: ${newJob}`;
    }

    if (newState.turn <= 24 && newState.san < 30 && !newState.hasTriggeredSanRecovery) {
      newState.san += 40;
      newState.hasTriggeredSanRecovery = true;
      specialEventTriggered = "社区心理援助";
    }
    if (newState.turn <= 12 && newState.fico < 450 && !newState.hasTriggeredFicoRecovery) {
      newState.fico += 80;
      newState.hasTriggeredFicoRecovery = true;
      specialEventTriggered = "债务重组豁免";
    }
    if (newState.turn <= 12 && newState.cr > 30 && !newState.hasTriggeredCrRecovery) {
      newState.cr -= 15;
      newState.hasTriggeredCrRecovery = true;
      specialEventTriggered = "租金延迟暂缓令";
    }

    if (newState.turn > 36) {
      newState.isGameOver = true;
      newState.isVictory = true;
      newState.achievement = "逃离斩杀线";
    } else {
      if (newState.cr >= 63) {
        newState.isGameOver = true;
        newState.gameOverReason = "风险系数溢出。系统已将你清算。";
        newState.achievement = "无效资产";
      } else if (newState.san <= 0) {
        newState.isGameOver = true;
        newState.gameOverReason = "精神防线彻底崩溃。你融入了城市的低语。";
        newState.achievement = "空壳人";
      } else if (newState.fico <= 0) {
        newState.isGameOver = true;
        newState.gameOverReason = "信用破产。作为社会人的你已死亡。";
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
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="mb-16 space-y-8">
          <h1 className="text-7xl font-black text-blue-600 tracking-tighter italic drop-shadow-[0_0_20px_rgba(37,99,235,0.8)]">模拟斩杀线：37%</h1>
          <p className="text-blue-400 font-black text-2xl tracking-[0.3em] uppercase italic">美式生存现实模拟</p>
        </div>
        <button 
          onClick={rollCharacter}
          className="px-20 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl tracking-[0.3em] shadow-[0_0_40px_rgba(37,99,235,0.6)] transition-all transform hover:scale-110 active:scale-95 border-4 border-blue-400"
        >
          初始化现实档案
        </button>
      </div>
    );
  }

  if (view === 'roll') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="max-w-2xl w-full border-8 border-blue-600 bg-black p-12 space-y-10 shadow-[0_0_60px_rgba(37,99,235,0.5)]">
          <h2 className="text-5xl font-black text-blue-500 border-b-4 border-blue-500 pb-4 italic tracking-tight">载入档案...完成</h2>
          <div className="grid grid-cols-2 gap-10 text-2xl">
            <div className="border-b border-blue-900 pb-2"><span className="text-blue-400 font-black block text-sm uppercase">性别</span> <span className="text-white font-black">{state?.character?.gender}</span></div>
            <div className="border-b border-blue-900 pb-2"><span className="text-blue-400 font-black block text-sm uppercase">身份</span> <span className="text-white font-black">{state?.character?.identity}</span></div>
            <div className="border-b border-blue-900 pb-2"><span className="text-blue-400 font-black block text-sm uppercase">职业</span> <span className="text-white font-black">{state?.character?.occupation}</span></div>
            <div className="border-b border-blue-900 pb-2"><span className="text-blue-400 font-black block text-sm uppercase">年龄</span> <span className="text-white font-black">{state?.age}</span></div>
            <div className="col-span-2"><span className="text-blue-400 font-black block text-sm uppercase">家庭关联</span> <span className="text-white font-black italic">"{state?.character?.family}"</span></div>
            <div className="col-span-2 border-t-4 border-blue-600 pt-8 mt-4 bg-blue-900/10 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-blue-400 text-xs font-black block uppercase">初始财务状况</span>
                  <span className={`font-black text-3xl ${state!.debt < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {state!.debt < 0 ? `+$${Math.abs(state!.debt).toLocaleString()}` : `$${state!.debt.toLocaleString()}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-blue-400 text-xs font-black block uppercase">初始信用</span>
                  <span className="text-white font-black text-3xl">{state?.fico}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-8">
            <button onClick={rollCharacter} className="flex-1 py-5 border-4 border-blue-600 text-blue-600 font-black text-xl hover:bg-blue-600 hover:text-white transition-all">重新载入</button>
            <button onClick={startGame} className="flex-1 py-5 bg-blue-600 text-white font-black text-xl hover:bg-blue-500 shadow-lg">确认身份</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'end') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 py-12">
        <div className={`max-w-4xl w-full border-8 bg-black p-8 md:p-16 text-center shadow-[0_0_100px_rgba(0,0,0,0.9)] ${state?.isVictory ? 'border-blue-600' : 'border-red-600'}`}>
          <div className="mb-8 border-b-4 border-blue-900 pb-6 flex justify-between items-center text-left">
             <div>
                <h1 className={`text-5xl font-black tracking-tighter italic ${state?.isVictory ? 'text-blue-500' : 'text-red-600'}`}>
                    {state?.isVictory ? '存续确认 (APPROVED)' : '连接中断 (FAILED)'}
                </h1>
                <p className="text-blue-500/60 font-black text-sm uppercase mt-2 tracking-widest">生存档案编号: L-37_RECORD_{Date.now()}</p>
             </div>
             <div className="text-right">
                <div className="text-xs font-black text-white/30 uppercase">状态判定</div>
                <div className={`text-xl font-black ${state?.isVictory ? 'text-blue-500' : 'text-red-600'}`}>{state?.isVictory ? '合格' : '注销'}</div>
             </div>
          </div>

          <div className="mb-10 flex flex-col items-center">
            {loadingAchievement ? (
              <div className="w-full h-80 bg-white/5 border-2 border-dashed border-blue-500/30 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-blue-500 font-black text-sm animate-pulse">正在生成成就视觉档案...</p>
              </div>
            ) : state?.achievementImageUrl ? (
              <div className="w-full relative group">
                <img 
                  src={state.achievementImageUrl} 
                  alt="成就图片" 
                  className="w-full max-h-96 object-cover border-4 border-blue-900 shadow-2xl transition-transform hover:scale-[1.02]" 
                />
                <div className="absolute inset-0 border-2 border-blue-500/20 pointer-events-none"></div>
              </div>
            ) : (
                <div className="w-full h-80 bg-white/5 border-2 border-blue-500/20 flex items-center justify-center italic text-white/20">档案图片缺失</div>
            )}
          </div>

          <p className="text-2xl text-white font-black mb-10 leading-tight italic drop-shadow-lg">
            {state?.isVictory ? "在这个绞肉机般的世界，你完成了36个月的存续。" : `"${state?.gameOverReason}"`}
          </p>

          <div className="bg-white/5 p-8 mb-10 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 text-[10px] font-black text-yellow-500/30 uppercase">SYSTEM ACHIEVEMENT</div>
            <div className="text-xs text-blue-400 font-black uppercase mb-3 tracking-[0.6em] italic text-left">成就记录卡</div>
            <div className="text-5xl font-black text-yellow-500 tracking-widest drop-shadow-[0_0_15px_rgba(234,179,8,0.7)] text-center py-4 border-y border-white/5">{state?.achievement}</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-white/60 mb-12 font-bold text-left bg-white/5 p-6 border border-blue-900/20">
            <div>
                <span className="block text-[10px] text-blue-500 uppercase">最终年龄</span>
                <span className="text-lg text-white">{state?.age}</span>
            </div>
            <div>
                <span className="block text-[10px] text-blue-500 uppercase">结算财务</span>
                <span className={`text-lg ${state!.debt < 0 ? 'text-green-500' : 'text-white'}`}>{state!.debt < 0 ? `+$${Math.abs(state!.debt).toLocaleString()}` : `$${state!.debt.toLocaleString()}`}</span>
            </div>
            <div>
                <span className="block text-[10px] text-blue-500 uppercase">信用得分</span>
                <span className="text-lg text-white">{state?.fico}</span>
            </div>
            <div>
                <span className="block text-[10px] text-blue-500 uppercase">生存月份</span>
                <span className="text-lg text-white">{state?.turn - 1} / 36</span>
            </div>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className={`px-20 py-6 text-white font-black text-3xl tracking-widest transition-all transform hover:scale-105 active:scale-95 border-4 ${state?.isVictory ? 'bg-blue-600 border-blue-400 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-red-600 border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.4)]'}`}
          >
            再次载入现实
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pt-16 min-h-screen flex flex-col">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter flex items-center text-blue-600 italic">
            <span className="bg-blue-600 text-black px-3 mr-3 not-italic">L_37</span>
            模拟斩杀线_V2.1
          </h1>
          <div className="h-2 bg-blue-600 w-full mt-2 shadow-[0_0_20px_rgba(37,99,235,0.7)]"></div>
        </div>
        <div className="text-sm font-black text-blue-500 opacity-90 uppercase tracking-[0.3em]">系统风险监控中</div>
      </header>

      {state && <StatusBar state={state} />}

      <main className="flex-grow flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-grow space-y-10">
            <div className="w-24 h-24 border-[12px] border-blue-900 border-t-blue-500 rounded-none animate-spin shadow-[0_0_30px_rgba(37,99,235,0.4)]"></div>
            <p className="text-2xl font-black text-blue-500 uppercase tracking-[0.6em] animate-pulse">演算下一周期...</p>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="border-l-[12px] border-blue-700 bg-blue-900/20 pl-12 pr-8 py-10 shadow-[inset_0_0_40px_rgba(37,99,235,0.15)] relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 text-[10px] font-black text-blue-500/30 uppercase">月度报告</div>
              <p className="text-3xl md:text-4xl leading-tight text-white font-black whitespace-pre-wrap italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {turnData?.narrative}
              </p>
            </div>

            <div className="mt-14 space-y-8">
              <h2 className="text-base uppercase tracking-[0.5em] text-blue-500 font-black flex items-center italic">
                <span className="w-16 h-1.5 bg-blue-600 mr-4"></span>
                决策干预
              </h2>
              
              <div className="grid gap-6">
                {turnData?.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleChoice(option.id as any)}
                    className="w-full text-left p-10 border-4 border-blue-500/40 bg-black/90 hover:bg-blue-900/30 hover:border-blue-500 transition-all flex flex-col gap-6 group relative overflow-hidden shadow-lg"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform origin-top"></div>
                    <div className="flex items-start gap-8">
                      <span className="font-black text-blue-500 text-5xl leading-none italic group-hover:scale-110 transition-transform">[{option.id}]</span>
                      <span className="text-2xl md:text-3xl font-black text-white group-hover:text-blue-100 transition-colors drop-shadow-sm">{option.text}</span>
                    </div>
                    
                    <div className="pl-20 text-xl md:text-2xl text-yellow-400 font-black border-t-2 border-blue-900/50 pt-5 flex items-center gap-4">
                      <span className="bg-yellow-400 text-black px-3 py-1 text-sm font-black italic shadow-sm">预测报告</span>
                      {option.prediction}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-24 pt-10 border-t-4 border-blue-900 flex justify-between text-sm font-black text-blue-600/50 uppercase tracking-[0.3em]">
        <div>第 {state?.turn} / 36 个月 | 通讯协议: L-37_CORE | 加密强度: 极高</div>
        <div>VIBE_CORE_SURVIVAL_ENGINE_V2.1</div>
      </footer>
    </div>
  );
}
