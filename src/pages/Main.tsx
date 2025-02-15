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
                    // Check if title is defined
                    if (col.title === undefined) {
                        props.push(`\n\t\ttitle: ""`);
                    } else if (typeof col.title === 'string' && col.title.startsWith('t("') && col.title.endsWith('")')) {
                        // Output the function call code without extra quotes.
                        props.push(`\n\t\ttitle: ${col.title}`);
                    } else {
                        props.push(`\ttitle: ${JSON.stringify(col.title)}`);
                    }

                    if (col.align !== undefined) {
                        props.push(`\talign: ${JSON.stringify(col.align)}`);
                    }
                    if (col.dataIndex !== undefined) {
                        props.push(`\tdataIndex: ${JSON.stringify(col.dataIndex)}`);
                    }
                    if (col.key !== undefined) {
                        props.push(`\tkey: ${JSON.stringify(col.key)}`);
                    }

                    // Add a render property if there are no children.
                    if (!col.children) {
                        props.push(`\trender: (value, record, index) => value`);
                    }

                    // Recursively handle children if they exist.
                    if (col.children && Array.isArray(col.children)) {
                        const childrenCode = transformColumnsToJS(col.children);
                        props.push(`children: ${childrenCode}\n`);
                    }

                    return `\n\t{ ${props.join(',\n\t')} \n\t}`;
                };

                return `[\n${columns.map(transformCol).join(',\n ')}\n]`;
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