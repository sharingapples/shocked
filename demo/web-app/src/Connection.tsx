import React from 'react';
import { useShockedStatus, ConnectionStatus } from 'shocked';

export default function Connection() {
  const online = useShockedStatus(ConnectionStatus.connected);
  return (
    <div>Online: {String(online)}</div>
  );
}
