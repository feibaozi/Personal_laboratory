import json
import logging
from datetime import datetime
from database.connection import sync_session
from database.models import Stock, Report
from ai.tools import ALL_TOOLS
from ai.prompts import DEEP_RESEARCH_PROMPT, QUICK_ANALYSIS_PROMPT, SYSTEM_PROMPT
from ai.rag import rag_pipeline
from config import settings

logger = logging.getLogger(__name__)


class ReportGenerator:
    def __init__(self):
        self._llm = None
        self._agent = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        try:
            from langchain_openai import ChatOpenAI

            self._llm = ChatOpenAI(
                model=settings.llm_model,
                api_key=settings.llm_api_key or "sk-placeholder",
                base_url=settings.llm_base_url,
                temperature=0.3,
                max_tokens=8000,
            )
            return self._llm
        except Exception as e:
            logger.error(f"[Agent] Failed to initialize LLM: {e}")
            return None

    def _build_agent(self):
        if self._agent is not None:
            return self._agent

        llm = self._get_llm()
        if llm is None:
            return None

        try:
            from langchain.agents import AgentExecutor, create_tool_calling_agent
            from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

            prompt = ChatPromptTemplate.from_messages([
                ("system", SYSTEM_PROMPT),
                ("human", "{input}"),
                MessagesPlaceholder("agent_scratchpad"),
            ])

            agent = create_tool_calling_agent(llm, ALL_TOOLS, prompt)
            self._agent = AgentExecutor(
                agent=agent,
                tools=ALL_TOOLS,
                verbose=True,
                max_iterations=15,
                handle_parsing_errors=True,
            )
            return self._agent
        except Exception as e:
            logger.error(f"[Agent] Failed to create agent: {e}")
            return None

    def generate_deep_report(self, stock_code: str) -> dict:
        logger.info(f"[Agent] Generating deep report for {stock_code}")

        with sync_session() as session:
            stock = session.query(Stock).filter(Stock.code == stock_code).first()
            if not stock:
                return {"error": f"Stock {stock_code} not found"}

            stock_name = stock.name

        rag_pipeline.index_stock_documents(stock_code)
        rag_context = rag_pipeline.get_context_for_report(stock_code)

        agent = self._build_agent()

        if agent is not None:
            return self._generate_with_agent(agent, stock_code, stock_name, rag_context)
        else:
            return self._generate_with_direct_llm(stock_code, stock_name, rag_context)

    def _generate_with_agent(self, agent, stock_code: str, stock_name: str, rag_context: str) -> dict:
        try:
            prompt = DEEP_RESEARCH_PROMPT.format(
                stock_name=stock_name,
                stock_code=stock_code,
                date=datetime.now().strftime("%Y-%m-%d"),
            )

            if rag_context:
                prompt += f"\n\n## 补充参考信息（来自历史数据检索）\n{rag_context}"

            result = agent.invoke({"input": prompt})
            report_content = result.get("output", "")

            return self._save_report(stock_code, "deep_research", report_content)
        except Exception as e:
            logger.error(f"[Agent] Agent generation failed: {e}")
            return self._generate_with_direct_llm(stock_code, stock_name, rag_context)

    def _generate_with_direct_llm(self, stock_code: str, stock_name: str, rag_context: str) -> dict:
        logger.info(f"[Agent] Falling back to direct LLM for {stock_code}")
        llm = self._get_llm()

        tool_results = {}
        for tool_fn in ALL_TOOLS:
            try:
                tool_output = tool_fn.invoke({"stock_code": stock_code})
                tool_results[tool_fn.name] = tool_output
            except Exception as e:
                logger.error(f"[Agent] Tool {tool_fn.name} failed: {e}")
                tool_results[tool_fn.name] = f"数据获取失败: {e}"

        if llm is not None:
            try:
                prompt = DEEP_RESEARCH_PROMPT.format(
                    stock_name=stock_name,
                    stock_code=stock_code,
                    date=datetime.now().strftime("%Y-%m-%d"),
                )

                context_parts = []
                for tool_name, output in tool_results.items():
                    context_parts.append(f"### {tool_name}\n{output}\n")

                if rag_context:
                    context_parts.append(f"### 历史数据检索\n{rag_context}")

                full_prompt = f"{prompt}\n\n## 采集到的数据\n\n" + "\n".join(context_parts)

                response = llm.invoke(full_prompt)
                report_content = response.content
            except Exception as e:
                logger.error(f"[Agent] Direct LLM failed: {e}")
                report_content = self._generate_fallback_report(stock_name, stock_code, tool_results)
        else:
            report_content = self._generate_fallback_report(stock_name, stock_code, tool_results)

        return self._save_report(stock_code, "deep_research", report_content)

    def _generate_fallback_report(self, stock_name: str, stock_code: str, tool_results: dict) -> str:
        lines = [
            f"# {stock_name}({stock_code}) 分析报告",
            "",
            f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "> 注意：LLM 服务不可用，以下为数据汇总",
            "",
        ]

        fin_data = tool_results.get("get_financials", "")
        if fin_data:
            lines.append("## 财务数据")
            lines.append(fin_data)
            lines.append("")

        price_data = tool_results.get("get_price_history", "")
        if price_data:
            lines.append("## 行情数据")
            lines.append(price_data)
            lines.append("")

        sentiment_data = tool_results.get("get_sentiment", "")
        if sentiment_data:
            lines.append("## 舆情数据")
            lines.append(sentiment_data)
            lines.append("")

        anomaly_data = tool_results.get("detect_anomalies", "")
        if anomaly_data:
            lines.append("## 异常检测")
            lines.append(anomaly_data)
            lines.append("")

        val_data = tool_results.get("calculate_valuation", "")
        if val_data:
            lines.append("## 估值分析")
            lines.append(val_data)
            lines.append("")

        lines.append("---")
        lines.append("*本报告由数据汇总生成，LLM 服务恢复后将提供深度分析。*")

        return "\n".join(lines)

    def generate_quick_analysis(self, stock_code: str) -> dict:
        logger.info(f"[Agent] Generating quick analysis for {stock_code}")

        with sync_session() as session:
            stock = session.query(Stock).filter(Stock.code == stock_code).first()
            if not stock:
                return {"error": f"Stock {stock_code} not found"}
            stock_name = stock.name

        tool_results = {}
        for tool_fn in [t for t in ALL_TOOLS if t.name in ["get_financials", "get_price_history", "detect_anomalies"]]:
            try:
                tool_results[tool_fn.name] = tool_fn.invoke({"stock_code": stock_code})
            except Exception:
                pass

        llm = self._get_llm()
        if llm:
            try:
                prompt = QUICK_ANALYSIS_PROMPT.format(stock_name=stock_name, stock_code=stock_code)
                context = "\n".join(f"### {k}\n{v}" for k, v in tool_results.items())
                response = llm.invoke(f"{prompt}\n\n## 数据\n{context}")
                content = response.content
            except Exception:
                content = json.dumps(tool_results, ensure_ascii=False, default=str)
        else:
            content = json.dumps(tool_results, ensure_ascii=False, default=str)

        return self._save_report(stock_code, "quick", content)

    def _save_report(self, stock_code: str, report_type: str, content: str) -> dict:
        with sync_session() as session:
            stock = session.query(Stock).filter(Stock.code == stock_code).first()
            if not stock:
                return {"error": "Stock not found"}

            report = Report(
                stock_id=stock.id,
                report_type=report_type,
                title=f"{stock.name} {'深度研究' if report_type == 'deep_research' else '快速分析'}报告",
                content_markdown=content,
                data_snapshot="",
                model_used=settings.llm_model,
                tokens_used=0,
            )
            session.add(report)
            session.commit()
            session.refresh(report)

            return {
                "id": report.id,
                "stock_code": stock_code,
                "stock_name": stock.name,
                "report_type": report_type,
                "title": report.title,
                "content_markdown": content,
                "model_used": report.model_used,
                "created_at": str(report.created_at),
            }


report_generator = ReportGenerator()
