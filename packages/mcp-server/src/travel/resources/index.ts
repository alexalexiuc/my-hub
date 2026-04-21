import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, toSdkReadResourceCallback, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getTravelTripsResource, getTravelUpcomingResource, getTravelUploadPolicyResource } from './resources';

const travelResources = [
  defineResource({
    name: 'travel-trips',
    uri: 'travel://trips',
    description: 'All trips for the authenticated user.',
    mimeType: 'application/json',
    callback: getTravelTripsResource,
  }),
  defineResource({
    name: 'travel-upcoming',
    uri: 'travel://upcoming',
    description: 'Next upcoming trip and departures in the next 48 hours.',
    mimeType: 'application/json',
    callback: getTravelUpcomingResource,
  }),
  defineResource({
    name: 'travel-upload-policy',
    uri: 'travel://upload-policy',
    description: 'Travel document upload constraints (max file size and allowed MIME types).',
    mimeType: 'application/json',
    callback: getTravelUploadPolicyResource,
  }),
];

export function registerTravelResources(server: McpServer): void {
  for (const resource of travelResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      resource.skipUserIdCheck
        ? toSdkReadResourceCallback(resource.callback)
        : withUserIdCheckResource(resource.callback),
    );
  }
}
