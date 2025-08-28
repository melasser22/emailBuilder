import React, { useRef, useState } from 'react';
import BlocksMenu from './BlocksMenu';
import DividerButton from './DividerButton';
import PlaceholderButton from './PlaceholderButton';
export default function AddBlockButton({ onSelect, placeholder }) {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const buttonRef = useRef(null);
    const handleButtonClick = (ev) => {
        setMenuAnchorEl(buttonRef.current);
    };
    const renderButton = () => {
        if (placeholder) {
            return React.createElement(PlaceholderButton, { onClick: handleButtonClick });
        }
        else {
            return (React.createElement(DividerButton, { buttonElement: buttonRef.current, onClick: handleButtonClick }));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: buttonRef, style: { position: 'relative' } }, renderButton()),
        React.createElement(BlocksMenu, { anchorEl: menuAnchorEl, setAnchorEl: setMenuAnchorEl, onSelect: onSelect })));
}
//# sourceMappingURL=index.js.map