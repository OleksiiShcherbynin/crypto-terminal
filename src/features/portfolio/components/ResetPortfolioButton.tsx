import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { portfolioReset } from '../../../domain/actions';
import { Button } from '../../../ui/Button';

export function ResetPortfolioButton() {
  const dispatch = useDispatch();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Reset portfolio
      </Button>
    );
  }

  return (
    <div
      className="flex items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setConfirming(false);
      }}
    >
      <span className="text-xs text-muted">Reset to 10,000 USDT?</span>
      <Button
        variant="sell"
        size="sm"
        autoFocus
        onClick={() => {
          dispatch(portfolioReset());
          setConfirming(false);
        }}
      >
        Confirm
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
