import * as XLSX from 'xlsx';
import { CellRange, ExcelColumn } from '../types/excel';

export const parseExcelRange = (sheet: XLSX.WorkSheet, range: CellRange) => {
    const startMatch = range.startCell.match(/([A-Z]+)(\d+)/);
    const endMatch = range.endCell.match(/([A-Z]+)(\d+)/);

    if (!startMatch || !endMatch) {
        throw new Error('Invalid cell range format');
    }

    const startCol = XLSX.utils.decode_col(startMatch[1]);
    const startRow = parseInt(startMatch[2]) - 1;
    const endCol = XLSX.utils.decode_col(endMatch[1]);
    const endRow = parseInt(endMatch[2]) - 1;

    return {
        startCol,
        startRow,
        endCol,
        endRow
    };
};

const DEFAULT_COLOR_ORDER = [
    'td_green',
    'td_green',
    'td_blue',
    'td_blue2',
    'td_default',
    'td_fiolet',
    'td_green2',
    'td_yellow',
    'td_brown',
    'td_red'
];

interface ProcessHeaderOptions {
    colorOrder?: string[];
    startColorIndex?: number;
}

export const processHeaderRow = (
    sheet: XLSX.WorkSheet,
    rowIndex: number,
    startCol: number,
    endCol: number,
    depth: number = 0,
    processedMerges: Set<string> = new Set()
): ExcelColumn[] => {
    const columns: ExcelColumn[] = [];
    let currentCol = startCol;

    while (currentCol <= endCol) {
        const cellAddress = XLSX.utils.encode_cell({
            r: rowIndex,
            c: currentCol
        });
        const cell = sheet[cellAddress];
        const merges = sheet['!merges'] || [];

        const merge = merges.find(
            (m) =>
                currentCol >= m.s.c &&
                currentCol <= m.e.c &&
                rowIndex >= m.s.r &&
                rowIndex <= m.e.r
        );

        const mergeKey = merge ? `${merge.s.r}-${merge.s.c}-${merge.e.r}-${merge.e.c}` : '';

        if (merge && processedMerges.has(mergeKey)) {
            currentCol = merge.e.c + 1;
            continue;
        }

        if (cell || merge) {
            const colorClass = DEFAULT_COLOR_ORDER[(currentCol - startCol) % DEFAULT_COLOR_ORDER.length];
            
            const titleText = `t("${cell?.v?.toString()}")` || '';
            const column: ExcelColumn = {
                title: titleText,
                originalTitle: titleText,
                align: "center",
                key: cell?.v?.toString() || '',
                className: colorClass,
                dataIndex: cell?.v?.toString() || '',
                ...(merge?.e?.c! > merge?.s?.c! ? {} : { render: (value: any) => value })
            };

            if (merge) {
                processedMerges.add(mergeKey);

                if (merge.e.c > merge.s.c) {
                    // Pass parent's color class to children
                    const children = processHeaderRow(
                        sheet,
                        merge.s.r + 1,
                        merge.s.c,
                        merge.e.c,
                        depth + 1,
                        processedMerges
                    );

                    if (children.length > 0) {
                        column.children = children.map(child => ({
                            ...child,
                            className: colorClass // Inherit parent's color
                        }));
                    }
                }

                currentCol = merge.e.c;
            }

            columns.push(column);
        }

        currentCol++;
    }

    return columns;
}; 