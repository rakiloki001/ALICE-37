
import { GoogleGenAI, Type } from "@google/genai";
import { GameState } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const TURN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING, description: "情境描述，严禁超过3行。极其简洁。" },
    statusText: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          prediction: { type: Type.STRING },
        },
        required: ["id", "text", "prediction"]
      }
    }
  },
  required: ["narrative", "statusText", "options"]
};

export const generateTurnData = async (state: GameState, specialEvent?: string) => {
  const isDisasterTurn = state.turn > 0 && state.turn % 3 === 0;
  
  const systemPrompt = `你是一款名为《模拟斩杀线：37%》的生存模拟器叙述者。
背景：当代生存，为期36个月。
风格：极简、冷峻、残酷。
要求：
1. 叙述字数极少，严禁超过三行。
2. 全中文，不要有任何英文单词。
3. 如果崩溃风险(CR)高于35%，描写环境的异化（如：红色的雨、会说话的阴影）。
4. 本回合玩家的职业可能是动态的：${state.character?.occupation}。
5. 选项逻辑：A顺从，B投机，C绝望。偶尔会出现意外的好运。

${specialEvent ? `特殊干预：本回合发生【${specialEvent}】。` : ""}
${isDisasterTurn ? "突发：本月遭遇社会性灾难。" : ""}`;

  const userPrompt = `第 ${state.turn}/36 个月。身份：${state.character?.identity}。债务：${state.debt}。信用：${state.fico}。风险：${state.cr}%。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: TURN_SCHEMA as any,
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    return {
      narrative: "> 链接震荡。你站在空旷的十字路口，风声刺耳。",
      statusText: "同步异常",
      options: [
        { id: 'A', text: '顺应现状。', prediction: '维持现状。' },
        { id: 'B', text: '尝试突围。', prediction: '高危预测。' },
        { id: 'C', text: '彻底放弃。', prediction: '终结临近。' }
      ]
    };
  }
};

export const generateAchievementImage = async (achievement: string, isVictory: boolean) => {
  const prompt = `A dark, cinematic, cyberpunk digital art style image illustrating the survival achievement: "${achievement}". ${isVictory ? "Atmosphere is triumphant yet cold, neon lighting, silhouette of a person standing against a brutalist city." : "Atmosphere is oppressive, tragic, broken objects, glitch art, dark shadows, rainy street."} No text in the image. High contrast, high quality.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image generation failed:", error);
  }
  return null;
};
