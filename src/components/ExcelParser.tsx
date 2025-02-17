import React, {useCallback, useState} from 'react';
import {Upload, Table, Form, Input, Button, message, Select} from 'antd';
import {InboxOutlined, PlusOutlined, MinusCircleOutlined} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {useTranslation} from 'react-i18next';
import ExcelPreviewModal from './ExcelPreviewModal';
import { ColumnsType } from 'antd/es/table';
import { parseExcelRange, processHeaderRow } from '../../utils/excelUtils';
import TableConfigForm from './TableConfigForm';
import FileUploader from './FileUploader';
import ColorPicker from './excel/ColorPicker';
import { ExcelParserProps, ParsedTable, TableConfig, ExcelColumn } from '../types/excel';

interface ExcelColumn {
    title: string;
    align : string;
    dataIndex?: string;
    key?: string;
    className?: string;
    children?: ExcelColumn[];
    originalTitle?: string;
    displayTitle?: React.ReactNode;
}

interface CellRange {
    startCell: string;
    endCell: string;
}

const ExcelParser: React.FC<ExcelParserProps> = ({ handleData }) => {
    const {t} = useTranslation();
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [tables, setTables] = useState<ParsedTable[]>([]);
    const [previewVisible, setPreviewVisible] = useState<boolean>(false);
    const [columnColors, setColumnColors] = useState<Record<string, string>>({});

    const handleColorChange = (dataIndex: string, colorClass: string) => {
        setColumnColors(prev => ({
            ...prev,
            [dataIndex]: colorClass
        }));

        const updatedTables = tables.map(table => ({
            ...table,
            columns: updateColumnsWithColor(table.columns, dataIndex, colorClass)
        }));

        setTables(updatedTables);
        // Convert the updated columns to JSON string before passing to handleData
        const result = JSON.stringify(updatedTables[0].columns, null, 2);
        handleData(result);  // This will trigger code generation in Main.tsx
    };

    const updateColumnsWithColor = (columns: ExcelColumn[], dataIndex: string, colorClass: string): ExcelColumn[] => {
        return columns.map(col => {
            let updatedCol = { ...col };

            // If this is the target column or its dataIndex starts with the target dataIndex
            // (meaning it's a child of the target), apply the color
            if (col.dataIndex === dataIndex || col.dataIndex?.startsWith(dataIndex + '_child_')) {
                updatedCol.className = colorClass;
            }

            // Recursively update children
            if (col.children) {
                updatedCol.children = updateColumnsWithColor(col.children, dataIndex, colorClass);
            }

            return updatedCol;
        });
    };

    const parseExcelRange = (_sheet: XLSX.WorkSheet, range: CellRange) => {
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

    const processHeaderRow = (
        sheet: XLSX.WorkSheet,
        rowIndex: number,
        startCol: number,
        endCol: number,
        depth: number = 0,
        processedMerges: Set<string> = new Set()
    ): ExcelColumn[] => {
        const columns: ExcelColumn[] = [];
        let currentCol = startCol;

        console.log(startCol, endCol, processedMerges, depth, " startCol endCol processedMerges depth");

        while (currentCol <= endCol) {
            const cellAddress = XLSX.utils.encode_cell({
                r: rowIndex,
                c: currentCol
            });
            const cell = sheet[cellAddress];
            const merges = sheet['!merges'] || [];

            // Find if the cell is part of a merge
            const merge = merges.find(
                (m) =>
                    currentCol >= m.s.c &&
                    currentCol <= m.e.c &&
                    rowIndex >= m.s.r &&
                    rowIndex <= m.e.r
            );

            // Generate a unique key for this merge
            const mergeKey = merge ? `${merge.s.r}-${merge.s.c}-${merge.e.r}-${merge.e.c}` : '';

            // Skip already processed merges
            if (merge && processedMerges.has(mergeKey)) {
                currentCol = merge.e.c + 1; // Skip to the end of the merged range
                continue;
            }

            if (cell || merge) {
                const titleText = `t("${cell?.v?.toString()}")` || '';
                // Generate unique dataIndex based on column position
                const dataIndex = `col_${currentCol - startCol}`;
                
                const column: ExcelColumn = {
                    title: titleText,
                    originalTitle: titleText,
                    align : "center",
                    dataIndex,
                    key: dataIndex,
                    ...(merge?.e?.c! > merge?.s?.c! ? {} : {render: (value: any) => value})
                };

                if (merge) {
                    processedMerges.add(mergeKey);

                    // Check if this merge spans multiple rows (nested headers)
                    if (merge.e.c > merge.s.c) {
                        console.log(merge, " merge");
                        // Process child columns for the next row within the merge range
                        const children = processHeaderRow(
                            sheet,
                            merge.s.r + 1, // Next row
                            merge.s.c, // Start column of the merge
                            merge.e.c, // End column of the merge
                            depth + 1,
                            processedMerges
                        );

                        if (children.length > 0) {
                            column.children = children;
                        }
                    }

                    // Skip to the end of the merged columns
                    currentCol = merge.e.c;
                }

                columns.push(column);
            }

            currentCol++;
        }


        return columns;
    };

    const processColumnsWithColors = (columns: ExcelColumn[]): ExcelColumn[] => {
        return columns.map(col => {
            const titleStr = col.title?.toString() || '';
            const colorClass = columnColors[titleStr];
            
            return {
                ...col,
                className: colorClass,
                displayTitle: (
                    <div className="flex items-center justify-between">
                        <span>{titleStr}</span>
                        <ColorPicker 
                            currentColor={colorClass}
                            onColorSelect={(color) => handleColorChange(titleStr, color)}
                        />
                    </div>
                ),
                children: col.children ? processColumnsWithColors(col.children) : undefined
            };
        });
    };

    const handleUpload = useCallback(async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            setWorkbook(workbook);
            setSheetNames(workbook.SheetNames);
            return {
                status: 'success',
                workbook
            };
        } catch (error: any) {
            console.error(error);
            message.error('Error processing file');
            return {status: 'error'};
        }
    }, []);

    const onFinish = async (values: { tableConfigs: { sheet: string; startCell: string; endCell: string }[] }) => {
        if (!excelFile || !workbook) {
            message.error('Please select and upload an Excel file');
            return;
        }

        const parsedTables: ParsedTable[] = [];

        values.tableConfigs.forEach(config => {
            const sheet = workbook.Sheets[config.sheet];
            if (!sheet) {
                message.error(`Sheet ${config.sheet} not found`);
                return;
            }

            const { startCol, startRow, endCol, endRow } = parseExcelRange(sheet, {
                startCell: config.startCell,
                endCell: config.endCell
            });

            // Get the base columns for generated code
            const columns = processHeaderRow(sheet, startRow, startCol, endCol);

            parsedTables.push({ 
                sheetName: config.sheet, 
                columns, // Store original columns
                data: [] 
            });
        });

        setTables(parsedTables);
        handleData(parsedTables); // This will have the clean columns for code generation
    };

    // Prepare display columns (for Table component only)
    const prepareDisplayColumns = (columns: ExcelColumn[]): ColumnsType<any> => {
        return columns.map(col => ({
            ...col,
            title: (
                <div className="flex items-center justify-between">
                    <span>{col.title}</span>
                    <ColorPicker 
                        currentColor={columnColors[col.dataIndex]}
                        onColorSelect={(color) => handleColorChange(col.dataIndex!, color)}
                    />
                </div>
            ),
            children: col.children ? prepareDisplayColumns(col.children) : undefined
        }));
    };

    return (
        <div className="p-6">
            <Form onFinish={onFinish} layout="vertical">
                <Form.List name="tableConfigs">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <div key={key} className='flex mb-2 space-x-5 items-center'>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'sheet']}
                                        rules={[{ required: true, message: 'Select a sheet' }]}
                                    >
                                        <Select placeholder="Select sheet" className='w-40'>
                                            {sheetNames.map((sheet, index) => (
                                                <Select.Option key={sheet} value={sheet}>
                                                    {`${index + 1} - ${sheet}`}
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'startCell']}
                                        rules={[{ required: true, message: 'Start cell is required' }]}
                                    >
                                        <Input placeholder="Start Cell (e.g. A3)" className='w-40' />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'endCell']}
                                        rules={[{ required: true, message: 'End cell is required' }]}
                                    >
                                        <Input placeholder="End Cell (e.g. M5)" className='w-40' />
                                    </Form.Item>
                                    <div className='h-full flex items-center justify-center mb-6'>
                                      <MinusCircleOutlined size={24} onClick={() => remove(name)} />
                                    </div>
                                </div>
                            ))}
                            <Form.Item>
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                    Add Table Config
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>

                <Upload.Dragger
                    accept=".xlsx,.xls"
                    style={{ marginBottom: '16px' }}
                    customRequest={(file) => {
                        if(file.onSuccess) {
                            file.onSuccess(file.file)
                        }
                    }}
                    onChange={(info: any) => {
                        if (info.file.status === 'done') {
                            const fileObj = info.file.originFileObj;
                            setExcelFile(fileObj);
                            // Parse the workbook immediately to fill available sheet names
                            handleUpload(fileObj);
                        }
                    }}
                    maxCount={1}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined/>
                    </p>
                    <p className="ant-upload-text">Click or drag file to this area to upload</p>
                </Upload.Dragger>

                <div className="mt-4" style={{ display: 'flex', gap: '8px' }}>
                    <Button type="default" onClick={() => setPreviewVisible(true)} disabled={!workbook}>
                        Preview Excel
                    </Button>
                    <Button type="primary" htmlType="submit">
                        Process Excel
                    </Button>
                </div>
            </Form>

            {tables.length > 0 && tables.map((table, index) => (
                <div key={index}>
                    <h3 className="mt-4">Sheet: {table.sheetName}</h3>
                    <Table
                        columns={prepareDisplayColumns(table.columns)}
                        dataSource={table.data}
                        className="mt-2"
                        scroll={{ x: true }}
                    />
                </div>
            ))}

            {previewVisible && (
                <ExcelPreviewModal
                    visible={previewVisible}
                    onCancel={() => setPreviewVisible(false)}
                    workbook={workbook}
                />
            )}
        </div>
    );
};

export default ExcelParser;