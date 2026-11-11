import React from 'react';
import { Bot } from "@/components/bot";

export function WhoOwesYouWidget({ data = [] }: { data?: any[] }) {
  return (
    <div style={{ 
      padding: '16px', 
      background: 'var(--color-card)', 
      borderRadius: '8px',
      height: '100%',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Who owes you</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((request, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bot shape={request.friend?.shape} color={request.friend?.color} size={32} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{request.friend?.name || 'Unknown'}</span>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  {request.reminders} {request.reminders === 1 ? 'reminder' : 'reminders'} sent
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 600 }}>${request.outstanding}</span>
              <span style={{ 
                fontSize: '12px', 
                color: request.status === 'paid' ? 'var(--color-paid)' : 'var(--color-pending)' 
              }}>
                {request.status}
              </span>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}