import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Segmented } from 'antd';
// IMPORTANT: For cell style information, use a style-aware library such as "xlsx-style".
// The standard "xlsx" library does not import cell formatting.
import * as XLSX from 'xlsx';

interface ExcelPreviewModalProps {
  visible: boolean;
  onCancel: () => void;
  workbook: XLSX.WorkBook | null;
}

const ExcelPreviewModal: React.FC<ExcelPreviewModalProps> = ({ visible, onCancel, workbook }) => {
  // Local state for tracking the selected sheet.
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // When the workbook changes, default to the first sheet.
  useEffect(() => {
    if (workbook && workbook.SheetNames.length > 0) {
      setSelectedSheet(workbook.SheetNames[0]);
    }
  }, [workbook]);

  // Helper: Retrieve inline CSS based on a cell's style.
  const getCellStyle = (cell: any): string => {
    let styles = "";
    if (cell && cell.s) {
      // Background color (expects cell.s.fill.fgColor.rgb, e.g. "FFFF00" without the "#")
      if (cell.s.fill && cell.s.fill.fgColor && cell.s.fill.fgColor.rgb) {
        styles += `background-color:#${cell.s.fill.fgColor.rgb};`;
      }
      // Font styling.
      if (cell.s.font) {
        if (cell.s.font.bold) {
          styles += "font-weight:bold;";
        }
        if (cell.s.font.underline) {
          styles += "text-decoration:underline;";
        }
        if (cell.s.font.italic) {
          styles += "font-style:italic;";
        }
        if (cell.s.font.color && cell.s.font.color.rgb) {
          styles += `color:#${cell.s.font.color.rgb};`;
        }
        if (cell.s.font.sz) {
          styles += `font-size:${cell.s.font.sz}px;`;
        }
        if (cell.s.font.name) {
          styles += `font-family:${cell.s.font.name};`;
        }
      }
    }
    return styles;
  };

  // Build an HTML table using the sheet's effective range, merged cell info, and cell styling.
  const htmlString = useMemo(() => {
    if (!workbook || !selectedSheet) return "";
    const sheet = workbook.Sheets[selectedSheet];
    const ref = sheet["!ref"];
    if (!ref) return "";

    // Decode the declared range (for example, "A1:AD9").
    const range = XLSX.utils.decode_range(ref);

    // Adjust the effective range to eliminate trailing empty columns.
    let newEndC = range.e.c;
    for (let c = range.e.c; c >= range.s.c; c--) {
      let colEmpty = true;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.v !== undefined && cell.v !== "") {
          colEmpty = false;
          break;
        }
      }
      if (colEmpty) {
        newEndC = c - 1;
      } else {
        break;
      }
    }

    // Similarly, remove trailing empty rows.
    let newEndR = range.e.r;
    for (let r = range.e.r; r >= range.s.r; r--) {
      let rowEmpty = true;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.v !== undefined && cell.v !== "") {
          rowEmpty = false;
          break;
        }
      }
      if (rowEmpty) {
        newEndR = r - 1;
      } else {
        break;
      }
    }
    const effectiveRange = { s: range.s, e: { r: newEndR, c: newEndC } };

    // Process merged ranges from the sheet.
    const merges = sheet["!merges"] || [];
    const mergeStart: { [key: string]: { colspan: number, rowspan: number } } = {};
    const skipCells: { [key: string]: boolean } = {};
    merges.forEach(merge => {
      const startRow = merge.s.r;
      const startCol = merge.s.c;
      const endRow = merge.e.r;
      const endCol = merge.e.c;
      // Record the starting cell along with its colspan and rowspan.
      mergeStart[`${startRow},${startCol}`] = {
        colspan: endCol - startCol + 1,
        rowspan: endRow - startRow + 1
      };
      // Mark all cells (other than the starting one) that are covered by the merge.
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (r === startRow && c === startCol) continue;
          skipCells[`${r},${c}`] = true;
        }
      }
    });

    // Utility: Convert a zero-based column index to an Excel-style column letter.
    const getColumnLetter = (col: number): string => {
      let letter = '';
      while (col >= 0) {
        letter = String.fromCharCode((col % 26) + 65) + letter;
        col = Math.floor(col / 26) - 1;
      }
      return letter;
    };

    // Begin building the HTML table.
    let htmlTable = '<table style="border-collapse: collapse; width: 100%;">';
    // Build header row with column letters and one extra header cell for row numbers.
    htmlTable += '<thead><tr>';
    htmlTable += '<th style="background:#d3d3d3; padding:5px; border:1px solid #999;"></th>';
    for (let c = effectiveRange.s.c; c <= effectiveRange.e.c; c++) {
      htmlTable += `<th style="background:#d3d3d3; padding:5px; border:1px solid #999; text-align:center;">${getColumnLetter(c)}</th>`;
    }
    htmlTable += '</tr></thead>';

    // Build table body over the effective rows.
    htmlTable += '<tbody>';
    for (let r = effectiveRange.s.r; r <= effectiveRange.e.r; r++) {
      htmlTable += '<tr>';
      // Row header with the actual row number (Excel rows start at 1).
      htmlTable += `<td style="background:#f0f0f0; padding:5px; border:1px solid #999; text-align:center;">${r + 1}</td>`;
      for (let c = effectiveRange.s.c; c <= effectiveRange.e.c; c++) {
        const cellKey = `${r},${c}`;
        // Skip cells that are within a merged region (that have already been rendered).
        if (skipCells[cellKey]) continue;
        // Get the cell's address (e.g. "B2") and its value.
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        const cellValue = cell ? cell.v : '';
        // Attach merge attributes (if any) for merged cells.
        let attributes = '';
        if (mergeStart[cellKey]) {
          const { colspan, rowspan } = mergeStart[cellKey];
          if (colspan > 1) attributes += ` colspan="${colspan}"`;
          if (rowspan > 1) attributes += ` rowspan="${rowspan}"`;
        }
        // Combine default styling with any cell-specific styling.
        const baseStyle = "padding:5px; border:1px solid #999; text-align:center; ";
        const customStyle = getCellStyle(cell);
        const combinedStyle = baseStyle + customStyle;
        htmlTable += `<td style="${combinedStyle}"${attributes}>${cellValue}</td>`;
      }
      htmlTable += '</tr>';
    }
    htmlTable += '</tbody></table>';
    return htmlTable;
  }, [workbook, selectedSheet]);

  return (
    <Modal visible={visible} onCancel={onCancel} footer={null} title="Excel Preview" width="80%">
      {/* If more than one sheet exists, show a segmented control to switch between them. */}
      {workbook && workbook.SheetNames.length > 1 && (
        <div style={{ marginBottom: '10px' }}>
          <Segmented
            options={workbook.SheetNames}
            value={selectedSheet}
            onChange={setSelectedSheet}
          />
        </div>
      )}
      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        {/* Render the generated HTML table */}
        <div dangerouslySetInnerHTML={{ __html: htmlString }} />
      </div>
    </Modal>
  );
};

export default ExcelPreviewModal; 