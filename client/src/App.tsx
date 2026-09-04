import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import EquipmentDetail from "./pages/EquipmentDetail";
import { Route, Switch } from "wouter";

function Workspace() { return <DashboardLayout><Home /></DashboardLayout>; }

function App() {
  return <ErrorBoundary><LanguageProvider><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Switch><Route path="/" component={Workspace} /><Route path="/equipment/:id"><DashboardLayout><EquipmentDetail /></DashboardLayout></Route><Route path="/equipment" component={Workspace} /><Route path="/maintenance" component={Workspace} /><Route path="/repairs" component={Workspace} /><Route path="/parts" component={Workspace} /><Route path="/users" component={Workspace} /><Route component={Workspace} /></Switch></TooltipProvider></ThemeProvider></LanguageProvider></ErrorBoundary>;
}

export default App;
