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
const TWELVE_MERIDIANS = {
    lung: {
        name: "手太阴肺经", name_en: "Lung Meridian of Hand-Taiyin",
        category: "language_framework_tool",
        yinyang: "yin", limb: "arm",
        paired: "large_intestine",
        ziwu_hour: [3, 5], element: "metal",
        direction: "chest→hand", points: [],
        desc: "编程语言、框架、工具链的选择和使用经验"
    },
    pericardium: {
        name: "手厥阴心包经", name_en: "Pericardium Meridian of Hand-Jueyin",
        category: "testing_quality",
        yinyang: "yin", limb: "arm",
        paired: "triple_burner",
        ziwu_hour: [19, 21], element: "fire",
        direction: "chest→hand", points: [],
        desc: "测试策略、质量保障、代码审查相关经验"
    },
    heart: {
        name: "手少阴心经", name_en: "Heart Meridian of Hand-Shaoyin",
        category: "core_algorithm_decision",
        yinyang: "yin", limb: "arm",
        paired: "small_intestine",
        ziwu_hour: [11, 13], element: "fire",
        direction: "chest→hand", points: [],
        desc: "核心算法设计、关键技术决策、不可逆操作"
    },
    large_intestine: {
        name: "手阳明大肠经", name_en: "Large Intestine Meridian of Hand-Yangming",
        category: "data_processing_io",
        yinyang: "yang", limb: "arm",
        paired: "lung",
        ziwu_hour: [5, 7], element: "metal",
        direction: "hand→head", points: [],
        desc: "数据处理、文件IO、数据库操作、存储方案"
    },
    triple_burner: {
        name: "手少阳三焦经", name_en: "Triple Burner Meridian of Hand-Shaoyang",
        category: "dependency_integration",
        yinyang: "yang", limb: "arm",
        paired: "pericardium",
        ziwu_hour: [21, 23], element: "fire",
        direction: "hand→head", points: [],
        desc: "第三方依赖管理、系统集成、API对接"
    },
    small_intestine: {
        name: "手太阳小肠经", name_en: "Small Intestine Meridian of Hand-Taiyang",
        category: "interface_api_communication",
        yinyang: "yang", limb: "arm",
        paired: "heart",
        ziwu_hour: [13, 15], element: "fire",
        direction: "hand→head", points: [],
        desc: "接口设计、API规范、通信协议、数据格式"
    },
    stomach: {
        name: "足阳明胃经", name_en: "Stomach Meridian of Foot-Yangming",
        category: "business_logic_core",
        yinyang: "yang", limb: "leg",
        paired: "spleen",
        ziwu_hour: [7, 9], element: "earth",
        direction: "head→foot", points: [],
        desc: "核心业务逻辑、功能实现、领域模型"
    },
    gallbladder: {
        name: "足少阳胆经", name_en: "Gallbladder Meridian of Foot-Shaoyang",
        category: "decision_strategy_planning",
        yinyang: "yang", limb: "leg",
        paired: "liver",
        ziwu_hour: [23, 1], element: "wood",
        direction: "head→foot", points: [],
        desc: "项目决策、技术策略、架构规划"
    },
    bladder: {
        name: "足太阳膀胱经", name_en: "Bladder Meridian of Foot-Taiyang",
        category: "config_environment_deploy",
        yinyang: "yang", limb: "leg",
        paired: "kidney",
        ziwu_hour: [15, 17], element: "water",
        direction: "head→foot", points: [],
        desc: "环境配置、部署流程、基础设施"
    },
    spleen: {
        name: "足太阴脾经", name_en: "Spleen Meridian of Foot-Taiyin",
        category: "architecture_system_design",
        yinyang: "yin", limb: "leg",
        paired: "stomach",
        ziwu_hour: [9, 11], element: "earth",
        direction: "foot→chest", points: [],
        desc: "系统架构、模块设计、代码组织"
    },
    liver: {
        name: "足厥阴肝经", name_en: "Liver Meridian of Foot-Jueyin",
        category: "performance_optimization_resource",
        yinyang: "yin", limb: "leg",
        paired: "gallbladder",
        ziwu_hour: [1, 3], element: "wood",
        direction: "foot→chest", points: [],
        desc: "性能优化、资源管理、效率提升"
    },
    kidney: {
        name: "足少阴肾经", name_en: "Kidney Meridian of Foot-Shaoyin",
        category: "security_auth",
        yinyang: "yin", limb: "leg",
        paired: "bladder",
        ziwu_hour: [17, 19], element: "water",
        direction: "foot→chest", points: [],
        desc: "安全策略、权限控制、认证机制"
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

// ===== 七情调制器 (Emotion Modulator) =====
// 情绪强度 → 初始巩固分映射
// 恐(关乎生存)→最高, 悲(趋向遗忘)→负值
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

module.exports = {
    DATA_DIR, MEMORY_DIR, MMA_FILE, WORKING_MEMORY_FILE, ARCHIVE_DIR,
    TWELVE_MERIDIANS, EIGHT_EXTRA_MERIDIANS,
    SHU_LEVELS, SPECIAL_POINT_TYPES,
    EMOTION_CONSOLIDATION, EMOTION_MERIDIAN_MAP, FIVE_ELEMENT,
};
