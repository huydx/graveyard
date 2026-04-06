import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import HomePage from "./pages/HomePage";
import ScanPage from "./pages/ScanPage";
import ExercisePage from "./pages/ExercisePage";
import ResultPage from "./pages/ResultPage";
import PrintsPage from "./pages/PrintsPage";
import NewPrintPage from "./pages/NewPrintPage";
import PrintDetailPage from "./pages/PrintDetailPage";
import RemindPage from "./pages/RemindPage";
import SettingsPage from "./pages/SettingsPage";
import SansuHomePage from "./pages/SansuHomePage";
import {
  LegacyExerciseRedirect,
  LegacyKokugoRedirect,
  LegacyResultRedirect,
} from "./routing/LegacyKokugoRedirect";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route element={<Layout />}>
        <Route path="kokugo">
          <Route index element={<Navigate to="prints" replace />} />
          <Route path="prints" element={<PrintsPage />} />
          <Route path="prints/new" element={<NewPrintPage />} />
          <Route path="prints/:assignmentId/scan" element={<ScanPage />} />
          <Route path="prints/:assignmentId" element={<PrintDetailPage />} />
          <Route path="exercise/:id" element={<ExercisePage />} />
          <Route path="result/:id" element={<ResultPage />} />
          <Route path="remind" element={<RemindPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="sansu" element={<SansuHomePage />} />
      </Route>

      <Route path="/prints/*" element={<LegacyKokugoRedirect />} />
      <Route path="/exercise/:id" element={<LegacyExerciseRedirect />} />
      <Route path="/result/:id" element={<LegacyResultRedirect />} />
      <Route path="/remind" element={<Navigate to="/kokugo/remind" replace />} />
      <Route path="/settings" element={<Navigate to="/kokugo/settings" replace />} />
      <Route path="/history" element={<Navigate to="/kokugo/prints" replace />} />
      <Route path="/scan" element={<Navigate to="/kokugo/prints" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
