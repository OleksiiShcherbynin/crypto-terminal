import { useSelector } from 'react-redux';
import { Button } from '../../ui/Button';
import { selectExternalChange } from '../appSlice';

export function ExternalChangeBanner() {
  const changed = useSelector(selectExternalChange);
  if (!changed) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent"
    >
      <span>This terminal was changed in another tab. Reload to sync.</span>
      <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
