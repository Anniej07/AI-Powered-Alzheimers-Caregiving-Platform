import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }   from '../../context/AuthContext';
import useSocket     from '../../hooks/useSocket';
import { getInitials } from '../../utils/helpers';
import './Layout.css';

const GridIcon     = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const PillIcon     = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7.07-7.07l7 7a5 5 0 0 1-7.07 7.07z"/><line x1="8.5" y1="11.5" x2="15.5" y2="11.5"/></svg>;
const ClockIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const ChartIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const FileIcon     = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const HeartIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const BellIcon     = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const ActivityIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const UsersIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const PersonIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const LogoutIcon   = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const LeafIcon     = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>;
const ChevronIcon  = ({ dir }) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ transform: dir==='right' ? 'rotate(180deg)' : 'none', transition:'200ms' }}><polyline points="15 18 9 12 15 6"/></svg>;

const NAV = [
  { to:'/dashboard',     icon:GridIcon,     label:'Dashboard' },
  { to:'/medications',   icon:PillIcon,     label:'Medications' },
  { to:'/schedule',      icon:ClockIcon,    label:'Schedule' },
  { to:'/adherence',     icon:ChartIcon,    label:'Adherence' },
  { to:'/prescriptions', icon:FileIcon,     label:'Prescriptions' },
  { to:'/emotions',      icon:HeartIcon,    label:'Emotions' },
  { to:'/alerts',        icon:BellIcon,     label:'Alerts' },
  { to:'/activity',      icon:ActivityIcon, label:'Activity' },
  { to:'/patients', icon:UsersIcon, label:'Patients', roles:['doctor','caregiver','family'] },
  { to:'/profile',       icon:PersonIcon,   label:'Profile' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const { on, off } = useSocket();

  useEffect(() => {
    const handler = () => setAlertCount(c => c + 1);
    on('new_alert', handler);
    return () => off('new_alert', handler);
  }, [on, off]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = NAV.filter(n => !n.roles || n.roles.includes(user?.role));

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo"><LeafIcon /></div>
          {!collapsed && (
            <div className="sidebar__name">
              <span className="sidebar__title">AlzheimerCare</span>
              <span className="sidebar__sub">{user?.role}</span>
            </div>
          )}
          <button className="sidebar__collapse" onClick={() => setCollapsed(c => !c)}>
            <ChevronIcon dir={collapsed ? 'right' : 'left'} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={() => { if (to === '/alerts') setAlertCount(0); }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <Icon />
                {to === '/alerts' && alertCount > 0 && (
                  <span style={{
                    position:'absolute', top:-4, right:-4,
                    background:'var(--danger)', color:'#fff',
                    width:15, height:15, borderRadius:'50%',
                    fontSize:9, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>{alertCount > 9 ? '9+' : alertCount}</span>
                )}
              </div>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__avatar">{getInitials(user?.name)}</div>
          {!collapsed && (
            <div className="sidebar__user">
              <span className="sidebar__uname">{user?.name}</span>
              <span className="sidebar__uemail">{user?.email}</span>
            </div>
          )}
          <button className="sidebar__logout" onClick={handleLogout} title="Logout">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main__inner"><Outlet /></div>
      </main>
    </div>
  );
}