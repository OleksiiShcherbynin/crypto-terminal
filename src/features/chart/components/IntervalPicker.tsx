import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { INTERVALS, type Interval } from '../../../domain/types';
import { Segmented } from '../../../ui/Segmented';
import { intervalChanged } from '../../market/selectionSlice';

const OPTIONS = INTERVALS.map((i) => ({ value: i, label: i }));

export function IntervalPicker() {
  const dispatch = useAppDispatch();
  const interval = useAppSelector((s) => s.selection.interval);
  return (
    <Segmented
      aria-label="Interval"
      options={OPTIONS}
      value={interval}
      onChange={(v) => dispatch(intervalChanged(v as Interval))}
    />
  );
}
