import { useState } from "react";

const SECTION_ITEMS = [
  {
    id: "overview",
    title: "因子概述",
    subtitle: "Factor Overview",
    content: (
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h3 className="text-gray-200 font-bold mb-2">什么是因子？</h3>
          <p>
            在量化投资中，<span className="text-blue-400 font-medium">因子（Factor）</span>是用于解释和预测股票收益的特征变量。
            简单来说，因子就是股票的某个可量化属性——比如市盈率高低、过去一个月涨了多少、市值多大。
          </p>
          <p className="mt-2">
            因子投资的核心理念是：<span className="text-amber-400">具有某些共同特征的股票，其未来收益会呈现系统性差异</span>。
            例如，低估值股票长期来看往往比高估值股票表现更好（价值因子），
            过去表现好的股票短期内倾向于继续表现好（动量因子）。
          </p>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">因子分类体系</h3>
          <p className="mb-2">AsQuant 将因子分为 <span className="text-rose-400">8 大类</span>：</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: "价值 (Value)", desc: "衡量股票是否被低估，如市盈率、市净率", color: "text-emerald-400" },
              { label: "成长 (Growth)", desc: "衡量公司的增长速度，如营收增长率、ROE", color: "text-cyan-400" },
              { label: "动量 (Momentum)", desc: "基于过去价格趋势预测未来，如1月/3月收益", color: "text-purple-400" },
              { label: "质量 (Quality)", desc: "衡量公司基本面质量，如毛利率、资产周转率", color: "text-amber-400" },
              { label: "波动率 (Volatility)", desc: "衡量价格波动程度，如历史波动率、最大回撤", color: "text-red-400" },
              { label: "规模 (Size)", desc: "衡量公司市值大小，如对数市值", color: "text-blue-400" },
              { label: "微观结构 (Microstructure)", desc: "基于日内交易行为构建，如日内动量、成交量强度", color: "text-pink-400" },
              { label: "技术指标 (Technical)", desc: "基于 Qlib Alpha158 体系的量价技术因子", color: "text-indigo-400" },
            ].map((item) => (
              <div key={item.label} className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
                <div className={`text-xs font-bold mb-1 ${item.color}`}>{item.label}</div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">因子在量化投资中的作用</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li><span className="text-blue-400">选股</span> — 根据因子得分筛选股票池</li>
            <li><span className="text-blue-400">组合构建</span> — 综合多因子得分确定权重</li>
            <li><span className="text-blue-400">风险控制</span> — 识别和控制组合的因子暴露</li>
            <li><span className="text-blue-400">收益归因</span> — 分析收益来源，判断是Alpha还是Beta</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "factor-detail",
    title: "因子详解",
    subtitle: "Factor Details",
    content: (
      <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
        <FactorDetailSection
          title="价值因子"
          color="text-emerald-400"
          items={[
            { name: "pe_ratio", label: "市盈率倒数（E/P）", formula: "1 / 市盈率 = 每股收益 / 股价", desc: "市盈率的倒数。值越大，说明相对于盈利来说股价越便宜。经典价值因子。" },
            { name: "pb_ratio", label: "市净率倒数（B/P）", formula: "1 / 市净率 = 每股净资产 / 股价", desc: "市净率的倒数。值越大，说明相对于净资产来说股价越便宜。对金融行业尤其有效。" },
            { name: "ps_ratio", label: "市销率倒数（S/P）", formula: "1 / 市销率 = 每股营收 / 股价", desc: "市销率的倒数。适用于盈利不稳定但营收稳定的公司。" },
            { name: "ep_ratio", label: "E/P（直接计算）", formula: "净利润 / 总市值", desc: "基于最新财报数据直接计算的盈利收益率。" },
            { name: "bp_ratio", label: "B/P（直接计算）", formula: "净资产 / 总市值", desc: "基于最新财报数据直接计算的净资产收益率。" },
            { name: "dividend_yield", label: "股息率", formula: "每股股息 / 股价", desc: "衡量分红回报。高股息率通常意味着估值偏低或公司盈利稳定。" },
          ]}
        />
        <FactorDetailSection
          title="成长因子"
          color="text-cyan-400"
          items={[
            { name: "revenue_growth_yoy", label: "营收同比增长率", formula: "(本期营收 - 去年同期营收) / 去年同期营收", desc: "衡量公司业务规模的扩张速度。持续高增长是成长股的典型特征。" },
            { name: "profit_growth_yoy", label: "利润同比增长率", formula: "(本期净利润 - 去年同期净利润) / |去年同期净利润|", desc: "衡量公司盈利能力的提升速度，比营收增长更能反映经营质量。" },
            { name: "roe", label: "净资产收益率（ROE）", formula: "净利润 / 平均净资产", desc: "巴菲特最看重的指标之一。衡量公司用股东的钱赚钱的效率。高ROE通常意味着强竞争优势。" },
          ]}
        />
        <FactorDetailSection
          title="动量因子"
          color="text-purple-400"
          items={[
            { name: "return_1m", label: "近1月收益", formula: "P_t / P_{t-21} - 1", desc: "过去约21个交易日的累计收益率。反映短期动量效应。" },
            { name: "return_3m", label: "近3月收益", formula: "P_t / P_{t-63} - 1", desc: "过去约63个交易日的累计收益率。中期动量信号。" },
            { name: "return_6m", label: "近6月收益", formula: "P_t / P_{t-126} - 1", desc: "过去约126个交易日的累计收益率。长期动量信号，学界研究最充分的因子之一。" },
            { name: "return_12m_1m", label: "12月-1月收益", formula: "(P_t / P_{t-252} - 1) - (P_t / P_{t-21} - 1)", desc: "排除最近1个月后的11个月收益。去除短期反转效应后的纯动量信号。" },
          ]}
        />
        <FactorDetailSection
          title="质量因子"
          color="text-amber-400"
          items={[
            { name: "gross_margin", label: "毛利率", formula: "(营收 - 营业成本) / 营收", desc: "衡量公司产品的基本盈利能力。高毛利率说明产品有定价权或成本优势。" },
            { name: "net_margin", label: "净利率", formula: "净利润 / 营收", desc: "扣除所有费用后的最终盈利能力，反映公司的综合经营效率。" },
            { name: "asset_turnover", label: "资产周转率", formula: "营收 / 平均总资产", desc: "衡量公司资产的运营效率。高周转率意味着用更少的资产创造了更多收入。" },
            { name: "debt_to_equity", label: "债务股权比", formula: "总负债 / 股东权益", desc: "衡量财务杠杆水平。过高的杠杆会增加财务风险，但适度杠杆能提升ROE。" },
          ]}
        />
        <FactorDetailSection
          title="波动率因子"
          color="text-red-400"
          items={[
            { name: "volatility_1m", label: "近1月波动率", formula: "std(日收益率) × √252 (年化)", desc: "衡量股票近1个月的价格波动程度。低波动率异象：低波动股票长期表现反而更好。" },
            { name: "volatility_3m", label: "近3月波动率", formula: "std(日收益率) × √252 (年化)", desc: "更长窗口的波动率度量，信号更稳定。" },
            { name: "max_drawdown_1y", label: "近1年最大回撤", formula: "min(P_t / 历史最高价 - 1)", desc: "衡量极端下跌风险。回撤越大的股票，投资者要求的风险补偿越高。" },
          ]}
        />
        <FactorDetailSection
          title="规模因子"
          color="text-blue-400"
          items={[
            { name: "log_market_cap", label: "对数市值", formula: "ln(总市值)", desc: "取对数后的总市值。小市值效应（Size Effect）：小盘股长期收益倾向于高于大盘股。" },
          ]}
        />
        <FactorDetailSection
          title="微观结构因子"
          color="text-pink-400"
          items={[
            { name: "intraday_momentum", label: "日内动量", formula: "(收盘价 - 开盘价) / 开盘价", desc: "衡量当日价格走势的方向。正的日内动量可能暗示短期强势。" },
            { name: "intraday_volatility", label: "日内波动", formula: "(最高价 - 最低价) / 开盘价", desc: "衡量当日价格振幅。高日内波动可能意味着分歧较大。" },
            { name: "gap_return", label: "跳空收益", formula: "(开盘价 - 前收盘价) / 前收盘价", desc: "衡量隔夜信息冲击。大幅跳空高开往往伴随重要利好。" },
            { name: "volume_intensity", label: "量比", formula: "当日成交量 / 过去5日均量", desc: "衡量成交活跃度。放量上涨通常比缩量上涨更可靠。" },
            { name: "twap_deviation", label: "TWAP偏离", formula: "(收盘价 - TWAP) / TWAP", desc: "收盘价相对于当日成交量加权均价（TWAP）的偏离程度。" },
          ]}
        />
        <div>
          <h3 className="text-indigo-400 font-bold text-sm mb-3">技术指标因子（Qlib Alpha158 体系）</h3>
          <p className="text-sm text-gray-300 mb-3">
            AsQuant 集成了微软 Qlib 的 Alpha158 技术因子体系，包含 <span className="text-indigo-400 font-medium">120+ 个基于纯 OHLCV 价格数据的技术指标因子</span>。
            这些因子不需要财务报表数据，完全基于量价关系构建，计算速度快、更新频率高。
            每个因子支持 5 个滚动窗口（5, 10, 20, 30, 60 个交易日），共计 120+ 个因子变体。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { prefix: "roc", name: "变化率", desc: "价格变化率，动量类", color: "text-purple-300" },
              { prefix: "ma", name: "移动均线", desc: "滚动平均价格，趋势类", color: "text-blue-300" },
              { prefix: "std", name: "标准差", desc: "价格波动性的另一种度量", color: "text-red-300" },
              { prefix: "max / min", name: "最值", desc: "滚动窗口最高/最低价", color: "text-amber-300" },
              { prefix: "corr / cord", name: "相关性", desc: "价量相关性指标", color: "text-cyan-300" },
              { prefix: "rsi", name: "RSI", desc: "相对强弱指标，摆动类", color: "text-pink-300" },
              { prefix: "supm / sumn / sumd", name: "求和", desc: "价格求和统计量", color: "text-emerald-300" },
              { prefix: "rsv / cntp / cntd", name: "位置/计数", desc: "当前价格在窗口中的位置", color: "text-yellow-300" },
              { prefix: "vma / vstd / wvma", name: "量均线", desc: "成交量加权相关指标", color: "text-teal-300" },
              { prefix: "beta / rsqr / resi", name: "线性回归", desc: "对市场的 Beta、R²、残差", color: "text-indigo-300" },
              { prefix: "imax / imin / imxd", name: "Aroon", desc: "趋势强度和方向指标", color: "text-rose-300" },
              { prefix: "k / d", name: "K线形态", desc: "K线实体/影线等形态特征", color: "text-orange-300" },
            ].map((item) => (
              <div key={item.prefix} className="bg-gray-900 rounded p-2 border border-gray-700/50">
                <span className={`font-mono font-bold ${item.color}`}>{item.prefix}_N</span>
                <span className="text-gray-500 mx-1">—</span>
                <span className="text-gray-300">{item.name}</span>
                <div className="text-gray-500 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "ic",
    title: "IC 分析解读",
    subtitle: "Information Coefficient Analysis",
    content: (
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h3 className="text-gray-200 font-bold mb-2">什么是 IC（Information Coefficient）？</h3>
          <p>
            <span className="text-blue-400 font-medium">IC（信息系数）</span>是衡量因子预测能力的核心指标。
            它计算的是<span className="text-amber-400">因子值</span>与<span className="text-amber-400">未来收益</span>之间的相关性。
          </p>
          <p className="mt-2">简单理解：IC 回答的问题是——<span className="text-rose-400">"这个因子的打分，和未来股票的涨跌，有没有关系？"</span></p>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">Rank IC vs Pearson IC</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-blue-400 font-bold text-xs mb-1">Pearson IC（皮尔逊）</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                计算因子值与未来收益的皮尔逊相关系数。
                对异常值敏感，假设线性关系。
                <br />
                <span className="font-mono text-gray-500 mt-1 block">IC = Corr(Factor, Forward_Return)</span>
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-purple-400 font-bold text-xs mb-1">Rank IC（排序/斯皮尔曼）</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                先将因子值和收益分别排序（Rank），再计算相关系数。
                对异常值稳健，更适合金融数据。
                <br />
                <span className="font-mono text-gray-500 mt-1 block">IC_rank = Corr(Rank(Factor), Rank(Return))</span>
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">IC 的计算步骤</h3>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-xs">
            {[
              "1. 在每个调仓日，计算所有股票的因子值",
              "2. 计算每只股票在未来一个持有期（如1个月）的实际收益",
              "3. 计算因子值与未来收益的相关系数，得到当期的 IC 值",
              "4. 对所有历史调仓日的 IC 值进行统计分析",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-gray-300">
                <span className="text-blue-400 font-mono shrink-0">{step.split(".")[0]}.</span>
                <span>{step.split(". ")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">IC 统计指标解读</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 w-[100px]">指标</th>
                  <th className="text-left py-2">含义</th>
                  <th className="text-left py-2">好的因子应满足</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  ["IC 均值", "因子预测能力的平均方向和强度", "|IC| &gt; 0.03（绝对值越大越好）"],
                  ["IC 标准差", "IC 的波动性，衡量预测稳定性", "越小越好，通常 &lt; 0.15"],
                  ["ICIR", "IC均值 / IC标准差，综合衡量风险调整后的预测能力", "&gt; 0.3 较好，&gt; 0.5 优秀"],
                  ["IC 胜率", "IC &gt; 0 的期数占比", "&gt; 55%（显著高于 50%）"],
                  ["IC t值", "对 IC 均值是否显著不为 0 的统计检验", "|t| &gt; 2 通常意味着统计显著"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    <td className="py-2 font-mono text-blue-400">{row[0]}</td>
                    <td className="py-2">{row[1]}</td>
                    <td className="py-2 text-gray-400">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-rose-400/10 border border-rose-400/30 rounded-lg p-3">
          <div className="text-rose-400 font-bold text-xs mb-1">注意</div>
          <p className="text-xs text-gray-300">
            IC 分析只能检验因子与<span className="text-amber-400">未来一期</span>收益的关系，但不能说明因子在多期持有、不同市场环境下的稳定性。
            建议结合分层回测进行更全面的检验。
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "decile",
    title: "分层回测解读",
    subtitle: "Decile Backtest Analysis",
    content: (
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h3 className="text-gray-200 font-bold mb-2">什么是分层回测？</h3>
          <p>
            <span className="text-blue-400 font-medium">分层回测（Decile Analysis）</span>是检验因子区分度的经典方法。
            它将股票按因子值从低到高分为 N 组（通常 10 组），然后观察每组在未来一个持有期的平均收益。
          </p>
          <p className="mt-2">
            核心逻辑：<span className="text-amber-400">如果因子有效，那么因子值最高的一组（G10）的收益应该系统性高于因子值最低的一组（G1）</span>。
          </p>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">分层回测的计算步骤</h3>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-xs">
            {[
              "1. 在每个调仓日，计算所有股票的因子值",
              "2. 将股票按因子值从小到大排序",
              "3. 均分为 N 组（如 10 组），每组股票等权重配置",
              "4. 持有到下一个调仓日，记录每组的收益",
              "5. 重复以上步骤，每期换仓",
              "6. 汇总所有历史时期，计算每组的累计收益、年化波动、Sharpe 等",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-gray-300">
                <span className="text-amber-400 font-mono shrink-0">{step.split(".")[0]}.</span>
                <span>{step.split(". ")[1]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">结果解读</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-rose-400 font-bold text-xs mb-1">多空组合（Long-Short）</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                做多最高分组（G10）、做空最低分组（G1）的收益差。
                体现因子纯Alpha能力（排除了市场Beta）。
                <span className="text-amber-400 mt-1 block">长期正收益 + 合理 Sharpe = 因子有效</span>
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-blue-400 font-bold text-xs mb-1">收益单调性</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                从 G1 到 G10 的收益是否大致呈单调递增/递减。
                <span className="text-amber-400 mt-1 block">严格单调 = 因子区分度强；混乱 = 因子无用</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-3">
          <div className="text-blue-400 font-bold text-xs mb-1">分层回测 vs 真实回测</div>
          <p className="text-xs text-gray-300">
            <span className="text-amber-400">分层回测</span>不涉及交易成本、资金约束、停牌处理等实际问题，纯粹检验因子的统计区分度。
            <br />
            <span className="text-amber-400">真实回测</span>（组合回测模块）则模拟实际交易过程，包含调仓频率、仓位限制、交易成本等约束。
            两者互补：分层检验因子质量，真实回测检验策略可行性。
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "correlation",
    title: "因子相关性矩阵解读",
    subtitle: "Correlation Matrix",
    content: (
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h3 className="text-gray-200 font-bold mb-2">什么是因子相关性？</h3>
          <p>
            因子相关性衡量<span className="text-blue-400">两个因子值之间的线性相关程度</span>，使用
            <span className="font-mono text-amber-400">皮尔逊相关系数（Pearson r）</span>计算。
          </p>
          <p className="mt-2">取值范围 <span className="font-mono text-blue-400">[-1, +1]</span>：</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
            <li><span className="text-green-400">+1</span> — 完全正相关（一个因子大，另一个也大）</li>
            <li><span className="text-gray-400">0</span> — 完全无关</li>
            <li><span className="text-red-400">-1</span> — 完全负相关（一个因子大，另一个一定小）</li>
          </ul>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">为什么要关注因子相关性？</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-rose-400 font-bold text-xs mb-1">避免冗余因子</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                如果两个因子高度相关（如 r &gt; 0.8），它们提供的信息几乎相同。
                同时使用只会放大噪声，不会增加有效信息。
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
              <div className="text-blue-400 font-bold text-xs mb-1">多因子组合优化</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                选择<span className="text-amber-400">低相关性</span>的因子搭配使用，
                可以实现真正的多维度选股，提升组合的稳健性和分散化程度。
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">热力图阅读指南</h3>
          <div className="space-y-1 text-xs text-gray-400">
            <p>📗 <span className="text-green-400">绿色</span> = 负相关（一种因子得分高时，另一种倾向于低）</p>
            <p>⬛ <span className="text-gray-500">灰色</span> = 接近 0（几乎没有任何线性关系）</p>
            <p>📕 <span className="text-red-400">红色</span> = 正相关（两种因子得分倾向于同方向变化）</p>
            <p className="mt-2 text-gray-500">对角线上总是 1.00（因子与自身的相关性），矩阵是对称的。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "best-practice",
    title: "最佳实践",
    subtitle: "Best Practices",
    content: (
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h3 className="text-gray-200 font-bold mb-2">因子选取的一般原则</h3>
          <ul className="list-disc list-inside space-y-2 text-xs">
            <li>
              <span className="text-amber-400 font-medium">逻辑先行</span> —
              因子必须有合理的经济学或行为金融学解释，纯数据挖掘的因子通常不可靠
            </li>
            <li>
              <span className="text-amber-400 font-medium">IC 检验</span> —
              |IC| 均值 &gt; 0.03，ICIR &gt; 0.3，且 IC 方向在大多数时期保持一致
            </li>
            <li>
              <span className="text-amber-400 font-medium">分层验证</span> —
              分层回测显示清晰的收益单调性，多空组合 Sharpe &gt; 0.5
            </li>
            <li>
              <span className="text-amber-400 font-medium">低相关性</span> —
              组合因子时，因子间的相关性应控制在 0.5 以下
            </li>
            <li>
              <span className="text-amber-400 font-medium">样本外检验</span> —
              在训练期外的时间段验证因子效果，避免过拟合
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">避免过拟合</h3>
          <p className="mb-2">量化研究中最大的陷阱就是对历史数据过拟合：</p>
          <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p>❌ 过度追求 IC 最大化，导致参数过度优化</p>
            <p>❌ 只在单一市场/单一时段测试因子</p>
            <p>❌ 因子组合时忽略多重共线性</p>
            <p>✅ 使用 Walk Forward（滚动优化）验证策略稳定性</p>
            <p>✅ 保留 20-30% 的样本外数据做最终检验</p>
            <p>✅ 优先选择简单、稳健的因子而非复杂模型</p>
          </div>
        </div>

        <div>
          <h3 className="text-gray-200 font-bold mb-2">因子中性化简介</h3>
          <p className="mb-2">
            <span className="text-blue-400">因子中性化</span>是指将因子对已知的共同影响因素（如市值、行业）做回归，
            取残差作为新的因子值。这样做的好处是去除因子的"杂质"：
          </p>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
            <p className="text-xs text-gray-400 leading-relaxed">
              例如，<span className="font-mono text-blue-400">pe_ratio</span> 很可能和
              <span className="font-mono text-amber-400">log_market_cap</span> 有关（大市值公司市盈率普遍偏低）。
              如果直接使用 pe_ratio 选股，选出来的可能只是大市值股票。
              通过对市值做中性化处理，可以得到"纯粹的估值因子"，选出的才是真正被低估的股票。
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            目前 AsQuant 的因子计算尚未内置中性化功能，建议在组合回测时通过多因子搭配来间接实现。
          </p>
        </div>
      </div>
    ),
  },
];

function FactorDetailSection({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: { name: string; label: string; formula: string; desc: string }[];
}) {
  return (
    <div>
      <h3 className={`${color} font-bold text-sm mb-2`}>{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="bg-gray-900 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-xs text-blue-400">{item.name}</span>
              <span className="text-xs text-gray-200 font-medium">{item.label}</span>
            </div>
            <div className="font-mono text-xs text-gray-500 mb-1">
              {item.formula}
            </div>
            <div className="text-xs text-gray-400 leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FactorKnowledge() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["overview"]));

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(SECTION_ITEMS.map((s) => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">因子知识解读</h1>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={expandAll}>
            全部展开
          </button>
          <button className="btn-secondary text-xs" onClick={collapseAll}>
            全部收起
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-2 flex items-center gap-4">
        <span>点击标题展开/收起详细内容</span>
        {SECTION_ITEMS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              const el = document.getElementById(`section-${s.id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {SECTION_ITEMS.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div key={section.id} id={`section-${section.id}`} className="card">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition-colors rounded-t-lg"
              >
                <div>
                  <div className="text-sm font-bold text-gray-200">{section.title}</div>
                  <div className="text-xs text-gray-500">{section.subtitle}</div>
                </div>
                <span
                  className={`text-gray-400 text-lg transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-700/50">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}