/**
 * ═══════════════════════════════════════════════════════════════
 *  MMA Constants — 经络·穴位·七情·五行·五输穴
 *  "经脉者，所以决死生，处百病，调虚实，不可不通" —《灵枢·经脉》
 * ═══════════════════════════════════════════════════════════════
 */

const path = require('path');
const os = require('os');

// ===== 存储路径 =====
const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'skills', 'mcts-td-planner');
const MEMORY_DIR = path.join(DATA_DIR, 'memory');
const MMA_FILE = path.join(MEMORY_DIR, 'meridian_kg.json');
const WORKING_MEMORY_FILE = path.join(MEMORY_DIR, 'working_memory.json');
const ARCHIVE_DIR = path.join(MEMORY_DIR, 'archive');

// ===== 十二经脉 (12 Primary Meridians) =====
// 领域无关的通用认知维度 — 适配任何领域(编程/教育/医疗/驾驶/...)
// LLM在阿是穴插入时根据知识内容动态归经
const TWELVE_MERIDIANS = {
    lung: {
        name: "手太阴肺经", name_en: "Lung Meridian of Hand-Taiyin",
        category: "tools_and_means",         // 工具与手段 — 用什么来做？
        question: "用什么工具/手段来实现？",
        yinyang: "yin", limb: "arm",
        paired: "large_intestine",
        ziwu_hour: [3, 5], element: "metal",
        direction: "chest→hand", points: [],
        desc: "工具选择、技术手段、具体操作方法"
    },
    pericardium: {
        name: "手厥阴心包经", name_en: "Pericardium Meridian of Hand-Jueyin",
        category: "verification_and_validation", // 检验与验证 — 怎么确认是对的？
        question: "怎么验证/确认这个做法是对的？",
        yinyang: "yin", limb: "arm",
        paired: "triple_burner",
        ziwu_hour: [19, 21], element: "fire",
        direction: "chest→hand", points: [],
        desc: "检验方法、质量验证、结果确认"
    },
    heart: {
        name: "手少阴心经", name_en: "Heart Meridian of Hand-Shaoyin",
        category: "core_decision",            // 关键决策 — 最核心的选择是什么？
        question: "最核心/最关键的决策点是什么？",
        yinyang: "yin", limb: "arm",
        paired: "small_intestine",
        ziwu_hour: [11, 13], element: "fire",
        direction: "chest→hand", points: [],
        desc: "核心判断、关键选择、不可逆的重大决策"
    },
    large_intestine: {
        name: "手阳明大肠经", name_en: "Large Intestine Meridian of Hand-Yangming",
        category: "input_and_output",         // 输入与输出 — 什么进来？什么出去？
        question: "输入什么？产出/输出什么？",
        yinyang: "yang", limb: "arm",
        paired: "lung",
        ziwu_hour: [5, 7], element: "metal",
        direction: "hand→head", points: [],
        desc: "信息的获取与传递、原料与产物、进与出"
    },
    triple_burner: {
        name: "手少阳三焦经", name_en: "Triple Burner Meridian of Hand-Shaoyang",
        category: "dependencies_and_coordination", // 依赖与协调 — 依赖什么？怎么配合？
        question: "依赖什么外部条件？怎么协调各方？",
        yinyang: "yang", limb: "arm",
        paired: "pericardium",
        ziwu_hour: [21, 23], element: "fire",
        direction: "hand→head", points: [],
        desc: "外部依赖管理、多方协调、资源整合"
    },
    small_intestine: {
        name: "手太阳小肠经", name_en: "Small Intestine Meridian of Hand-Taiyang",
        category: "external_interface",       // 对外接口 — 怎么与外部交互？
        question: "怎么对外呈现/沟通/交互？",
        yinyang: "yang", limb: "arm",
        paired: "heart",
        ziwu_hour: [13, 15], element: "fire",
        direction: "hand→head", points: [],
        desc: "对外呈现方式、沟通协议、交互规范"
    },
    stomach: {
        name: "足阳明胃经", name_en: "Stomach Meridian of Foot-Yangming",
        category: "core_process",             // 核心过程 — 主要流程是什么？
        question: "核心的执行流程是什么？",
        yinyang: "yang", limb: "leg",
        paired: "spleen",
        ziwu_hour: [7, 9], element: "earth",
        direction: "head→foot", points: [],
        desc: "核心业务流程、主要操作步骤、执行路径"
    },
    gallbladder: {
        name: "足少阳胆经", name_en: "Gallbladder Meridian of Foot-Shaoyang",
        category: "judgment_and_strategy",    // 判断与策略 — 为什么选这个？怎么判断？
        question: "为什么这么做？判断依据是什么？",
        yinyang: "yang", limb: "leg",
        paired: "liver",
        ziwu_hour: [23, 1], element: "wood",
        direction: "head→foot", points: [],
        desc: "策略选择、判断依据、决策逻辑"
    },
    bladder: {
        name: "足太阳膀胱经", name_en: "Bladder Meridian of Foot-Taiyang",
        category: "environment_and_conditions", // 环境与条件 — 在什么环境下运作？
        question: "在什么环境/条件下进行？",
        yinyang: "yang", limb: "leg",
        paired: "kidney",
        ziwu_hour: [15, 17], element: "water",
        direction: "head→foot", points: [],
        desc: "运作环境、外部条件、基础设施"
    },
    spleen: {
        name: "足太阴脾经", name_en: "Spleen Meridian of Foot-Taiyin",
        category: "structure_and_framework",  // 结构与框架 — 怎么组织和安排？
        question: "怎么组织/安排/架构这个事？",
        yinyang: "yin", limb: "leg",
        paired: "stomach",
        ziwu_hour: [9, 11], element: "earth",
        direction: "foot→chest", points: [],
        desc: "整体结构、组织方式、框架设计"
    },
    liver: {
        name: "足厥阴肝经", name_en: "Liver Meridian of Foot-Jueyin",
        category: "efficiency_and_resources", // 效率与资源 — 怎么更快/更省/更好？
        question: "怎么优化效率？怎么利用资源？",
        yinyang: "yin", limb: "leg",
        paired: "gallbladder",
        ziwu_hour: [1, 3], element: "wood",
        direction: "foot→chest", points: [],
        desc: "效率优化、资源调度、改进提升"
    },
    kidney: {
        name: "足少阴肾经", name_en: "Kidney Meridian of Foot-Shaoyin",
        category: "safety_and_bottom_line",   // 安全与底线 — 最根本的保障是什么？
        question: "最根本的安全保障/底线是什么？",
        yinyang: "yin", limb: "leg",
        paired: "bladder",
        ziwu_hour: [17, 19], element: "water",
        direction: "foot→chest", points: [],
        desc: "安全保障、底线红线、风险防控"
    },
};

