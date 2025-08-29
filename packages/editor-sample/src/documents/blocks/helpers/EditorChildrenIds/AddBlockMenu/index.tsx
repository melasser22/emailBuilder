import React, { useRef, useState } from 'react';

import { TEditorBlock } from '../../../../editor/core';

import BlocksMenu from './BlocksMenu';
import DividerButton from './DividerButton';
import PlaceholderButton from './PlaceholderButton';

type Props = {
  placeholder?: boolean;
  onSelect: (block: TEditorBlock) => void;
};
export default function AddBlockButton({ onSelect, placeholder }: Props) {const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLElement | null>(null);

  const handleButtonClick = (ev: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(ev.currentTarget as HTMLElement);
  };

  const renderButton = () => {
    if (placeholder) {
      return <PlaceholderButton onClick={handleButtonClick} />;
    } else {return (
        <DividerButton
          buttonElement={buttonRef.current}
          onClick={handleButtonClick}
        />
      );
    }
  };

  return ( <>
      <div ref={buttonRef} style={{ position: 'relative' }}>
        {renderButton()}
      </div>
      <BlocksMenu
        anchorEl={menuAnchorEl}
        setAnchorEl={setMenuAnchorEl}
        onSelect={onSelect}
      />
    </>
  );
}
