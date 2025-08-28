import React, { useRef, useState } from 'react';

import { TEditorBlock } from '../../../../editor/core';

import BlocksMenu from './BlocksMenu';
import DividerButton from './DividerButton';
import PlaceholderButton from './PlaceholderButton';

type Props = {
  placeholder?: boolean;
  onSelect: (block: TEditorBlock) => void;
};
export default function AddBlockButton({ onSelect, placeholder }: Props) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const buttonElementRef = useRef<HTMLElement | null>(null);
const handleButtonClick = (ev: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(ev.currentTarget);
  };

  const renderButton = () => {
    if (placeholder) {
      return <PlaceholderButton onClick={handleButtonClick} />;
    } else {
      return (
        <DividerButton   
          buttonElement={buttonElement}

          onClick={handleButtonClick}
        />
      );
    }
  };

  return (
    <>
      <div
        ref={(el) => {
          buttonElementRef.current = el;
        }}
        style={{ position: 'relative' }}
      >
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
