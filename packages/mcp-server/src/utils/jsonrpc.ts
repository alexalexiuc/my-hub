import type {
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResultResponse,
  JSONRPCErrorResponse,
} from '@modelcontextprotocol/sdk/types.js';
import {
  isJSONRPCRequest,
  isJSONRPCNotification,
  isJSONRPCResultResponse,
  isJSONRPCErrorResponse,
} from '@modelcontextprotocol/sdk/types.js';

export type { JSONRPCRequest, JSONRPCNotification, JSONRPCResultResponse, JSONRPCErrorResponse };
export { isJSONRPCRequest, isJSONRPCNotification, isJSONRPCResultResponse, isJSONRPCErrorResponse };

/** True for requests (method + id) and notifications (method, no id). */
export function isJSONRPCCallable(msg: JSONRPCMessage): msg is JSONRPCRequest | JSONRPCNotification {
  return isJSONRPCRequest(msg) || isJSONRPCNotification(msg);
}

/** True for both result responses and error responses. */
export function isJSONRPCAnyResponse(msg: JSONRPCMessage): msg is JSONRPCResultResponse | JSONRPCErrorResponse {
  return isJSONRPCResultResponse(msg) || isJSONRPCErrorResponse(msg);
}
