import { WorkBook } from 'xlsx';

export interface ExcelColumn {
    title: string;
    align: string;
    dataIndex?: string;
    key?: string;
    className?: string;
    children?: ExcelColumn[];
    displayTitle?: React.ReactNode;
}

export interface CellRange {
    startCell: string;
    endCell: string;
}

export interface TableConfig {
    sheet: string;
    startCell: string;
    endCell: string;
}

export interface ParsedTable {
    sheetName: string;
    columns: ExcelColumn[];
    data: any[];
}

export interface ExcelParserProps {
    handleData: (columns: Record<string, any>[]) => Promise<void>;
} 