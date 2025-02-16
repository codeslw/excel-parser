import React from 'react';
import { Dropdown, Menu } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';

const colors = [
    { name: 'Green', class: 'td_green' },
    { name: 'Light Green', class: 'td_green2' },
    { name: 'Blue', class: 'td_blue' },
    { name: 'Light Blue', class: 'td_blue2' },
    { name: 'Default Gray', class: 'td_default' },
    { name: 'Violet', class: 'td_fiolet' },
    { name: 'Yellow', class: 'td_yellow' },
    { name: 'Brown', class: 'td_brown' },
    { name: 'Red', class: 'td_red' }
];

interface ColorPickerProps {
    onColorSelect: (colorClass: string) => void;
    currentColor?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ onColorSelect, currentColor }) => {
    const menu = (
        <Menu>
            {colors.map(color => (
                <Menu.Item 
                    key={color.class}
                    onClick={() => onColorSelect(color.class)}
                >
                    <div className={`${color.class} w-4 h-4 inline-block mr-2 border border-gray-300`} />
                    {color.name}
                </Menu.Item>
            ))}
        </Menu>
    );

    return (
        <Dropdown overlay={menu} trigger={['click']}>
            <BgColorsOutlined 
                className={`ml-2 cursor-pointer ${currentColor}`}
            />
        </Dropdown>
    );
};

export default ColorPicker; 