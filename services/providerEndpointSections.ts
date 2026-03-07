import { APIEndpoint } from '../types';

export type ProviderEndpointSection = {
  key: string;
  groupName?: string;
  endpoints: APIEndpoint[];
  isUngrouped: boolean;
};

export const buildProviderEndpointSections = (endpoints: APIEndpoint[]): ProviderEndpointSection[] => {
  const groupedMap = new Map<string, APIEndpoint[]>();
  const ungrouped: APIEndpoint[] = [];

  endpoints.forEach((endpoint) => {
    if (endpoint.group) {
      if (!groupedMap.has(endpoint.group)) {
        groupedMap.set(endpoint.group, []);
      }
      groupedMap.get(endpoint.group)!.push(endpoint);
      return;
    }

    ungrouped.push(endpoint);
  });

  const sections: ProviderEndpointSection[] = Array.from(groupedMap.entries()).map(([groupName, groupedEndpoints]) => ({
    key: `group:${groupName}`,
    groupName,
    endpoints: groupedEndpoints,
    isUngrouped: false,
  }));

  if (ungrouped.length > 0) {
    sections.push({
      key: 'group:__ungrouped__',
      endpoints: ungrouped,
      isUngrouped: true,
    });
  }

  return sections;
};
