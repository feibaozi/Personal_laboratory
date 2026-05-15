import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { FactorPage } from "@/components/factor/FactorPage";
import { BacktestPage } from "@/components/backtest/BacktestPage";
import { ReportPage } from "@/components/report/ReportPage";
import { DataManagementPage } from "@/components/data/DataManagementPage";
import { StockPage } from "@/components/stock/StockPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/factor" element={<FactorPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/report/:runId" element={<ReportPage />} />
          <Route path="/data" element={<DataManagementPage />} />
          <Route path="/stock/:code" element={<StockPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