// ===== 奇经八脉 (8 Extraordinary Meridians) =====
const EIGHT_EXTRA_MERIDIANS = {
    ren: {
        name: "任脉", name_en: "Ren Meridian (Conception Vessel)",
        role: "sea_of_yin", direction: "front midline, ascending", points: [],
        desc: "阴脉之海 — 安全策略、防御机制、稳定性保障、错误处理"
    },
    du: {
        name: "督脉", name_en: "Du Meridian (Governing Vessel)",
        role: "sea_of_yang", direction: "back midline, ascending", points: [],
        desc: "阳脉之海 — 性能突破、创新方案、前沿技术"
    },
    chong: {
        name: "冲脉", name_en: "Chong Meridian (Penetrating Vessel)",
        role: "sea_of_twelve_meridians", direction: "deep, penetrating", points: [],
        desc: "十二经之海 — 紧急修复、关键bug解决、突破性洞察"
    },
    dai: {
        name: "带脉", name_en: "Dai Meridian (Girdle Vessel)",
        role: "cross_dimensional_binder", direction: "horizontal, encircling", points: [],
        desc: "唯一横向经脉 — 跨领域关联、技术迁移、类比经验"
    },
};

// ===== 知识七维度 (7 Knowledge Dimensions) =====
// 人脑对完整知识的7个自然维度 — 八面镜补全的目标结构
const KNOWLEDGE_DIMENSIONS = {
    core:           { name: "核心",   name_en: "Core",        question: "这个知识的核心是什么？一句话概括。" },
    why:            { name: "原因",   name_en: "Why",         question: "为什么这样做？背后的原因/动机是什么？" },
    when:           { name: "场景",   name_en: "When",        question: "什么场景/条件下适用？什么情况下不适用？" },
    how:            { name: "方法",   name_en: "How",         question: "具体怎么做？步骤/方法是什么？" },
    risks:          { name: "风险",   name_en: "Risks",       question: "有什么隐藏的风险？容易出什么问题？" },
    alternatives:   { name: "替代",   name_en: "Alternatives",question: "有没有其他做法？各自的优劣是什么？" },
    prerequisites:  { name: "前提",   name_en: "Prerequisites",question: "需要什么前提条件？依赖什么？" }
};

