import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import StudentsTab from '../admin/StudentsTab';
import ReportsTab from '../admin/ReportsTab';
import AdjustPointsTab from '../admin/AdjustPointsTab';
import QuestionsTab from '../admin/QuestionsTab';
import RosterTab from '../admin/RosterTab';

const TABS = [
  { id: 'students', label: 'Student Points' },
  { id: 'reports', label: 'Reports' },
  { id: 'adjust', label: 'Adjust Points' },
  { id: 'questions', label: 'Daily Challenge Questions' },
  { id: 'roster', label: 'Staff Roster' },
];

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('students');

  return (
    <AppShell title="PBIS Rewards — Admin" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {tab === 'students' && <StudentsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'adjust' && <AdjustPointsTab adminId={profile.id} />}
      {tab === 'questions' && <QuestionsTab />}
      {tab === 'roster' && <RosterTab />}
    </AppShell>
  );
}
