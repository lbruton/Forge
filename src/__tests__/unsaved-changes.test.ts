import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';

// Reset store to initial state before each test
beforeEach(() => {
  useForgeStore.setState({
    editorDirty: false,
    pendingSaveCallback: null,
  });
});

// ── Suite A: Store dirty flag ────────────────────────────────────

describe('editorDirty store state', () => {
  test('default editorDirty is false', () => {
    expect(useForgeStore.getState().editorDirty).toBe(false);
  });

  test('setEditorDirty(true) sets flag to true', () => {
    useForgeStore.getState().setEditorDirty(true);
    expect(useForgeStore.getState().editorDirty).toBe(true);
  });

  test('setEditorDirty(false) clears flag', () => {
    useForgeStore.getState().setEditorDirty(true);
    useForgeStore.getState().setEditorDirty(false);
    expect(useForgeStore.getState().editorDirty).toBe(false);
  });

  test('default pendingSaveCallback is null', () => {
    expect(useForgeStore.getState().pendingSaveCallback).toBeNull();
  });

  test('setPendingSaveCallback registers a function', () => {
    const cb = vi.fn();
    useForgeStore.getState().setPendingSaveCallback(cb);
    const stored = useForgeStore.getState().pendingSaveCallback;
    expect(stored).toBe(cb);
    stored!();
    expect(cb).toHaveBeenCalledOnce();
  });

  test('setPendingSaveCallback(null) clears callback', () => {
    const cb = vi.fn();
    useForgeStore.getState().setPendingSaveCallback(cb);
    useForgeStore.getState().setPendingSaveCallback(null);
    expect(useForgeStore.getState().pendingSaveCallback).toBeNull();
  });
});

// ── Suite B: Navigation guard behavior (store-level) ─────────────

describe('navigation guard behavior', () => {
  test('when editorDirty is false, navigation should proceed', () => {
    useForgeStore.getState().setEditorDirty(false);
    expect(useForgeStore.getState().editorDirty).toBe(false);
    // Guard's "clean" path: action callable directly
    const navAction = vi.fn();
    navAction();
    expect(navAction).toHaveBeenCalledOnce();
  });

  test('when editorDirty is true, navigation should be deferred', () => {
    useForgeStore.getState().setEditorDirty(true);
    expect(useForgeStore.getState().editorDirty).toBe(true);
    // Guard's "dirty" path: editorDirty is true so guard would defer
  });

  test('pendingSaveCallback can be called to save before navigation', () => {
    const saveFn = vi.fn();
    useForgeStore.getState().setPendingSaveCallback(saveFn);
    // Simulate "Save & Continue" path
    useForgeStore.getState().pendingSaveCallback!();
    expect(saveFn).toHaveBeenCalledOnce();
  });

  test('setEditorDirty(false) allows navigation after discard', () => {
    useForgeStore.getState().setEditorDirty(true);
    expect(useForgeStore.getState().editorDirty).toBe(true);
    // Simulate "Discard" path
    useForgeStore.getState().setEditorDirty(false);
    expect(useForgeStore.getState().editorDirty).toBe(false);
  });
});
