import type { JSONRPCMessage, JSONRPCNotification, JSONRPCRequest } from '@modelcontextprotocol/server';
import { isJSONRPCNotification, isJSONRPCRequest } from '@modelcontextprotocol/server';

/** True for requests (method + id) and notifications (method, no id). */
export function isJSONRPCCallable(msg: JSONRPCMessage): msg is JSONRPCRequest | JSONRPCNotification {
  return isJSONRPCRequest(msg) || isJSONRPCNotification(msg);
}
