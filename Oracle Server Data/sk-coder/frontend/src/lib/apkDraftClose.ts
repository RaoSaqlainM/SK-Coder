export async function closeAfterDraftSave(saveDraft: () => Promise<boolean>, closeEditor: () => void): Promise<void> {
    if (await saveDraft())
        closeEditor();
}
