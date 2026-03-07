export const getDisplayedProviderModels = (availableModels: string[], input: string): string[] => {
  const current = input.trim().toLowerCase();
  if (!current) {
    return availableModels;
  }

  const hasExactMatch = availableModels.some(model => model.toLowerCase() === current);
  if (hasExactMatch) {
    return availableModels;
  }

  const filtered = availableModels.filter(model => model.toLowerCase().includes(current));
  return filtered.length > 0 ? filtered : availableModels;
};
