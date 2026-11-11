import React from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekTimelineWidget({ data = [] }: { data?: any[] }) {
  const getDayName = (dateString: string) => {
    const date = new Date(dateString);
    const dayIndex = date.getDay();
    const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return DAYS[mappedIndex];
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'paid': return 'var(--color-paid)';
      case 'planned': return 'var(--color-planned)';
      case 'scheduled': return 'var(--color-scheduled)';
      case 'skipped': return 'var(--color-skipped)';
      case 'failed': return 'var(--color-failed)';
      default: return 'var(--color-pending, #666)';
    }
  };

  return (
    <div style={{ 
      padding: '16px', 
      background: 'var(--color-card)', 
      borderRadius: '8px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Week timeline</h3>
      
      <div style={{ display: 'flex', gap: '8px', flex: 1, overflowX: 'auto' }}>
        {DAYS.map((day) => {
          const dayPayments = data.filter(p => p.date && getDayName(p.date) === day);
          
          return (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '70px' }}>
              <div style={{ textAlign: 'center', fontSize: '12px', opacity: 0.7, fontWeight: 500 }}>
                {day}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayPayments.map((payment, idx) => (
                  <div key={idx} style={{
                    padding: '8px',
                    background: getStatusColor(payment.status),
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {payment.payee}
                    </span>
                    <span>${payment.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}