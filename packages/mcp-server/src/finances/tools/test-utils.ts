import type { HubAuthExtra } from '../../shared/types';

export const financesContext: HubAuthExtra = {
  userId: 'user-1',
  email: 'user@example.com',
  clientId: 'client-1',
  serverName: 'finances',
  timezone: 'Europe/Bucharest',
};

export function parseToolPayload(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textContent = result.content.find(item => item.type === 'text' && typeof item.text === 'string');
  if (!textContent?.text) {
    throw new Error('Expected text content in tool response');
  }

  return JSON.parse(textContent.text);
}
