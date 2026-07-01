import { useCallback, useEffect, useState } from 'react';

import { formsEqual } from '../lib/catalog-form';

export function useCatalogEditor<T>(selectedId: string | null, toForm: (item: unknown) => T) {
  const [form, setForm] = useState<T | null>(null);
  const [baseline, setBaseline] = useState<T | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const resetFromItem = useCallback(
    (item: unknown) => {
      const next = toForm(item);
      setForm(next);
      setBaseline(next);
      setIsEditing(false);
    },
    [toForm],
  );

  useEffect(() => {
    if (!selectedId) {
      setForm(null);
      setBaseline(null);
      setIsEditing(false);
    }
  }, [selectedId]);

  const isDirty = form !== null && baseline !== null && !formsEqual(form, baseline);

  function startEdit() {
    setIsEditing(true);
  }

  function cancelEdit() {
    if (baseline) setForm(baseline);
    setIsEditing(false);
  }

  function commitSaved(next: T) {
    setForm(next);
    setBaseline(next);
    setIsEditing(false);
  }

  function selectItem(item: unknown) {
    resetFromItem(item);
  }

  return {
    form,
    setForm,
    baseline,
    isEditing,
    isDirty,
    fieldsDisabled: !isEditing,
    startEdit,
    cancelEdit,
    commitSaved,
    selectItem,
    resetFromItem,
  };
}
