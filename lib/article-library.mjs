export function combineArticles(existing, imported, existingMode) {
  const added = imported.map(article => ({ ...article, isSample: false, dataOrigin: 'local' }));
  const previous = existing.map(article => ({ ...article, isSample: existingMode === 'mock', dataOrigin: existingMode }));
  return {
    data: [...added, ...previous],
    mode: added.length ? existingMode === 'mock' ? 'mixed' : 'combined' : existingMode
  };
}
