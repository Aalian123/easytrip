import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { REPORTS, REPORT_INDEX, ReportFilters } from './report-definitions';

// pdfmake needs a font set; the standard PDF fonts avoid shipping font files.
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  catalogue() {
    return REPORTS.map(({ key, title, description, columns }) => ({ key, title, description, columns }));
  }

  async run(key: string, filters: ReportFilters) {
    const definition = REPORT_INDEX.get(key);
    if (!definition) throw new NotFoundException('That report does not exist.');
    const rows = await definition.run(this.prisma, filters);
    return { key, title: definition.title, columns: definition.columns, rows, generatedAt: new Date() };
  }

  async toExcel(key: string, filters: ReportFilters): Promise<Buffer> {
    const report = await this.run(key, filters);
    const settings = await this.settings.get();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings.organizationName;
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(report.title.slice(0, 30));

    sheet.addRow([report.title]).font = { bold: true, size: 14 };
    sheet.addRow([`Generated ${report.generatedAt.toISOString().slice(0, 16).replace('T', ' ')}`]);
    sheet.addRow([]);

    const header = sheet.addRow(report.columns.map((column) => column.label));
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF0F3' } };
    });

    for (const row of report.rows) {
      sheet.addRow(report.columns.map((column) => row[column.key] ?? ''));
    }

    report.columns.forEach((column, index) => {
      const values = report.rows.map((row) => String(row[column.key] ?? ''));
      const width = Math.min(40, Math.max(column.label.length, ...values.map((value) => value.length)) + 2);
      sheet.getColumn(index + 1).width = width;
      if (column.numeric) sheet.getColumn(index + 1).alignment = { horizontal: 'right' };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async toPdf(key: string, filters: ReportFilters): Promise<Buffer> {
    const report = await this.run(key, filters);
    const settings = await this.settings.get();

    const definition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: report.columns.length > 6 ? 'landscape' : 'portrait',
      pageMargins: [28, 32, 28, 36],
      defaultStyle: { font: 'Helvetica', fontSize: 9, color: '#1B2430' },
      content: [
        { text: report.title, fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
        {
          text: `${settings.organizationName} · generated ${report.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} · ${report.rows.length} row${report.rows.length === 1 ? '' : 's'}`,
          fontSize: 8,
          color: '#5F6C7B',
          margin: [0, 0, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths: report.columns.map(() => 'auto'),
            body: [
              report.columns.map((column) => ({
                text: column.label,
                bold: true,
                fillColor: '#EDF0F3',
                alignment: column.numeric ? 'right' : 'left',
              })),
              ...report.rows.map((row) =>
                report.columns.map((column) => ({
                  text: String(row[column.key] ?? ''),
                  alignment: column.numeric ? ('right' as const) : ('left' as const),
                })),
              ),
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 1 ? 1 : 0.5),
            vLineWidth: () => 0,
            hLineColor: () => '#D3DAE0',
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      footer: (current: number, total: number) => ({
        text: `${current} of ${total}`,
        alignment: 'center',
        fontSize: 8,
        color: '#5F6C7B',
        margin: [0, 8, 0, 0],
      }),
    };

    const pdf = printer.createPdfKitDocument(definition);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);
      pdf.end();
    });
  }
}
