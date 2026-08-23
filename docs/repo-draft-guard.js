(() => {
  const DRAFT_KEY = 'spellwright-project-draft';
  const REVISION_KEY = 'spellwright-project-draft-revision';
  const BACKUP_KEY = 'spellwright-project-draft-stale-backup';
  const CURRENT_REVISION = 'project-data-20260823-1';

  const storage = window.localStorage;
  const currentDraft = storage.getItem(DRAFT_KEY);
  const draftRevision = storage.getItem(REVISION_KEY);

  // A local draft is only allowed to override repository data when it was
  // created against the same canonical data revision. Older bare drafts are
  // backed up once and discarded from the active slot instead of silently
  // hiding systems that were added to the repository later.
  if (currentDraft && draftRevision !== CURRENT_REVISION) {
    storage.setItem(BACKUP_KEY, currentDraft);
    storage.removeItem(DRAFT_KEY);
    storage.removeItem(REVISION_KEY);
  }

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function setItem(key, value) {
    if (this === storage && key === DRAFT_KEY) {
      originalSetItem.call(this, REVISION_KEY, CURRENT_REVISION);
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function removeItem(key) {
    if (this === storage && key === DRAFT_KEY) {
      originalRemoveItem.call(this, REVISION_KEY);
    }
    return originalRemoveItem.call(this, key);
  };
})();
