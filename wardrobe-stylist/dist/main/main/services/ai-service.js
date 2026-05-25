"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureAI = configureAI;
exports.analyzeGarment = analyzeGarment;
exports.getRecommendations = getRecommendations;
exports.isAIEnabled = isAIEnabled;
const openai_1 = __importDefault(require("openai"));
// Config stored in memory, loaded from settings IPC
let qwenApiKey = '';
let qwenBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
let qwenModel = 'qwen-vl-plus';
let deepseekApiKey = '';
let deepseekBaseUrl = 'https://api.deepseek.com';
let deepseekModel = 'deepseek-chat';
let aiEnabled = false;
function configureAI(config) {
    if (config.enabled !== undefined)
        aiEnabled = config.enabled;
    if (config.qwenApiKey !== undefined)
        qwenApiKey = config.qwenApiKey;
    if (config.qwenModel !== undefined)
        qwenModel = config.qwenModel;
    if (config.deepseekApiKey !== undefined)
        deepseekApiKey = config.deepseekApiKey;
    if (config.deepseekModel !== undefined)
        deepseekModel = config.deepseekModel;
}
const ANALYZE_PROMPT = `分析这张服装图片，返回纯 JSON（不要 markdown 标记）：
{
  "category": "top|bottom|outerwear|dress|shoes|bag|accessory|hat|scarf|other",
  "colors": ["颜色1", "颜色2"],
  "pattern": "solid|stripe|plaid|floral|polka_dot|graphic|other",
  "material": "cotton|linen|silk|wool|cashmere|denim|leather|polyester|nylon|knit|chiffon|other",
  "seasons": ["spring","summer","autumn","winter"],
  "occasions": ["casual","work","date","party","sport","formal","travel","home"],
  "style": "minimalist|casual|streetwear|business|sporty|vintage|elegant|other",
  "name": "简短中文描述（如：白色圆领短袖T恤）",
  "fit": "slim|regular|loose|oversized",
  "length": "cropped|regular|long",
  "imageType": "flat|hanging|model",
  "hasPerson": true,
  "garmentBbox": {"x": 0, "y": 0, "width": 0, "height": 0}
}`;
async function analyzeGarment(imageBase64) {
    if (!aiEnabled || !qwenApiKey) {
        console.log('[AI] Qwen not configured, skipping analysis');
        return null;
    }
    try {
        const client = new openai_1.default({
            baseURL: qwenBaseUrl,
            apiKey: qwenApiKey,
        });
        const response = await client.chat.completions.create({
            model: qwenModel,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                        },
                        { type: 'text', text: ANALYZE_PROMPT },
                    ],
                },
            ],
            max_tokens: 1000,
        });
        const content = response.choices[0]?.message?.content || '';
        const jsonStr = content.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    }
    catch (e) {
        console.error('[AI] Qwen analyze failed:', e.message);
        return null;
    }
}
const RECOMMEND_PROMPT = `你是一位拥有10年经验的私人穿搭顾问。

根据用户的衣橱单品和场景需求，推荐3套搭配方案。每套必须包含上衣+下装+鞋子，可选外套和配饰。

规则：
1. 遵循三色原则（全身不超过3种主色）
2. 考虑场景适配度
3. 优先选择风格一致的单品组合
4. 颜色搭配要和谐（中性色百搭，亮色做点缀）
5. 每套搭配给出一句话理由

输出纯 JSON：
{
  "outfits": [
    {
      "garmentIds": ["id1", "id2", "id3"],
      "reason": "白色上衣搭配深色牛仔裤是经典组合，棕色皮鞋增添质感",
      "score": 4.5
    }
  ],
  "overallTip": "降温建议加一件外套"
}`;
async function getRecommendations(context) {
    if (!aiEnabled || !deepseekApiKey) {
        console.log('[AI] DeepSeek not configured, skipping recommendations');
        return null;
    }
    try {
        const client = new openai_1.default({
            baseURL: deepseekBaseUrl,
            apiKey: deepseekApiKey,
        });
        const garmentList = context.garments.map((g) => `[${g.id}] ${g.name} | 类别:${g.category} | 颜色:${g.colors} | 风格:${g.style || '未知'}`).join('\n');
        const styleHint = context.styleDescription
            ? `\n用户风格偏好：${context.styleDescription}` : '';
        const userPrompt = `场景：${context.occasion || '日常休闲'}
天气：${context.weather || '未知'}
${styleHint}

可选单品：
${garmentList}

请推荐3套搭配方案。`;
        const response = await client.chat.completions.create({
            model: deepseekModel,
            messages: [
                { role: 'system', content: RECOMMEND_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 1500,
        });
        const content = response.choices[0]?.message?.content || '';
        const jsonStr = content.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    }
    catch (e) {
        console.error('[AI] DeepSeek recommend failed:', e.message);
        return null;
    }
}
function isAIEnabled() {
    return aiEnabled;
}
//# sourceMappingURL=ai-service.js.map