// 八面镜审视角度 — 用于补全缺失维度时从8个视角追问
const EIGHT_FACET_QUESTIONS = [
    { facet: "☰ 乾", angle: "驱动力",   question: "这个维度的驱动力/来源是什么？" },
    { facet: "☷ 坤", angle: "基础",     question: "这个维度依赖的已知基础事实是什么？" },
    { facet: "☳ 震", angle: "变化",     question: "这个维度有什么不确定/可能变化的地方？" },
    { facet: "☴ 巽", angle: "渗透",     question: "这个维度可以借鉴什么已有知识？" },
    { facet: "☵ 坎", angle: "深渊",     question: "这个维度有什么隐藏的风险/陷阱？" },
    { facet: "☲ 离", angle: "依附",     question: "表面下有什么容易被忽略的？" },
    { facet: "☶ 艮", angle: "边界",     question: "有什么边界/限制/不能做的事？" },
    { facet: "☱ 兑", angle: "汇聚",     question: "有什么可以互补/整合的知识？" }
];

// ===== 五输穴等级 (Five Transport Points) =====
// ===== 五输穴等级 (Five Transport Points) =====
const SHU_LEVELS = {
    jing:  { name: "井", level: 0, weight: 0.2, desc: "入门 — 刚接触，只知皮毛" },
    ying:  { name: "荥", level: 1, weight: 0.4, desc: "初级 — 用过一两次" },
    shu:   { name: "输", level: 2, weight: 0.6, desc: "中级 — 熟练使用" },
    jingx: { name: "经", level: 3, weight: 0.8, desc: "高级 — 深入理解" },
    he:    { name: "合", level: 4, weight: 1.0, desc: "专家 — 可以教别人" },
};

// ===== 特殊穴位类型 =====
const SPECIAL_POINT_TYPES = {
    yuan:  { name: "原穴", desc: "关键知识(高频召回点)",          boost: 2.0 },
    luo:   { name: "络穴", desc: "跨维度连接点",                  boost: 1.5 },
    xi:    { name: "郄穴", desc: "紧急知识(高优先级修复)",        boost: 1.8 },
    mu:    { name: "募穴", desc: "知识汇聚点",                    boost: 1.3 },
    back_shu: { name: "背俞穴", desc: "反向映射(同一问题另一面)", boost: 1.2 },
};

// ===== 五输穴等级 (Five Transport Points) =====
const EMOTION_CONSOLIDATION = {
    kong:  { name: "恐", boost: 15, desc: "关乎生存，一次就刻入长期记忆" },
    jing:  { name: "惊", boost: 12, desc: "意外发现，印象深刻" },
    nu:    { name: "怒", boost: 10, desc: "踩坑记忆，高警惕" },
    xi:    { name: "喜", boost: 8,  desc: "成功经验，值得记住" },
    an:    { name: "安", boost: 5,  desc: "问题解决后的平静感" },
    you_si:{ name: "忧思", boost: 3,desc: "需要反复验证才巩固" },
    bei:   { name: "悲", boost: -2, desc: "趋向遗忘，不刻意巩固" },
    neutral:{ name: "中性", boost: 2, desc: "无强烈情绪" },
};

// ===== 七情 → 经脉映射 =====
const EMOTION_MERIDIAN_MAP = {
    xi:      'heart',
    nu:      'liver',
    you_si:  'spleen',
    bei:     'lung',
    kong:    'kidney',
    jing:    'gallbladder',
    an:      'stomach',
};

