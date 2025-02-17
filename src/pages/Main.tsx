import {Col, message, Row} from "antd";
import ExcelParser from "../components/ExcelParser.tsx";
import ErrorBoundary from "../components/ErrorBoundary.tsx";
import {useState} from "react";
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import {atomDark, vscDarkPlus} from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel'; // For JavaScript/React
import { CopyOutlined } from '@ant-design/icons';


const Main = () => {


    const [code, setCode] = useState<string>("")

    const createTemplateString = async (columns: any) => {
        if (!columns) {
            message.error('Please provide data!');
        } else {
            // Transform the columns array into a JavaScript code string.
            function transformColumnsToJS(columns: any) {
                const transformCol = (col: any) => {
                    const props = [];
                    // Handle title
                    if (col.title === undefined) {
                        props.push(`title: ""`);
                    } else if (typeof col.title === 'string' && col.title.startsWith('t("') && col.title.endsWith('")')) {
                        props.push(`title: ${col.title}`);
                    } else {
                        props.push(`title: ${JSON.stringify(col.title)}`);
                    }

                    // Handle align
                    if (col.align !== undefined) {
                        props.push(`align: ${JSON.stringify(col.align)}`);
                    }

                    // Handle dataIndex
                    if (col.dataIndex !== undefined) {
                        props.push(`dataIndex: ${JSON.stringify(col.dataIndex)}`);
                    }

                    // Handle key
                    if (col.key !== undefined) {
                        props.push(`key: ${JSON.stringify(col.key)}`);
                    }

                    // Handle className
                    if (col.className !== undefined) {
                        props.push(`className: ${JSON.stringify(col.className)}`);
                    }

                    // Add render property if there are no children
                    if (!col.children) {
                        props.push(`render: (value, record, index) => value`);
                    }

                    // Handle children recursively
                    if (col.children && Array.isArray(col.children)) {
                        const childrenCode = transformColumnsToJS(col.children);
                        props.push(`children: ${childrenCode}`);
                    }

                    return `{\n\t\t${props.join(',\n\t\t')}\n\t}`;
                };

                return `[\n\t${columns.map(transformCol).join(',\n\t')}\n]`;
            }

            // Debug: log the received columns before transformation
            console.log("Received columns:", columns);

            // Parse the columns JSON and transform it.
            const parsedColumns = JSON.parse(columns);
            const transformedColumns = transformColumnsToJS(parsedColumns);

            const template = `import React from 'react';
import { ColumnsType } from 'antd/es/table';

const useColumns = () => {
  const columns: ColumnsType<any> = ${transformedColumns};
  return columns;
}

export default useColumns;
`;

            setCode(template);
        }
    }


    const generateColumns = async (tables: any[]) => {
         // If tables is an array of table objects, extract the columns from the first table.
         let cols;
         if (tables.length > 0 && tables[0].columns) {
             cols = tables[0].columns;
         } else {
             cols = tables;
         }

         const result = JSON.stringify(cols, null, 2);
         await createTemplateString(result);
    }

    return (
        <Row gutter={[16, 16]} className={"p-5"}>
            <Col span={12}>
                <ErrorBoundary>
                    <ExcelParser handleData={generateColumns}/>
                </ErrorBoundary>
            </Col>
            <Col span={12} className={"p-5"}>
                <div style={{ width: '100%', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                  <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: '#2d2d2d', 
                      padding: '0.5rem 1rem' 
                  }}>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>Generated Code</span>
                      <CopyOutlined 
                        style={{ color: '#fff', cursor: 'pointer' }} 
                        onClick={() => {
                          navigator.clipboard.writeText(code);
                          message.success("Code copied!");
                        }}
                      />
                  </div>
                  <SyntaxHighlighter
                    language="javascript" 
                    style={vscDarkPlus} 
                    customStyle={{
                      width: '100%',
                      margin: 0,
                      padding: '1rem',
                      borderBottomLeftRadius: "6px",
                      borderBottomRightRadius: "6px",
                    }}>
                    {code}
                  </SyntaxHighlighter>
                </div>
            </Col>

        </Row>
    )
}

export default Main