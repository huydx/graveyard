import { Navigate, Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import ScanPage from "./pages/ScanPage";
import ExercisePage from "./pages/ExercisePage";
import ResultPage from "./pages/ResultPage";
import PrintsPage from "./pages/PrintsPage";
import NewPrintPage from "./pages/NewPrintPage";
import PrintDetailPage from "./pages/PrintDetailPage";
import RemindPage from "./pages/RemindPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/prints" replace />} />
        <Route path="/prints" element={<PrintsPage />} />
        <Route path="/prints/new" element={<NewPrintPage />} />
        <Route path="/prints/:assignmentId/scan" element={<ScanPage />} />
        <Route path="/prints/:assignmentId" element={<PrintDetailPage />} />
        <Route path="/exercise/:id" element={<ExercisePage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/history" element={<Navigate to="/prints" replace />} />
        <Route path="/scan" element={<Navigate to="/prints" replace />} />
        <Route path="/remind" element={<RemindPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
