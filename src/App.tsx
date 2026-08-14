import React, { useState } from 'react';
import { Header } from './components/Header';
import { TabsNavigation } from './components/TabsNavigation';
import { SystemDiagnostics } from './components/SystemDiagnostics';
import { LiveWebTester } from './components/LiveWebTester';
import { RemediationGuide } from './components/RemediationGuide';

function App() {
  const [activeTab, setActiveTab] = useState('diagnostics');
  const [advancedToolsEnabled, setAdvancedToolsEnabled] = useState(false);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-900 selection:text-blue-50">
      <Header 
        advancedToolsEnabled={advancedToolsEnabled}
        onEnableAdvancedTools={() => setAdvancedToolsEnabled(true)}
        onDisableAdvancedTools={() => setAdvancedToolsEnabled(false)}
      />
      <TabsNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'diagnostics' && <SystemDiagnostics advancedToolsEnabled={advancedToolsEnabled} />}
        {activeTab === 'live-test' && <LiveWebTester />}
        {activeTab === 'remediation' && <RemediationGuide />}
      </main>
    </div>
  );
}

export default App;
