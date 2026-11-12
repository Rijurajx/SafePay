'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-community';
import {
  Search,
  Download,
  Store,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';

// Register all community features
ModuleRegistry.registerModules([AllCommunityModule]);

export interface SafePayGridRow {
  id: string;
  merchantName: string;
  category: string;
  amount: number;
  currency?: string;
  status: string;
  riskScore?: number | null;
  createdAt: string;
  isTrusted?: boolean;
  notes?: string;
}

interface SafePayLedgerGridProps {
  rowData: SafePayGridRow[];
  loading?: boolean;
  onRowClick?: (row: SafePayGridRow) => void;
  title?: string;
  subtitle?: string;
}

// Clean custom Quartz theme matching SafePay design
const safePayGridTheme = themeQuartz.withParams({
  accentColor: '#9333ea', // SafePay Purple
  backgroundColor: '#ffffff',
  borderColor: '#f1f5f9',
  borderRadius: 16,
  headerBackgroundColor: '#f8fafc',
  headerTextColor: '#0f172a',
  headerFontWeight: 700,
  headerFontSize: 12,
  fontSize: 13,
  rowHoverColor: '#fbf9ff',
  selectedRowBackgroundColor: '#f5f3ff',
});

export function SafePayLedgerGrid({
  rowData,
  loading = false,
  onRowClick,
  title = 'Interactive Transaction Ledger',
  subtitle = 'High-performance AG Grid with multi-column sorting, filtering, and export',
}: SafePayLedgerGridProps) {
  const gridRef = useRef<AgGridReact<SafePayGridRow>>(null);
  const [gridApi, setGridApi] = useState<GridApi<SafePayGridRow> | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SETTLED' | 'AWAITING' | 'DECLINED'>('ALL');

  const onGridReady = useCallback((params: GridReadyEvent<SafePayGridRow>) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const handleExportCsv = useCallback(() => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `safepay-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  }, [gridApi]);

  // Status Filter Cell Renderer
  const StatusCellRenderer = (params: ICellRendererParams<SafePayGridRow>) => {
    const status = (params.value || '').toUpperCase();
    if (['SETTLED', 'APPROVED', 'APPROVED_FOR_CHECKOUT', 'READY_FOR_CHECKOUT'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Settled</span>
        </span>
      );
    }
    if (['AWAITING_FAMILY', 'WAITING', 'CAPTURE_PENDING', 'CHECKOUT_IN_PROGRESS'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Held for Review</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" />
        <span>Declined</span>
      </span>
    );
  };

  // Merchant Cell Renderer
  const MerchantCellRenderer = (params: ICellRendererParams<SafePayGridRow>) => {
    const data = params.data;
    if (!data) return null;
    return (
      <div className="flex items-center gap-2.5 py-1">
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold">
          <Store className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-bold text-slate-900 truncate">{data.merchantName}</span>
            {data.isTrusted && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                Trusted
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">{data.category}</span>
        </div>
      </div>
    );
  };

  // Risk Score Cell Renderer
  const RiskCellRenderer = (params: ICellRendererParams<SafePayGridRow>) => {
    const score = Number(params.value ?? 20);
    const isHigh = score >= 70;
    const isMed = score >= 40 && score < 70;

    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
            isHigh
              ? 'bg-rose-100 text-rose-800'
              : isMed
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {isHigh ? (
            <AlertTriangle className="w-3 h-3 text-rose-600" />
          ) : (
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
          )}
          <span>{score}/100</span>
        </span>
        <span className="text-[10px] text-slate-400">
          {isHigh ? 'High' : isMed ? 'Review' : 'Safe'}
        </span>
      </div>
    );
  };

  // Amount Cell Renderer
  const AmountCellRenderer = (params: ICellRendererParams<SafePayGridRow>) => {
    const amt = Number(params.value || 0);
    return (
      <span className="font-extrabold text-slate-900 font-mono text-sm">
        ${amt.toFixed(2)}
      </span>
    );
  };

  // Date Cell Renderer
  const DateCellRenderer = (params: ICellRendererParams<SafePayGridRow>) => {
    if (!params.value) return <span className="text-slate-400 text-xs">-</span>;
    const d = new Date(params.value);
    return (
      <div className="text-xs text-slate-600 leading-tight">
        <div>{d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div className="text-[10px] text-slate-400">
          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  // Column definitions
  const columnDefs = useMemo<ColDef<SafePayGridRow>[]>(() => {
    return [
      {
        headerName: 'Merchant & Category',
        field: 'merchantName',
        cellRenderer: MerchantCellRenderer,
        flex: 2,
        minWidth: 220,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Amount (USD)',
        field: 'amount',
        cellRenderer: AmountCellRenderer,
        flex: 1,
        minWidth: 120,
        sort: 'desc',
        filter: 'agNumberColumnFilter',
      },
      {
        headerName: 'Status',
        field: 'status',
        cellRenderer: StatusCellRenderer,
        flex: 1.2,
        minWidth: 150,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'SafePay AI Risk',
        field: 'riskScore',
        cellRenderer: RiskCellRenderer,
        flex: 1.2,
        minWidth: 150,
        filter: 'agNumberColumnFilter',
      },
      {
        headerName: 'Date & Time',
        field: 'createdAt',
        cellRenderer: DateCellRenderer,
        flex: 1.2,
        minWidth: 140,
        filter: 'agDateColumnFilter',
      },
      {
        headerName: 'Transaction ID',
        field: 'id',
        flex: 1.2,
        minWidth: 140,
        cellRenderer: (params: ICellRendererParams) => (
          <span className="font-mono text-[11px] text-slate-500 truncate block">
            {params.value}
          </span>
        ),
      },
    ];
  }, []);

  // Filtered rows by status tab
  const filteredData = useMemo(() => {
    return rowData.filter((row) => {
      if (statusFilter === 'ALL') return true;
      const s = (row.status || '').toUpperCase();
      if (statusFilter === 'SETTLED') {
        return ['SETTLED', 'APPROVED', 'APPROVED_FOR_CHECKOUT', 'READY_FOR_CHECKOUT'].includes(s);
      }
      if (statusFilter === 'AWAITING') {
        return ['AWAITING_FAMILY', 'WAITING', 'CAPTURE_PENDING', 'CHECKOUT_IN_PROGRESS'].includes(s);
      }
      if (statusFilter === 'DECLINED') {
        return ['DECLINED', 'DECLINED_BY_FAMILY', 'BLOCKED_BY_POLICY', 'EXPIRED', 'CANCELLED_BY_USER', 'CAPTURE_FAILED'].includes(s);
      }
      return true;
    });
  }, [rowData, statusFilter]);

  return (
    <div className="space-y-3.5">
      {/* Top Header & Search / Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
              <span>{title}</span>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                AG Grid Engine
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Quick Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={quickFilterText}
              onChange={(e) => {
                setQuickFilterText(e.target.value);
                if (gridApi) gridApi.setGridOption('quickFilterText', e.target.value);
              }}
              placeholder="Search all columns..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-600/20"
            />
          </div>

          {/* Export to CSV Button */}
          <button
            onClick={handleExportCsv}
            title="Export to CSV"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Status Filter Badges */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/70 rounded-xl border border-slate-200/60 w-fit text-xs">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-semibold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-950 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          All ({rowData.length})
        </button>
        <button
          onClick={() => setStatusFilter('SETTLED')}
          className={`px-3 py-1 rounded-lg font-semibold transition-all ${
            statusFilter === 'SETTLED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Settled
        </button>
        <button
          onClick={() => setStatusFilter('AWAITING')}
          className={`px-3 py-1 rounded-lg font-semibold transition-all ${
            statusFilter === 'AWAITING'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Held / Review
        </button>
        <button
          onClick={() => setStatusFilter('DECLINED')}
          className={`px-3 py-1 rounded-lg font-semibold transition-all ${
            statusFilter === 'DECLINED'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          Declined
        </button>
      </div>

      {/* The AG Grid Table */}
      <div
        className="w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-white"
        style={{ height: '440px' }}
      >
        <AgGridReact<SafePayGridRow>
          ref={gridRef}
          theme={safePayGridTheme}
          rowData={filteredData}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50, 100]}
          rowSelection={{ mode: 'singleRow' }}
          onRowClicked={(e) => e.data && onRowClick?.(e.data)}
          onGridReady={onGridReady}
          loading={loading}
          overlayNoRowsTemplate={`
            <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
              <div style="font-weight: 600; margin-bottom: 4px;">No matching transactions</div>
              <div style="font-size: 11px;">Adjust search keywords or filter status above.</div>
            </div>
          `}
        />
      </div>

      {/* Grid Status Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
          <span>Showing <strong>{filteredData.length}</strong> of <strong>{rowData.length}</strong> transactions</span>
        </span>
        <span className="hidden sm:inline text-slate-400">
          Tip: Click column headers to sort &bull; Drag to reorder &bull; Filter icon in headers
        </span>
      </div>
    </div>
  );
}
