import React, {useCallback, useMemo, useState} from 'react';
import {Upload, Table, Form, Input, Button, message} from 'antd';
import {InboxOutlined} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {useTranslation} from 'react-i18next';

interface ExcelColumn {
    title: string;
    dataIndex: string;
    key: string;
    children?: ExcelColumn[];

}

interface CellRange {
    startCell: string;
    endCell: string;
}

interface  IProps {
    handleErrors : (errors : any) => void
}

const ExcelParserv1: React.FC = (props : IProps) => {
    const {t} = useTranslation();
    const [columns, setColumns] = useState<ExcelColumn[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [excelFile, setExcelFile] = useState<any>(null);

    const parseExcelRange = (_sheet: XLSX.WorkSheet, range: CellRange) => {
        // Convert cell references to indices
        const startMatch = range.startCell.match(/([A-Z]+)(\d+)/);
        const endMatch = range.endCell.match(/([A-Z]+)(\d+)/);

        if (!startMatch || !endMatch) {
            throw new Error('Invalid cell range format');
        }

        const startCol = XLSX.utils.decode_col(startMatch[1]);
        const startRow = parseInt(startMatch[2]) - 1;
        const endCol = XLSX.utils.decode_col(endMatch[1]);
        const endRow = parseInt(endMatch[2]) - 1;

        return {startCol, startRow, endCol, endRow};
    };

    const processHeaderRow = (
        sheet: XLSX.WorkSheet,
        rowIndex: number,
        startCol: number,
        endCol: number,
        parentKey = ''
    ): ExcelColumn[] => {
        const columns: ExcelColumn[] = [];
        let currentCol = startCol;

        while (currentCol <= endCol) {
            const cellAddress = XLSX.utils.encode_cell({r: rowIndex, c: currentCol});
            const cell = sheet[cellAddress];

            if (cell) {
                const column: ExcelColumn = {
                    title: t(cell.v.toString()),
                    dataIndex: `${parentKey}${cell.v.toString().toLowerCase().replace(/\s+/g, '_')}`,
                    key: `${parentKey}${cell.v.toString().toLowerCase().replace(/\s+/g, '_')}`
                };

                // Check for merged cells
                const merges : any = sheet['!merges'];
                const merger = merges.find((m : any) =>
                    m.s.r === rowIndex &&
                    m.s.c === currentCol
                );

                if (merger) {
                    // If merged cell spans multiple rows, process children
                    if (merger.e.r > merger.s.r) {
                        column.children = processHeaderRow(
                            sheet,
                            rowIndex + 1,
                            merger.s.c,
                            merger.e.c,
                            `${column.dataIndex}_`
                        );
                        currentCol = merger.e.c;
                    }
                }

                columns.push(column);
            }
            currentCol++;
        }

        return columns;
    };




    const processData = (
        sheet: XLSX.WorkSheet,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
    ): any[] => {
        const data = [];

        for (let r = startRow; r <= endRow; r++) {
            const rowData: any = {};

            for (let c = startCol; c <= endCol; c++) {
                const cellAddress = XLSX.utils.encode_cell({r, c});
                const cell = sheet[cellAddress];
                if (cell) {
                    const columnHeader = XLSX.utils.encode_col(c);
                    rowData[columnHeader] = cell.v;
                }
            }

            data.push(rowData);
        }

        return data;
    };

    const handleUpload = useCallback(async (file: File) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            return {status: 'success', workbook, sheet: firstSheet};
        } catch (error : any) {
            console.log(error)
            message.error('Error processing file');
            return {status: 'error'};
        }
    }, []);

    const onFinish = async (values: { startCell: string; endCell: string }) => {
        // const fileList = (document.querySelector('input[type="file"]') as HTMLInputElement)?.files;
        if (!excelFile) {
            message.error('Please select a file');
            return;
        }

        const result = await handleUpload(excelFile);
        if (result.status === 'error') return;

        const {sheet} = result;
        const {startCol, startRow, endCol, endRow} = parseExcelRange(sheet!, {
            startCell: values.startCell,
            endCell: values.endCell
        });

        const processedColumns = processHeaderRow(sheet!, startRow, startCol, endCol)


        const processedData = processData(sheet!, startRow + 1, endRow, startCol, endCol);

        setColumns(processedColumns);
        setData(processedData);
    };

    return (
        <div className="p-6">
            <Form onFinish={onFinish} layout="vertical">
                <Form.Item
                    label="Start Cell"
                    name="startCell"
                    rules={[{required: true, message: 'Please input start cell!'}]}
                >
                    <Input placeholder="e.g. A3"/>
                </Form.Item>

                <Form.Item
                    label="End Cell"
                    name="endCell"
                    rules={[{required: true, message: 'Please input end cell!'}]}
                >
                    <Input placeholder="e.g. M5"/>
                </Form.Item>

                <Upload.Dragger
                    accept=".xlsx,.xls"
                    customRequest={(options : any) => {
                        if (options.onSuccess) {
                            options.onSuccess(options.file)
                        }
                    }}
                    onChange={(info : any) => {
                        if (info.file.status === 'done') {
                            setExcelFile(info.file.originFileObj)
                        }
                    }}

                    //beforeUpload={() => false}
                    maxCount={1}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined/>
                    </p>
                    <p className="ant-upload-text">Click or drag file to this area to upload</p>
                </Upload.Dragger>

                <Button type="primary" htmlType="submit" className="mt-4">
                    Process Excel
                </Button>
            </Form>

            {columns.length > 0 && (
                <Table
                    columns={columns}
                    dataSource={data}
                    className="mt-6"
                    scroll={{x: true}}
                />
            )}
        </div>
    );
};

export default ExcelParserv1;