// ===== 五行生克 =====
const FIVE_ELEMENT = {
    generating: { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' },
    controlling:{ wood: 'earth', fire: 'metal', earth: 'water', metal: 'wood', water: 'fire' },
    insulting:  { earth: 'wood', metal: 'fire', water: 'earth', wood: 'metal', fire: 'water' },
};

// ===== 六爻知识生命周期 (Six Yao Lifecycle) =====
// 初爻→二爻→三爻→四爻→五爻→上爻
// 每条知识的6个阶段，比旧5状态更精细
const SIX_YAO_LIFECYCLE = {
    chu1:  { name: '初爻', name_en: 'Yao 1 — Budding',       n_min: 0,  n_max: 0,  description: '知识刚创建，未经验证' },
    yao2:  { name: '二爻', name_en: 'Yao 2 — Emerging',      n_min: 1,  n_max: 2,  description: '首次引用，初步验证中' },
    yao3:  { name: '三爻', name_en: 'Yao 3 — Developing',    n_min: 3,  n_max: 9,  description: '多次验证，价值趋于稳定' },
    yao4:  { name: '四爻', name_en: 'Yao 4 — Maturing',      n_min: 10, n_max: 19, description: '跨经脉投影建立，知识趋于成熟' },
    yao5:  { name: '五爻', name_en: 'Yao 5 — Flourishing',    n_min: 20, n_max: 49, description: '高巩固分，可靠知识' },
    yao6:  { name: '上爻', name_en: 'Yao 6 — Transformation', n_min: 50, n_max: 999,description: '顶峰: 升华为原穴或衰退为休眠' },
};

// 六爻→五输穴映射: 知识等级与穴位等级的对应
const YAO_TO_SHU = {
    chu1:  'jing',   // 初爻→井穴(入门)
    yao2:  'ying',   // 二爻→荥穴(初级)
    yao3:  'shu',    // 三爻→输穴(中级)
    yao4:  'jingx',  // 四爻→经穴(高级)
    yao5:  'he',     // 五爻→合穴(专家)
    yao6:  'he',     // 上爻→合穴(升华后保持专家级)
};

// ===== 错卦/综卦映射 (Inverse & Reverse Hexagram) =====
// 用于completeness.js自动生成缺失维度的追问
// 错卦: 六爻全变 → 完全对立面 → 生成risks维度的追问
// 综卦: 上下颠倒 → 另一视角 → 生成alternatives维度的追问
// 互卦: 取2-3-4爻为下卦,3-4-5爻为上卦 → 隐藏结构 → 生成prerequisites维度的追问
const HEXAGRAM_RELATIONS = {
    inverse: {   // 错卦: 该维度的反面/对立/风险
        core:           'risks',
        why:            'alternatives',
        when:           'risks',
        how:            'alternatives',
        risks:          'core',
        alternatives:   'why',
        prerequisites:  'alternatives',
    },
    reverse: {   // 综卦: 同一问题的另一视角
        core:           'alternatives',
        why:            'when',
        when:           'why',
        how:            'alternatives',
        risks:          'prerequisites',
        alternatives:   'core',
        prerequisites:  'risks',
    },
    mutual: {    // 互卦: 隐含的前置条件或深层结构
        core:           'prerequisites',
        why:            'prerequisites',
        when:           'prerequisites',
        how:           'prerequisites',
        risks:          'prerequisites',
        alternatives:   'core',
        prerequisites:  'when',
    },
};

// ===== 河图洛书 — 九宫飞星 (Nine Palaces Flying Stars) =====
// 用于ziwu.js计算经脉活跃权重
// 洛书九宫: 戴九履一、左三右七、二四为肩、六八为足、五居中央
const LUOSHU_GRID = {
    // 宫位→卦→方位→经脉映射
    1:  { name: '坎宫', trigram: '☵', element: 'water',  direction: 'north', meridians: ['kidney', 'bladder'] },
    2:  { name: '坤宫', trigram: '☷', element: 'earth',  direction: 'southwest', meridians: ['spleen', 'stomach'] },
    3:  { name: '震宫', trigram: '☳', element: 'wood',   direction: 'east',  meridians: ['liver', 'gallbladder'] },
    4:  { name: '巽宫', trigram: '☴', element: 'wood',   direction: 'southeast', meridians: ['liver', 'gallbladder'] },
    5:  { name: '中宫', trigram: '—', element: 'earth',  direction: 'center', meridians: ['spleen', 'stomach'] },
    6:  { name: '乾宫', trigram: '☰', element: 'metal',  direction: 'northwest', meridians: ['lung', 'large_intestine'] },
    7:  { name: '兑宫', trigram: '☱', element: 'metal',  direction: 'west',  meridians: ['lung', 'large_intestine'] },
    8:  { name: '艮宫', trigram: '☶', element: 'earth',  direction: 'northeast', meridians: ['spleen', 'stomach'] },
    9:  { name: '离宫', trigram: '☲', element: 'fire',   direction: 'south', meridians: ['heart', 'small_intestine', 'pericardium', 'triple_burner'] },
};

// 九宫飞星: 年星/月星/日星/时星 — 四级叠加决定经脉活跃度
// 年飞星基准: 2024=3震, 2025=2坤, 2026=1坎, 2027=9离...
const YEAR_STAR_BASE = { 2024: 3, 2025: 2, 2026: 1, 2027: 9, 2028: 8, 2029: 7, 2030: 6 };

// 月飞星: 子午卯酉年正月起八白, 辰戌丑未年正月起五黄, 寅申巳亥年正月起二黑
const MONTH_STAR_OFFSET = {
    zi_wu_mao_you: [8, 7, 6, 5, 4, 3, 2, 1, 9, 8, 7, 6],  // 子午卯酉年
    chen_xu_chou_wei: [5, 4, 3, 2, 1, 9, 8, 7, 6, 5, 4, 3], // 辰戌丑未年
    yin_shen_si_hai: [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 9],  // 寅申巳亥年
};

// ===== 六十四卦序 (Hexagram Sequence) =====
// 用于预召回: 一条知识自然演化出的下一卦知识
// 屯→蒙→需→讼→师→比→... 每条知识有natural_next_hexagram
const HEXAGRAM_SEQUENCE = [
    'qian','kun','zhun','meng','xu','song','shi','bi',
    'xiaoxu','lv','tai','pi','tongren','dayou','qian','yu',
    'sui','gu','lin','guan','shike','bi','bo','fu',
    'wuwang','daxu','yi','daguo','kan','li','xian','heng',
    'dun','dazhuang','jin','mingyi','jiaren','kui','jian','jie',
    'sun','yi','guai','gou','cui','sheng','kun2','jing',
    'ge','ding','zhen','gen','jian2','guimei','feng','lv2',
    'xun','dui','huan','jie2','zhongfu','xiaoguo','jiji','weiji'
];

// 卦序→知识演化映射: 前卦→本卦→后卦
// 存储知识时自动标记其hexagram_seq位置
// 召回时同时预召回后一卦的知识(evolution chain)
function getNextHexagram(current) {
    const idx = HEXAGRAM_SEQUENCE.indexOf(current);
    return idx >= 0 && idx < 63 ? HEXAGRAM_SEQUENCE[idx + 1] : null;
}
function getPrevHexagram(current) {
    const idx = HEXAGRAM_SEQUENCE.indexOf(current);
    return idx > 0 ? HEXAGRAM_SEQUENCE[idx - 1] : null;
}

module.exports = {
    DATA_DIR, MEMORY_DIR, MMA_FILE, WORKING_MEMORY_FILE, ARCHIVE_DIR,
    TWELVE_MERIDIANS, EIGHT_EXTRA_MERIDIANS,
    SHU_LEVELS, SPECIAL_POINT_TYPES,
    KNOWLEDGE_DIMENSIONS, EIGHT_FACET_QUESTIONS,
    KNOWLEDGE_DIMENSIONS, EIGHT_FACET_QUESTIONS,
    SIX_YAO_LIFECYCLE, YAO_TO_SHU, HEXAGRAM_RELATIONS,
    LUOSHU_GRID, YEAR_STAR_BASE, MONTH_STAR_OFFSET,
    HEXAGRAM_SEQUENCE,
    EMOTION_CONSOLIDATION, EMOTION_MERIDIAN_MAP, FIVE_ELEMENT,
};
