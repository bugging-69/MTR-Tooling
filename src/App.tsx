import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TabsNavigation } from './components/TabsNavigation';
import { SystemDiagnostics } from './components/SystemDiagnostics';
import { LiveWebTester } from './components/LiveWebTester';
import { RemediationGuide } from './components/RemediationGuide';
import { AVToolsInstaller } from './components/AVToolsInstaller';

function App() {
  const [activeTab, setActiveTab] = useState('diagnostics');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAdmin && activeTab === 'av-tools') {
      setActiveTab('diagnostics');
    }
  }, [isAdmin, activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-900 selection:text-blue-50">
      <Header 
        activeTab={activeTab}
        isAdmin={isAdmin}
        onOpenAdmin={() => setIsAdmin(true)}
        onLockAdmin={() => setIsAdmin(false)}
      />
      <TabsNavigation activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'diagnostics' && <SystemDiagnostics isAdmin={isAdmin} />}
        {activeTab === 'live-test' && <LiveWebTester />}
        {activeTab === 'remediation' && <RemediationGuide />}
        {activeTab === 'av-tools' && <AVToolsInstaller />}
      </main>
    </div>
  );
}

export default App;
